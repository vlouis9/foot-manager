import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GameweekClient from './GameweekClient'

export default async function GameweekPage({
  params,
}: {
  params: { gameweek: string }
}) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const gw = parseInt(params.gameweek)
  const { data: myClub } = await supabase
    .from('clubs').select('id').eq('user_id', user.id).single()

  const { data: matches } = await supabase
    .from('matches')
    .select(`
      id, gameweek, processed, home_score, away_score,
      home_club:clubs!matches_home_club_id_fkey(id, name),
      away_club:clubs!matches_away_club_id_fkey(id, name)
    `)
    .eq('gameweek', gw)

  return (
    <GameweekClient
      gameweek={gw}
      matches={matches ?? []}
      myClubId={myClub?.id ?? null}
    />
  )
}
