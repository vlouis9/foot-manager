import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const maxDuration = 60 // Vercel max duration

const PRICE_MULT  = 500_000
const SALARY_MULT = 50_000
const BATCH = 100

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

const BOT_CLUBS = [
  'PSG','Monaco','Marseille','Lyon','Lille','Nice','Lens','Rennes',
  'Strasbourg','Nantes','Toulouse','Brest','Lorient','Le Havre',
  'Auxerre','Angers','Paris FC','Metz',
]

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide ou trop volumineux' }, { status: 400 })
  }

  const { players, calendar, stats, chunk, totalChunks, type } = body
  const results: Record<string, string> = {}

  // ── Mode chunked pour les stats (trop volumineuses) ──────────
  if (type === 'stats_chunk' && stats?.length) {
    const statInserts = (stats as any[])
      .map((s: any) => ({
        joueurid: String(s.joueurid ?? '').replace('Paris Saint Germain', 'Paris Saint-Germain'),
        gameweek: parseInt(String(s.Journée ?? s.gameweek ?? 0)),
        played:   parseInt(String(s.Joué ?? s.played ?? 0)),
        starter:  parseInt(String(s.Titulaire ?? s.starter ?? 0)),
        rating:   parseFloat(String(s.Note ?? s.rating ?? 0)),
        goals:    parseInt(String(s.Buts ?? s.goals ?? 0)),
      }))
      .filter((s: any) => s.joueurid && s.gameweek > 0 && s.played === 1)

    if (chunk === 0) {
      // Premier chunk : vider la table
      await supabase.from('stats_raw').delete().neq('joueurid', 'PLACEHOLDER_NEVER_MATCHES')
    }

    let imported = 0
    for (let i = 0; i < statInserts.length; i += 500) {
      const { error } = await supabase.from('stats_raw')
        .upsert(statInserts.slice(i, i + 500), { onConflict: 'joueurid,gameweek' })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      imported += Math.min(500, statInserts.length - i)
    }
    return NextResponse.json({
      ok: true,
      message: `Chunk ${(chunk ?? 0) + 1}/${totalChunks ?? '?'} : ${imported} stats`,
    })
  }

  // ── Import clubs bots ─────────────────────────────────────────
  for (const name of BOT_CLUBS) {
    const { data: existing } = await supabase
      .from('clubs').select('id').eq('name', name).eq('is_bot', true).single()
    if (!existing) {
      await supabase.from('clubs').insert({
        name, budget: 2_000_000, wage_budget: 0, is_bot: true, reputation: 50
      })
    }
  }

  // ── Import joueurs ────────────────────────────────────────────
  if (players?.length) {
    const inserts = (players as any[]).map(p => ({
      joueurid:            String(p.joueurid ?? `${p.name}${p.position}${p.teamId}`),
      lastname:            String(p.name ?? ''),
      real_team:           teamToDb(String(p.teamId ?? '')),
      position:            String(p.position ?? 'ATT'),
      base_rating:         parseInt(String(p.baseRating ?? 50)) || 50,
      market_value:        Math.round(parseFloat(String(p.price ?? 5)) * PRICE_MULT),
      salary:              Math.round(parseFloat(String(p.salary ?? 1)) * SALARY_MULT) || 50_000,
      category:            getCategory(parseFloat(String(p.price ?? 0))),
      availability_status: 'available',
    }))

    // Vider les club_players des bots
    const { data: botIds } = await supabase.from('clubs').select('id').eq('is_bot', true)
    if (botIds?.length) {
      await supabase.from('club_players')
        .delete().in('club_id', botIds.map((c: any) => c.id))
    }

    let imported = 0
    for (let i = 0; i < inserts.length; i += BATCH) {
      const { error } = await supabase.from('players')
        .upsert(inserts.slice(i, i + BATCH), { onConflict: 'joueurid' })
      if (error) { results.players = `❌ ${error.message}`; break }
      imported += Math.min(BATCH, inserts.length - i)
    }

    if (!results.players) {
      // Réaffecter aux bots
      const { data: allP } = await supabase.from('players').select('id, real_team')
      const { data: bots } = await supabase.from('clubs').select('id, name').eq('is_bot', true)
      const botMap = new Map((bots ?? []).map((c: any) => [c.name, c.id]))
      const assigns = (allP ?? [])
        .filter((p: any) => botMap.has(p.real_team))
        .map((p: any) => ({ club_id: botMap.get(p.real_team), player_id: p.id, xp: 0, level: 1 }))
      for (let i = 0; i < assigns.length; i += BATCH) {
        await supabase.from('club_players').insert(assigns.slice(i, i + BATCH))
      }
      results.players = `✅ ${imported} joueurs · ${assigns.length} affectés`
    }
  }

  // ── Import calendrier ─────────────────────────────────────────
  if (calendar?.length) {
    await supabase.from('calendar').delete().neq('gameweek', -999)
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
    if (!results.calendar) results.calendar = `✅ ${imported} matchs`
  }

  // ── Import stats (mode direct si petit volume) ────────────────
  if (stats?.length) {
    const statInserts = (stats as any[])
      .map((s: any) => ({
        joueurid: String(s.joueurid ?? '').replace('Paris Saint Germain', 'Paris Saint-Germain'),
        gameweek: parseInt(String(s.Journée ?? s.gameweek ?? 0)),
        played:   parseInt(String(s.Joué ?? s.played ?? 0)),
        starter:  parseInt(String(s.Titulaire ?? s.starter ?? 0)),
        rating:   parseFloat(String(s.Note ?? s.rating ?? 0)),
        goals:    parseInt(String(s.Buts ?? s.goals ?? 0)),
      }))
      .filter((s: any) => s.joueurid && s.gameweek > 0 && s.played === 1)

    await supabase.from('stats_raw').delete().neq('joueurid', 'PLACEHOLDER_NEVER_MATCHES')
    let imported = 0
    for (let i = 0; i < statInserts.length; i += 500) {
      const { error } = await supabase.from('stats_raw')
        .upsert(statInserts.slice(i, i + 500), { onConflict: 'joueurid,gameweek' })
      if (error) { results.stats = `❌ ${error.message}`; break }
      imported += Math.min(500, statInserts.length - i)
    }
    if (!results.stats) results.stats = `✅ ${imported} stats`
  }

  return NextResponse.json({ results })
}
