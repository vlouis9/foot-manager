import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { saveId } = await req.json()

  // Récupérer la save pour avoir le club_id
  const { data: save } = await supabase
    .from('game_saves')
    .select('club_id')
    .eq('id', saveId)
    .eq('user_id', user.id)
    .single()

  if (!save) return NextResponse.json({ error: 'Save introuvable' }, { status: 404 })

  // Supprimer dans l'ordre (cascade devrait gérer, mais soyons explicites)
  await supabase.from('card_packs').delete().eq('club_id', save.club_id)
  await supabase.from('club_upgrades').delete().eq('club_id', save.club_id)
  await supabase.from('daily_events').delete().eq('club_id', save.club_id)

  // Remettre les joueurs dans leurs clubs bots
  const { data: clubPlayers } = await supabase
    .from('club_players')
    .select('player_id, players(real_team)')
    .eq('club_id', save.club_id)

  for (const cp of clubPlayers ?? []) {
    const realTeam = (cp.players as any)?.real_team
    if (!realTeam) continue
    const { data: botClub } = await supabase
      .from('clubs').select('id').eq('name', realTeam).eq('is_bot', true).single()
    if (botClub) {
      await supabase.from('club_players').insert({
        club_id: botClub.id, player_id: cp.player_id, xp: 0, level: 1
      }).select()
    }
  }

  await supabase.from('club_players').delete().eq('club_id', save.club_id)
  await supabase.from('lineups').delete().eq('club_id', save.club_id)
  await supabase.from('game_saves').delete().eq('id', saveId)
  await supabase.from('clubs').delete().eq('id', save.club_id)

  // Si c'était la partie active, reset onboarding
  await supabase.from('onboarding_state').upsert({
    user_id: user.id,
    draft_done: false,
    club_chosen: false,
    current_gameweek: 1,
  }, { onConflict: 'user_id' })

  // Réactiver une autre save si elle existe
  const { data: remaining } = await supabase
    .from('game_saves')
    .select('id, club_id, gameweek')
    .eq('user_id', user.id)
    .order('last_played', { ascending: false })
    .limit(1)

  if (remaining?.[0]) {
    await supabase.from('game_saves')
      .update({ is_active: true })
      .eq('id', remaining[0].id)
    await supabase.from('onboarding_state').upsert({
      user_id: user.id,
      draft_done: true,
      current_gameweek: remaining[0].gameweek,
    }, { onConflict: 'user_id' })
  }

  return NextResponse.json({ ok: true })
}
