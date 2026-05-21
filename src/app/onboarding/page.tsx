import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import OnboardingClient from './OnboardingClient'

export default async function OnboardingPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  // Si déjà onboardé, rediriger
  const { data: state } = await supabase
    .from('onboarding_state')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (state?.draft_done) redirect('/')

  return <OnboardingClient userId={user.id} />
}
