import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GameLayoutClient from './GameLayoutClient'

export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  // Onboarding state
  const { data: state } = await supabase
    .from('onboarding_state')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!state?.draft_done) {
    // Pas de partie terminée — chercher si un club existe quand même
    const { data: anyClub } = await supabase
      .from('clubs').select('id').eq('user_id', user.id).eq('is_bot', false).limit(1).single()
    if (anyClub && state) redirect('/onboarding')
    redirect('/welcome')
  }

  // Club actif : celui lié à la save active, sinon le plus récent
  let clubId: string | null = null

  if (state.save_id) {
    const { data: save } = await supabase
      .from('game_saves').select('club_id').eq('id', state.save_id).single()
    clubId = save?.club_id ?? null
  }

  if (!clubId) {
    const { data: clubs } = await supabase
      .from('clubs').select('id')
      .eq('user_id', user.id).eq('is_bot', false)
      .order('created_at', { ascending: false }).limit(1)
    clubId = clubs?.[0]?.id ?? null
  }

  if (!clubId) redirect('/welcome')

  const { data: club } = await supabase
    .from('clubs').select('id, name, budget').eq('id', clubId).single()
  if (!club) redirect('/welcome')

  // Paquets non ouverts
  const { count: packCount } = await supabase
    .from('card_packs')
    .select('*', { count: 'exact', head: true })
    .eq('club_id', club.id).eq('opened', false)

  const simDate = state.simulated_date ?? new Date().toISOString()

  const { data: nextCalendar } = await supabase
    .from('calendar').select('*')
    .gt('match_date', simDate)
    .order('match_date', { ascending: true })
    .limit(1).single()

  return (
    <GameLayoutClient
      club={club}
      simulatedDate={simDate}
      currentGameweek={state.current_gameweek ?? 1}
      pendingPacks={packCount ?? 0}
      nextCalendarMatch={nextCalendar ?? null}
    >
      {children}
    </GameLayoutClient>
  )
}
