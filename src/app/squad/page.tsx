import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SquadClient from './SquadClient'

export default async function SquadPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: club } = await supabase
    .from('clubs')
    .select('*')
    .eq('user_id', user.id)
    .single()
  if (!club) redirect('/onboarding')

  const { data: clubPlayers } = await supabase
    .from('club_players')
    .select('*, player:players(*)')
    .eq('club_id', club.id)
    .order('created_at', { ascending: true })

  const { data: upgrades } = await supabase
    .from('club_upgrades')
    .select('*')
    .eq('club_id', club.id)

  return (
    <SquadClient
      clubId={club.id}
      initialPlayers={clubPlayers ?? []}
      upgrades={upgrades ?? []}
    />
  )
}
