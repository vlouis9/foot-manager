import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StandingsClient from './StandingsClient'

export default async function StandingsPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: myClub } = await supabase
    .from('clubs').select('id').eq('user_id', user.id).single()

  // Tous les clubs
  const { data: clubs } = await supabase
    .from('clubs').select('id, name, is_bot')

  // Tous les matchs traités
  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .eq('processed', true)

  return (
    <StandingsClient
      clubs={clubs ?? []}
      matches={matches ?? []}
      myClubId={myClub?.id ?? null}
    />
  )
}
