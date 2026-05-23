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

  // Vérifier que la date n'est pas dans le futur
  const start = new Date(startDate)
  if (start > new Date()) {
    return NextResponse.json({ error: 'Date de démarrage dans le futur' }, { status: 400 })
  }

  // Supprimer l'ancienne partie si elle existe
  const { data: oldClub } = await supabase
    .from('clubs').select('id').eq('user_id', user.id).eq('is_bot', false).single()
  if (oldClub) {
    await supabase.from('clubs').delete().eq('id', oldClub.id)
  }

  // Créer le nouveau club
  const { data: club, error } = await supabase
    .from('clubs')
    .insert({
      user_id: user.id,
      name: clubName,
      budget: config.initial_budget,
      wage_budget: Math.floor(config.initial_budget * 0.25),
      is_bot: false,
    })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Upgrades initiaux
  await supabase.from('club_upgrades').insert([
    { club_id: club.id, type: 'offense_center',  level: 0 },
    { club_id: club.id, type: 'defense_center',  level: 0 },
    { club_id: club.id, type: 'tactical_room',   level: 0 },
    { club_id: club.id, type: 'academy',         level: 0 },
    { club_id: club.id, type: 'training_center', level: 0 },
    { club_id: club.id, type: 'stadium',         level: 0 },
    { club_id: club.id, type: 'tactical_staff',  level: 0 },
  ])

  // Paquets de bienvenue
  await supabase.from('card_packs').insert([
    { club_id: club.id, type: 'standard', opened: false },
    { club_id: club.id, type: 'standard', opened: false },
    { club_id: club.id, type: 'standard', opened: false },
  ])

  // Trouver la gameweek de démarrage selon la date
  const { data: firstMatch } = await supabase
    .from('calendar')
    .select('gameweek')
    .gte('match_date', start.toISOString())
    .order('match_date', { ascending: true })
    .limit(1)
    .single()

  const startGameweek = firstMatch?.gameweek ?? 1

  // Mettre à jour l'onboarding state
  await supabase.from('onboarding_state').upsert({
    user_id: user.id,
    club_chosen: false,
    draft_done: false,
    current_gameweek: startGameweek,
    simulated_date: start.toISOString(),
    game_started_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  return NextResponse.json({ clubId: club.id, startGameweek })
}
