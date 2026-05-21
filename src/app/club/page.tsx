import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ClubClient from './ClubClient'

export default async function ClubPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: club } = await supabase
    .from('clubs').select('*').eq('user_id', user.id).single()
  if (!club) redirect('/onboarding')

  const { data: upgrades } = await supabase
    .from('club_upgrades').select('*').eq('club_id', club.id)

  const { data: events } = await supabase
    .from('daily_events')
    .select('*')
    .eq('club_id', club.id)
    .gt('expires_at', new Date().toISOString())

  return <ClubClient club={club} upgrades={upgrades ?? []} events={events ?? []} />
}
