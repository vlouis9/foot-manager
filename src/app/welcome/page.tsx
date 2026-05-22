import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import WelcomeClient from './WelcomeClient'

export default async function WelcomePage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  // Parties en cours
  const { data: clubs } = await supabase
    .from('clubs')
    .select('id, name, budget, reputation, season, created_at')
    .eq('user_id', user.id)
    .eq('is_bot', false)
    .order('created_at', { ascending: false })

  // État onboarding
  const { data: states } = await supabase
    .from('onboarding_state')
    .select('*')
    .eq('user_id', user.id)

  // Prochaine journée du calendrier
  const { data: nextFixture } = await supabase
    .from('calendar')
    .select('*')
    .gt('match_date', new Date().toISOString())
    .order('match_date', { ascending: true })
    .limit(1)
    .single()

  // Journée actuelle du joueur
  const activeState = states?.[0]
  const currentGw = activeState?.current_gameweek ?? 1

  // Dernière journée jouée
  const { data: lastMatch } = await supabase
    .from('matches')
    .select('gameweek, processed')
    .eq('processed', true)
    .order('gameweek', { ascending: false })
    .limit(1)
    .single()

  return (
    <WelcomeClient
      user={{ id: user.id, email: user.email ?? '' }}
      clubs={clubs ?? []}
      onboardingStates={states ?? []}
      nextFixture={nextFixture ?? null}
      currentGameweek={currentGw}
      lastProcessedGameweek={lastMatch?.gameweek ?? 0}
    />
  )
}
