import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const PRICE_MULT  = 500_000
const SALARY_MULT = 50_000

const TEAM_TO_DB: Record<string, string> = {
  'Paris Saint-Germain': 'PSG',
  'Paris Saint Germain': 'PSG',
}
function teamToDb(t: string) { return TEAM_TO_DB[t] ?? t }

function getCategory(price: number): string {
  if (price < 15) return 'bronze'
  if (price < 30) return 'argent'
  if (price < 45) return 'or'
  if (price < 60) return 'platine'
  return 'diamant'
}

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { players, calendar, stats } = await req.json()

  const results: Record<string, string> = {}

  // ─── Import joueurs ──────────────────────────────────────────
  if (players?.length) {
    // Truncate cascade (réinitialise tout)
    await supabase.rpc('truncate_players_cascade')
      .catch(() => null) // fallback si pas de fonction

    const playerInserts = players.map((p: any) => ({
      joueurid:     p.joueurid,
      lastname:     p.name,
      real_team:    teamToDb(p.teamId),
      position:     p.position,
      base_rating:  parseInt(p.baseRating) || 50,
      market_value: Math.round(parseInt(p.price) * PRICE_MULT),
      salary:       Math.round(parseFloat(p.salary || 0) * SALARY_MULT) || 50_000,
      category:     getCategory(parseInt(p.price) || 0),
      availability_status: 'available',
    }))

    // Batch insert
    const BATCH = 100
    let imported = 0
    for (let i = 0; i < playerInserts.length; i += BATCH) {
      const { error } = await supabase.from('players')
        .upsert(playerInserts.slice(i, i + BATCH), { onConflict: 'joueurid' })
      if (error) { results.players = `❌ ${error.message}`; break }
      imported += Math.min(BATCH, playerInserts.length - i)
    }
    if (!results.players) results.players = `✅ ${imported} joueurs importés`

    // Réaffecter aux clubs bots
    await supabase.from('club_players')
      .delete().in('club_id',
        (await supabase.from('clubs').select('id').eq('is_bot', true)).data?.map((c: any) => c.id) ?? []
      )
    const { data: allPlayers } = await supabase.from('players').select('id, real_team')
    const { data: botClubs }   = await supabase.from('clubs').select('id, name').eq('is_bot', true)
    const botMap = new Map(botClubs?.map((c: any) => [c.name, c.id]) ?? [])
    const botAssigns = (allPlayers ?? [])
      .filter((p: any) => botMap.has(p.real_team))
      .map((p: any) => ({ club_id: botMap.get(p.real_team), player_id: p.id, xp: 0, level: 1 }))

    for (let i = 0; i < botAssigns.length; i += BATCH) {
      await supabase.from('club_players').insert(botAssigns.slice(i, i + BATCH))
    }
  }

  // ─── Import calendrier ───────────────────────────────────────
  if (calendar?.length) {
    await supabase.from('calendar').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    const calInserts = calendar.map((c: any) => ({
      gameweek:   parseInt(c.matchday),
      home_team:  teamToDb(c.homeTeamId),
      away_team:  teamToDb(c.awayTeamId),
      match_date: new Date(c.date).toISOString(),
    }))
    const { error } = await supabase.from('calendar').insert(calInserts)
    results.calendar = error ? `❌ ${error.message}` : `✅ ${calInserts.length} matchs importés`
  }

  // ─── Import stats ────────────────────────────────────────────
  if (stats?.length) {
    await supabase.from('stats_raw').delete().neq('joueurid', '')
    const statInserts = stats
      .filter((s: any) => s.played == 1)
      .map((s: any) => ({
        joueurid:  String(s.joueurid).replace('Paris Saint Germain', 'Paris Saint-Germain'),
        gameweek:  parseInt(s.Journée || s.gameweek),
        played:    parseInt(s.Joué || s.played || 0),
        starter:   parseInt(s.Titulaire || s.starter || 0),
        rating:    parseFloat(s.Note || s.rating || 0),
        goals:     parseInt(s.Buts || s.goals || 0),
      }))

    const BATCH = 500
    let imported = 0
    for (let i = 0; i < statInserts.length; i += BATCH) {
      const { error } = await supabase.from('stats_raw')
        .upsert(statInserts.slice(i, i + BATCH), { onConflict: 'joueurid,gameweek' })
      if (error) { results.stats = `❌ ${error.message}`; break }
      imported += Math.min(BATCH, statInserts.length - i)
    }
    if (!results.stats) results.stats = `✅ ${imported} stats importées`
  }

  return NextResponse.json({ results })
}
