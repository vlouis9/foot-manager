import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { rows } = await req.json()
  // rows: [{ lastname, club, position, gameweek, played, starter, rating, goals }]

  if (!rows?.length) return NextResponse.json({ error: 'Aucune ligne' }, { status: 400 })

  // Charger tous les joueurs pour matcher par nom+club
  const { data: players } = await supabase
    .from('players')
    .select('id, lastname, real_team, position')

  const playerMap = new Map<string, string>()
  for (const p of players ?? []) {
    const key = `${p.lastname.toLowerCase()}|${p.real_team}`
    playerMap.set(key, p.id)
  }

  let matched = 0
  let skipped = 0
  const inserts: any[] = []

  for (const row of rows) {
    if (!row.played) continue // skip non-joués à l'import (on les ignore)

    const key = `${String(row.lastname).toLowerCase()}|${row.club}`
    const player_id = playerMap.get(key)
    if (!player_id) { skipped++; continue }

    inserts.push({
      player_id,
      gameweek:    parseInt(row.gameweek),
      minutes:     row.starter ? 90 : 45,
      rating:      parseFloat(row.rating) || 5.0,
      goals:       parseInt(row.goals) || 0,
      assists:     0,
      clean_sheet: false,
      yellow_card: false,
      red_card:    false,
    })
    matched++
  }

  if (!inserts.length) {
    return NextResponse.json({ error: `Aucun joueur matché. ${skipped} non trouvés.` }, { status: 400 })
  }

  // Upsert par batch de 500
  const BATCH = 500
  let imported = 0
  for (let i = 0; i < inserts.length; i += BATCH) {
    const batch = inserts.slice(i, i + BATCH)
    const { error } = await supabase
      .from('player_real_stats')
      .upsert(batch, { onConflict: 'player_id,gameweek' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    imported += batch.length
  }

  return NextResponse.json({
    message: `✅ ${imported} stats importées · ${skipped} joueurs non trouvés`,
    imported,
    skipped,
  })
}
