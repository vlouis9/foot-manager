import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ResultsNav from './ResultsNav'

export default async function GameResultsPage({
  searchParams,
}: {
  searchParams: { tab?: string; gw?: string }
}) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: club } = await supabase
    .from('clubs').select('id, name').eq('user_id', user.id).eq('is_bot', false).single()
  if (!club) redirect('/welcome')

  const { data: state } = await supabase
    .from('onboarding_state').select('current_gameweek').eq('user_id', user.id).single()

  const currentGw = state?.current_gameweek ?? 1
  const activeGw = searchParams.gw ? parseInt(searchParams.gw) : currentGw - 1 || 1

  // Tous les matchs traités
  const { data: matches } = await supabase
    .from('matches')
    .select(`
      id, gameweek, processed, home_score, away_score,
      home_club:clubs!matches_home_club_id_fkey(id, name, is_bot),
      away_club:clubs!matches_away_club_id_fkey(id, name, is_bot)
    `)
    .order('gameweek', { ascending: true })

  // Classement
  const { data: allClubs } = await supabase
    .from('clubs').select('id, name, is_bot')

  return (
    <ResultsNav
      myClubId={club.id}
      matches={(matches ?? []) as any[]}
      allClubs={allClubs ?? []}
      activeGw={activeGw}
      currentGw={currentGw}
      tab={searchParams.tab ?? 'results'}
    />
  )
}
