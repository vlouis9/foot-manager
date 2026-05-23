import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import WelcomeClient from './WelcomeClient'

export default async function WelcomePage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: clubs } = await supabase
    .from('clubs').select('id, name, budget, reputation, created_at')
    .eq('user_id', user.id).eq('is_bot', false)
    .order('created_at', { ascending: false })

  const { data: states } = await supabase
    .from('onboarding_state').select('*').eq('user_id', user.id)

  return (
    <WelcomeClient
      user={{ id: user.id, email: user.email ?? '' }}
      clubs={clubs ?? []}
      onboardingStates={states ?? []}
    />
  )
}
