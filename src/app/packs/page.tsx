import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PacksClient from './PacksClient'

export default async function PacksPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: club } = await supabase
    .from('clubs').select('id, name').eq('user_id', user.id).single()
  if (!club) redirect('/onboarding')

  const { data: packs } = await supabase
    .from('card_packs')
    .select('*')
    .eq('club_id', club.id)
    .eq('opened', false)
    .order('type', { ascending: true })
    .order('created_at', { ascending: true })

  // Joueurs dispo pour les cartes XP (mon effectif)
  const { data: myPlayers } = await supabase
    .from('club_players')
    .select('*, player:players(*)')
    .eq('club_id', club.id)

  return (
    <PacksClient
      clubId={club.id}
      packs={packs ?? []}
      myPlayers={myPlayers ?? []}
    />
  )
}
