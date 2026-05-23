import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GameLayoutClient from './GameLayoutClient'

export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: club } = await supabase
    .from('clubs').select('id, name, budget').eq('user_id', user.id).eq('is_bot', false).single()
  if (!club) redirect('/welcome')

  const { data: state } = await supabase
    .from('onboarding_state').select('*').eq('user_id', user.id).single()
  if (!state?.draft_done) redirect('/welcome')

  // Packs non ouverts
  const { count: packCount } = await supabase
    .from('card_packs').select('*', { count: 'exact', head: true })
    .eq('club_id', club.id).eq('opened', false)

  // Prochain match du calendrier
  const { data: nextCalendar } = await supabase
    .from('calendar')
    .select('*')
    .gt('match_date', state.simulated_date ?? new Date().toISOString())
    .order('match_date', { ascending: true })
    .limit(1)
    .single()

  return (
    <GameLayoutClient
      club={club}
      simulatedDate={state.simulated_date ?? new Date().toISOString()}
      currentGameweek={state.current_gameweek ?? 1}
      pendingPacks={packCount ?? 0}
      nextCalendarMatch={nextCalendar ?? null}
    >
      {children}
    </GameLayoutClient>
  )
}
