import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ResultsClient from './ResultsClient'

export default async function ResultsPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: myClub } = await supabase
    .from('clubs').select('id, name').eq('user_id', user.id).single()

  // Toutes les journées qui ont au moins un match
  const { data: matches } = await supabase
    .from('matches')
    .select(`
      id, gameweek, processed, home_score, away_score,
      home_club:clubs!matches_home_club_id_fkey(id, name, is_bot),
      away_club:clubs!matches_away_club_id_fkey(id, name, is_bot)
    `)
    .order('gameweek', { ascending: true })
    .order('processed', { ascending: false })

  const { data: state } = await supabase
    .from('onboarding_state').select('current_gameweek').eq('user_id', user.id).single()

  return (
    <ResultsClient
      matches={matches ?? []}
      myClubId={myClub?.id ?? null}
      currentGameweek={state?.current_gameweek ?? 1}
    />
  )
}
