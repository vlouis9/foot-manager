import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MatchClient from './MatchClient'

export default async function MatchPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: club } = await supabase
    .from('clubs').select('*').eq('user_id', user.id).eq('is_bot', false).single()
  if (!club) redirect('/welcome')

  const { data: state } = await supabase
    .from('onboarding_state').select('*').eq('user_id', user.id).single()

  const gameweek = state?.current_gameweek ?? 1
  const simulatedDate = state?.simulated_date ?? new Date().toISOString()

  const { data: players } = await supabase
    .from('club_players')
    .select('*, player:players(*)')
    .eq('club_id', club.id)

  const { data: lineup } = await supabase
    .from('lineups')
    .select('*, lineup_players(*)')
    .eq('club_id', club.id)
    .eq('gameweek', gameweek)
    .maybeSingle()

  // Vérifier si la journée a commencé (premier match de la journée)
  const { data: firstMatchOfGw } = await supabase
    .from('calendar')
    .select('match_date')
    .eq('gameweek', gameweek)
    .order('match_date', { ascending: true })
    .limit(1)
    .single()

  const gwStarted = firstMatchOfGw
    ? new Date(firstMatchOfGw.match_date) <= new Date(simulatedDate)
    : false

  // Résultat si journée traitée
  const { data: myMatch } = await supabase
    .from('matches')
    .select(`
      *, 
      home_club:clubs!matches_home_club_id_fkey(id, name),
      away_club:clubs!matches_away_club_id_fkey(id, name)
    `)
    .or(`home_club_id.eq.${club.id},away_club_id.eq.${club.id}`)
    .eq('gameweek', gameweek)
    .maybeSingle()

  return (
    <MatchClient
      club={club}
      gameweek={gameweek}
      players={players ?? []}
      existingLineup={lineup ?? null}
      gwStarted={gwStarted}
      myMatch={myMatch ?? null}
    />
  )
}
