import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GameLayoutClient from './GameLayoutClient'

export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  // Récupérer la partie active (la plus récente avec draft_done = true)
  const { data: state } = await supabase
    .from('onboarding_state')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Si pas de partie ou draft non terminé → welcome
  if (!state) redirect('/welcome')
  if (!state.draft_done) redirect('/onboarding')

  // Club actif
  const { data: club } = await supabase
    .from('clubs')
    .select('id, name, budget')
    .eq('user_id', user.id)
    .eq('is_bot', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!club) redirect('/welcome')

  // Packs non ouverts
  const { count: packCount } = await supabase
    .from('card_packs')
    .select('*', { count: 'exact', head: true })
    .eq('club_id', club.id)
    .eq('opened', false)

  // Prochain match du calendrier selon date simulée
  const simDate = state.simulated_date ?? new Date().toISOString()
  const { data: nextCalendar } = await supabase
    .from('calendar')
    .select('*')
    .gt('match_date', simDate)
    .order('match_date', { ascending: true })
    .limit(1)
    .single()

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
