import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GameMatchDetail from './GameMatchDetail'

export default async function GameMatchDetailPage({
  params,
}: { params: { gameweek: string; matchId: string } }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const gw = parseInt(params.gameweek)

  const { data: myClub } = await supabase
    .from('clubs').select('id').eq('user_id', user.id).eq('is_bot', false).single()

  const { data: match } = await supabase
    .from('matches')
    .select(`
      id, gameweek, processed, home_score, away_score,
      home_club:clubs!matches_home_club_id_fkey(id, name, is_bot),
      away_club:clubs!matches_away_club_id_fkey(id, name, is_bot)
    `)
    .eq('id', params.matchId)
    .single()

  if (!match) redirect(`/game/results?gw=${gw}`)

  const hc = Array.isArray(match.home_club) ? match.home_club[0] : match.home_club
  const ac = Array.isArray(match.away_club) ? match.away_club[0] : match.away_club

  async function getClubPlayers(clubId: string) {
    const { data: cp } = await supabase
      .from('club_players')
      .select('*, player:players(*)')
      .eq('club_id', clubId)

    if (!cp?.length) return []
    const ids = cp.map((p: any) => p.player_id)
    const { data: stats } = await supabase
      .from('player_real_stats').select('*').eq('gameweek', gw).in('player_id', ids)
    const statsMap = new Map(stats?.map(s => [s.player_id, s]) ?? [])

    const { data: lineup } = await supabase
      .from('lineups')
      .select('lineup_players(*)')
      .eq('club_id', clubId).eq('gameweek', gw).maybeSingle()
    const starterIds = new Set(
      lineup?.lineup_players?.filter((lp: any) => lp.starter).map((lp: any) => lp.player_id) ?? []
    )
    const sorted = [...cp].sort((a: any, b: any) => b.player.market_value - a.player.market_value)
    const autoStarters = new Set(sorted.slice(0, 11).map((c: any) => c.player_id))

    return cp.map((c: any) => ({
      ...c,
      stats: statsMap.get(c.player_id) ?? null,
      starter: starterIds.size > 0 ? starterIds.has(c.player_id) : autoStarters.has(c.player_id),
    }))
  }

  const [homePlayers, awayPlayers] = await Promise.all([
    getClubPlayers(hc.id),
    getClubPlayers(ac.id),
  ])

  return (
    <GameMatchDetail
      match={{ ...match, home_club: hc, away_club: ac }}
      homePlayers={homePlayers}
      awayPlayers={awayPlayers}
      myClubId={myClub?.id ?? null}
      gameweek={gw}
    />
  )
}
