import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MatchdayClient from './MatchdayClient'

export default async function MatchdayPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: club } = await supabase
    .from('clubs').select('*').eq('user_id', user.id).single()
  if (!club) redirect('/onboarding')

  const { data: state } = await supabase
    .from('onboarding_state').select('current_gameweek').eq('user_id', user.id).single()
  const gameweek = state?.current_gameweek ?? 1

  const { data: clubPlayers } = await supabase
    .from('club_players')
    .select('*, player:players(*)')
    .eq('club_id', club.id)

  // Composition existante pour cette journée
  const { data: lineup } = await supabase
    .from('lineups')
    .select('*, lineup_players(*)')
    .eq('club_id', club.id)
    .eq('gameweek', gameweek)
    .single()

  // Résultats si journée traitée
  const { data: match } = await supabase
    .from('matches')
    .select('*, home_club:clubs!matches_home_club_id_fkey(name), away_club:clubs!matches_away_club_id_fkey(name)')
    .or(`home_club_id.eq.${club.id},away_club_id.eq.${club.id}`)
    .eq('gameweek', gameweek)
    .single()

  return (
    <MatchdayClient
      club={club}
      gameweek={gameweek}
      players={clubPlayers ?? []}
      existingLineup={lineup ?? null}
      currentMatch={match ?? null}
    />
  )
}
