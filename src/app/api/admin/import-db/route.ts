import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const PRICE_MULT  = 500_000
const SALARY_MULT = 50_000

function teamToDb(t: string): string {
  const map: Record<string, string> = {
    'Paris Saint-Germain': 'PSG',
    'Paris Saint Germain': 'PSG',
  }
  return map[t] ?? t
}

function getCategory(price: number): string {
  if (price < 15) return 'bronze'
  if (price < 30) return 'argent'
  if (price < 45) return 'or'
  if (price < 60) return 'platine'
  return 'diamant'
}

const BATCH = 100

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { players, calendar, stats } = await req.json()
  const results: Record<string, string> = {}

  // ─── S'assurer que les clubs bots existent ────────────────────
  const BOT_CLUBS = [
    { name:'PSG',budget:500000 }, { name:'Monaco',budget:1200000 },
    { name:'Marseille',budget:1200000 }, { name:'Lyon',budget:1200000 },
    { name:'Lille',budget:1500000 }, { name:'Nice',budget:1500000 },
    { name:'Lens',budget:1800000 }, { name:'Rennes',budget:1800000 },
    { name:'Strasbourg',budget:2000000 }, { name:'Nantes',budget:2000000 },
    { name:'Toulouse',budget:2000000 }, { name:'Brest',budget:2200000 },
    { name:'Lorient',budget:2500000 }, { name:'Le Havre',budget:2500000 },
    { name:'Auxerre',budget:2500000 }, { name:'Angers',budget:2500000 },
    { name:'Paris FC',budget:3000000 }, { name:'Metz',budget:3500000 },
  ]
  for (const c of BOT_CLUBS) {
    await supabase.from('clubs')
      .upsert({ name: c.name, budget: c.budget, wage_budget: 0, is_bot: true, reputation: 50 },
        { onConflict: 'name' })
      .select()
  }

  // ─── Import joueurs ───────────────────────────────────────────
  if (players?.length) {
    const playerInserts = (players as any[]).map(p => ({
      joueurid:           String(p.joueurid ?? `${p.name}${p.position}${p.teamId}`),
      lastname:           String(p.name ?? ''),
      real_team:          teamToDb(String(p.teamId ?? '')),
      position:           String(p.position ?? 'ATT'),
      base_rating:        parseInt(String(p.baseRating ?? 50)) || 50,
      market_value:       Math.round((parseFloat(String(p.price ?? 5))) * PRICE_MULT),
      salary:             Math.round((parseFloat(String(p.salary ?? 1))) * SALARY_MULT) || 50_000,
      category:           getCategory(parseFloat(String(p.price ?? 0))),
      availability_status: 'available',
    }))

    // Vider les joueurs des bots (sera recréé après)
    const { data: botClubIds } = await supabase
      .from('clubs').select('id').eq('is_bot', true)
    if (botClubIds?.length) {
      await supabase.from('club_players')
        .delete()
        .in('club_id', botClubIds.map((c: any) => c.id))
    }

    // Upsert joueurs par batch
    let imported = 0
    for (let i = 0; i < playerInserts.length; i += BATCH) {
      const { error } = await supabase.from('players')
        .upsert(playerInserts.slice(i, i + BATCH), { onConflict: 'joueurid' })
      if (error) { results.players = `❌ ${error.message}`; break }
      imported += Math.min(BATCH, playerInserts.length - i)
    }

    if (!results.players) {
      results.players = `✅ ${imported} joueurs importés`

      // Réaffecter aux bots
      const { data: allPlayers } = await supabase.from('players').select('id, real_team')
      const { data: botClubs }   = await supabase.from('clubs').select('id, name').eq('is_bot', true)
      const botMap = new Map((botClubs ?? []).map((c: any) => [c.name, c.id]))

      const assignments = (allPlayers ?? [])
        .filter((p: any) => botMap.has(p.real_team))
        .map((p: any) => ({ club_id: botMap.get(p.real_team), player_id: p.id, xp: 0, level: 1 }))

      for (let i = 0; i < assignments.length; i += BATCH) {
        await supabase.from('club_players').insert(assignments.slice(i, i + BATCH))
      }
      results.players += ` · ${assignments.length} affectés aux clubs`
    }
  }

  // ─── Import calendrier ────────────────────────────────────────
  if (calendar?.length) {
    await supabase.from('calendar')
      .delete().neq('id', '00000000-0000-0000-0000-000000000000')

    const calInserts = (calendar as any[]).map(c => ({
      gameweek:   parseInt(String(c.matchday ?? c.gameweek ?? 1)),
      home_team:  teamToDb(String(c.homeTeamId ?? c.home_team ?? '')),
      away_team:  teamToDb(String(c.awayTeamId ?? c.away_team ?? '')),
      match_date: new Date(String(c.date ?? c.match_date)).toISOString(),
    })).filter(c => !isNaN(new Date(c.match_date).getTime()))

    let imported = 0
    for (let i = 0; i < calInserts.length; i += BATCH) {
      const { error } = await supabase.from('calendar').insert(calInserts.slice(i, i + BATCH))
      if (error) { results.calendar = `❌ ${error.message}`; break }
      imported += Math.min(BATCH, calInserts.length - i)
    }
    if (!results.calendar) results.calendar = `✅ ${imported} matchs importés`
  }

  // ─── Import stats ─────────────────────────────────────────────
  if (stats?.length) {
    await supabase.from('stats_raw').delete().neq('joueurid', '')

    const statInserts = (stats as any[])
      .map(s => ({
        joueurid: String(s.joueurid ?? '').replace('Paris Saint Germain', 'Paris Saint-Germain'),
        gameweek: parseInt(String(s.Journée ?? s.gameweek ?? 0)),
        played:   parseInt(String(s.Joué ?? s.played ?? 0)),
        starter:  parseInt(String(s.Titulaire ?? s.starter ?? 0)),
        rating:   parseFloat(String(s.Note ?? s.rating ?? 0)),
        goals:    parseInt(String(s.Buts ?? s.goals ?? 0)),
      }))
      .filter(s => s.joueurid && s.gameweek > 0 && s.played === 1)

    let imported = 0
    for (let i = 0; i < statInserts.length; i += 500) {
      const { error } = await supabase.from('stats_raw')
        .upsert(statInserts.slice(i, i + 500), { onConflict: 'joueurid,gameweek' })
      if (error) { results.stats = `❌ ${error.message}`; break }
      imported += Math.min(500, statInserts.length - i)
    }
    if (!results.stats) results.stats = `✅ ${imported} stats importées`
  }

  return NextResponse.json({ results })
}
