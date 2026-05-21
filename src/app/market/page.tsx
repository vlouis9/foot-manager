import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MarketClient from './MarketClient'

export default async function MarketPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: club } = await supabase
    .from('clubs').select('*').eq('user_id', user.id).single()
  if (!club) redirect('/onboarding')

  // Joueurs sur le marché (non expirés)
  const { data: market } = await supabase
    .from('market')
    .select('*, player:players(*)')
    .gt('expires_at', new Date().toISOString())
    .order('availability', { ascending: true })
    .order('price', { ascending: true })
    .limit(30)

  // Mon effectif actuel (pour vente)
  const { data: myPlayers } = await supabase
    .from('club_players')
    .select('*, player:players(*)')
    .eq('club_id', club.id)

  return (
    <MarketClient
      club={club}
      marketItems={market ?? []}
      myPlayers={myPlayers ?? []}
    />
  )
}
