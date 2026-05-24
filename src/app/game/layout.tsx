import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GameLayoutClient from './GameLayoutClient'

export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  // Chercher un club joueur actif — si pas de partie du tout → welcome
  const { data: clubs } = await supabase
    .from('clubs')
    .select('id, name, budget')
    .eq('user_id', user.id)
    .eq('is_bot', false)
    .order('created_at', { ascending: false })
    .limit(1)

  const club = clubs?.[0]
  if (!club) redirect('/welcome')

  // Vérifier l'onboarding — si draft pas fait → onboarding
  const { data: state } = await supabase
    .from('onboarding_state')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Si draft pas terminé mais club existe → aller finir le draft
  if (!state?.draft_done) redirect('/onboarding')

  // Paquets non ouverts
  const { count: packCount } = await supabase
    .from('card_packs')
    .select('*', { count: 'exact', head: true })
    .eq('club_id', club.id)
    .eq('opened', false)

  const simDate = state?.simulated_date ?? new Date().toISOString()

  // Prochain match selon la date simulée
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
      currentGameweek={state?.current_gameweek ?? 1}
      pendingPacks={packCount ?? 0}
      nextCalendarMatch={nextCalendar ?? null}
    >
      {children}
    </GameLayoutClient>
  )
}
