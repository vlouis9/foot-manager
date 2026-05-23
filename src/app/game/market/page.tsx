import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GameMarketClient from './GameMarketClient'

export default async function GameMarketPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: club } = await supabase
    .from('clubs').select('*').eq('user_id', user.id).eq('is_bot', false).single()
  if (!club) redirect('/welcome')

  const { data: allPlayers } = await supabase
    .from('players').select('*').order('market_value', { ascending: false })

  // Stats agrégées
  const { data: allStats } = await supabase
    .from('player_real_stats')
    .select('player_id, rating, goals, assists, minutes, clean_sheet, gameweek')
    .order('gameweek', { ascending: false })

  // Mon effectif
  const { data: myPlayers } = await supabase
    .from('club_players').select('*, player:players(*)').eq('club_id', club.id)

  // Offres marché
  const { data: market } = await supabase
    .from('market').select('player_id, price, availability, expires_at')
    .gt('expires_at', new Date().toISOString())

  return (
    <GameMarketClient
      club={club}
      allPlayers={allPlayers ?? []}
      allStats={allStats ?? []}
      myPlayers={myPlayers ?? []}
      marketOffers={market ?? []}
    />
  )
}
