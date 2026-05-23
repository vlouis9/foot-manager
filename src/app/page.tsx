import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function RootPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  // Vérifier si partie en cours
  const { data: state } = await supabase
    .from('onboarding_state').select('draft_done').eq('user_id', user.id).single()

  if (state?.draft_done) redirect('/game')
  redirect('/welcome')
}
