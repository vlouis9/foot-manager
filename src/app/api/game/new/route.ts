import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { CLUB_CONFIGS } from '@/types'

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { clubName, startDate } = await req.json()
  const config = CLUB_CONFIGS[clubName]
  if (!config) return NextResponse.json({ error: 'Club invalide' }, { status: 400 })

  const start = new Date(startDate)
  if (start > new Date()) {
    return NextResponse.json({ error: 'Date dans le futur' }, { status: 400 })
  }

  // ── NE PAS supprimer les anciennes parties ─────────────────
  // Désactiver les parties précédentes
  await supabase.from('game_saves')
    .update({ is_active: false })
    .eq('user_id', user.id)

  // ── Créer le nouveau club ──────────────────────────────────
  const { data: club, error: clubErr } = await supabase
    .from('clubs')
    .insert({
      user_id: user.id,
      name: clubName,
      budget: config.initial_budget,
      wage_budget: Math.floor(config.initial_budget * 0.25),
      is_bot: false,
    })
    .select().single()
  if (clubErr) return NextResponse.json({ error: clubErr.message }, { status: 500 })

  // ── Upgrades initiaux ──────────────────────────────────────
  await supabase.from('club_upgrades').insert([
    'offense_center','defense_center','tactical_room','academy',
    'training_center','stadium','tactical_staff',
  ].map(type => ({ club_id: club.id, type, level: 0 })))

  // ── Paquets de bienvenue ───────────────────────────────────
  await supabase.from('card_packs').insert([
    { club_id: club.id, type: 'standard', opened: false },
    { club_id: club.id, type: 'standard', opened: false },
    { club_id: club.id, type: 'standard', opened: false },
  ])

  // ── Gameweek de départ selon la date ──────────────────────
  const { data: firstMatch } = await supabase
    .from('calendar')
    .select('gameweek')
    .gte('match_date', start.toISOString())
    .order('match_date', { ascending: true })
    .limit(1)
    .single()
  const startGameweek = firstMatch?.gameweek ?? 1

  // ── Créer la save ──────────────────────────────────────────
  const { data: save } = await supabase
    .from('game_saves')
    .insert({
      user_id: user.id,
      club_id: club.id,
      save_name: `${clubName} — Saison 2025`,
      is_active: true,
      gameweek: startGameweek,
    })
    .select().single()

  // ── Onboarding state ───────────────────────────────────────
  await supabase.from('onboarding_state').upsert({
    user_id: user.id,
    club_chosen: false,
    draft_done: false,
    current_gameweek: startGameweek,
    simulated_date: start.toISOString(),
    game_started_at: new Date().toISOString(),
    save_id: save?.id ?? null,
  }, { onConflict: 'user_id' })

  return NextResponse.json({ clubId: club.id, clubName, startGameweek })
}
