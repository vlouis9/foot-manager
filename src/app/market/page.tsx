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

  // Tous les joueurs de la ligue avec leurs stats agrégées
  const { data: allPlayers } = await supabase
    .from('players')
    .select('*')
    .order('market_value', { ascending: false })

  // Stats agrégées par joueur (moyennes)
  const { data: allStats } = await supabase
    .from('player_real_stats')
    .select('player_id, rating, goals, assists, minutes, gameweek')
    .order('gameweek', { ascending: false })

  // Mon effectif
  const { data: myPlayers } = await supabase
    .from('club_players')
    .select('*, player:players(*)')
    .eq('club_id', club.id)

  // Offres marché actives
  const { data: market } = await supabase
    .from('market')
    .select('player_id, price, availability, expires_at')
    .gt('expires_at', new Date().toISOString())

  // Tous les club_players pour savoir qui est disponible
  const { data: allClubPlayers } = await supabase
    .from('club_players')
    .select('player_id, club_id, clubs!inner(is_bot)')

  return (
    <MarketClient
      club={club}
      allPlayers={allPlayers ?? []}
      allStats={allStats ?? []}
      myPlayers={myPlayers ?? []}
      marketOffers={market ?? []}
      allClubPlayers={allClubPlayers ?? []}
    />
  )
}
