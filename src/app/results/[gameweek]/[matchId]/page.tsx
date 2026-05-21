import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MatchDetailClient from './MatchDetailClient'

export default async function MatchDetailPage({
  params,
}: {
  params: { gameweek: string; matchId: string }
}) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const gw = parseInt(params.gameweek)
  const { data: myClub } = await supabase
    .from('clubs').select('id').eq('user_id', user.id).single()

  // Le match
  const { data: match } = await supabase
    .from('matches')
    .select(`
      id, gameweek, processed, home_score, away_score,
      home_club:clubs!matches_home_club_id_fkey(id, name, is_bot),
      away_club:clubs!matches_away_club_id_fkey(id, name, is_bot)
    `)
    .eq('id', params.matchId)
    .single()

  if (!match) redirect(`/results/${gw}`)

  // Joueurs des deux clubs avec stats
  async function getClubPlayersWithStats(clubId: string) {
    const { data: cp } = await supabase
      .from('club_players')
      .select('*, player:players(*)')
      .eq('club_id', clubId)

    if (!cp?.length) return []

    const playerIds = cp.map((p: any) => p.player_id)
    const { data: stats } = await supabase
      .from('player_real_stats')
      .select('*')
      .eq('gameweek', gw)
      .in('player_id', playerIds)

    const statsMap = new Map(stats?.map(s => [s.player_id, s]) ?? [])

    // Récupérer la composition si club joueur
    const { data: lineup } = await supabase
      .from('lineups')
      .select('*, lineup_players(*)')
      .eq('club_id', clubId)
      .eq('gameweek', gw)
      .single()

    const starterIds = new Set(
      lineup?.lineup_players?.filter((lp: any) => lp.starter).map((lp: any) => lp.player_id) ?? []
    )

    return cp.map((c: any) => ({
      ...c,
      stats: statsMap.get(c.player_id) ?? null,
      starter: starterIds.size > 0 ? starterIds.has(c.player_id) : c.player.market_value > 5_000_000,
    }))
  }

  const homePlayers = await getClubPlayersWithStats(match.home_club.id)
  const awayPlayers = await getClubPlayersWithStats(match.away_club.id)

  return (
    <MatchDetailClient
      match={match}
      homePlayers={homePlayers}
      awayPlayers={awayPlayers}
      myClubId={myClub?.id ?? null}
      gameweek={gw}
    />
  )
}
