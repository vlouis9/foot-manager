'use server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { computeBotScore, scoreToGoals } from '@/lib/score-engine'
import type { BotPlayerInput } from '@/lib/score-engine'
import { revalidatePath } from 'next/cache'

// Génère des stats aléatoires réalistes pour tous les joueurs d'une journée
export async function generateTestStats(gameweek: number) {
  const supabase = createServerSupabaseClient()
  const { data: players } = await supabase.from('players').select('id, position')
  if (!players?.length) return 0

  const stats = players.map(p => ({
    player_id: p.id,
    gameweek,
    minutes: Math.random() > 0.25
      ? (Math.random() > 0.4 ? 90 : 45 + Math.floor(Math.random() * 44))
      : 0,
    rating: parseFloat((4.0 + Math.random() * 5.0).toFixed(1)),
    goals: Math.random() > 0.88 ? (Math.random() > 0.7 ? 2 : 1) : 0,
    assists: Math.random() > 0.82 ? 1 : 0,
    clean_sheet: Math.random() > 0.55,
    yellow_card: Math.random() > 0.88,
    red_card: Math.random() > 0.97,
  }))

  const { error } = await supabase
    .from('player_real_stats')
    .upsert(stats, { onConflict: 'player_id,gameweek' })

  if (error) throw new Error(`Stats error: ${error.message}`)
  return stats.length
}

// Calcule le score d'un club (bot ou joueur sans compo)
async function calcClubScore(supabase: any, clubId: string, gameweek: number): Promise<number> {
  const { data: cp } = await supabase
    .from('club_players')
    .select('player_id, player:players(position, market_value)')
    .eq('club_id', clubId)

  if (!cp?.length) return 20 + Math.random() * 30

  const playerIds = cp.map((c: any) => c.player_id)
  const { data: stats } = await supabase
    .from('player_real_stats')
    .select('*')
    .eq('gameweek', gameweek)
    .in('player_id', playerIds)

  const statsMap = new Map(stats?.map((s: any) => [s.player_id, s]) ?? [])

  // Vérifier si une composition existe
  const { data: lineup } = await supabase
    .from('lineups')
    .select('id, formation, lineup_players(*)')
    .eq('club_id', clubId)
    .eq('gameweek', gameweek)
    .maybeSingle()

  const sorted = [...cp].sort((a: any, b: any) =>
    b.player.market_value - a.player.market_value
  )

  let starterIds: Set<string>
  if (lineup?.lineup_players?.length) {
    starterIds = new Set(
      lineup.lineup_players.filter((lp: any) => lp.starter).map((lp: any) => lp.player_id)
    )
  } else {
    starterIds = new Set(sorted.slice(0, 11).map((c: any) => c.player_id))
  }

  const inputs: BotPlayerInput[] = sorted.map((c: any, i: number) => ({
    player_id: c.player_id,
    position: c.player.position,
    stats: statsMap.get(c.player_id) ?? {
      id: '',
      player_id: c.player_id,
      gameweek,
      minutes: starterIds.has(c.player_id) ? 90 : 0,
      rating: 5.0,
      goals: 0,
      assists: 0,
      clean_sheet: false,
      yellow_card: false,
      red_card: false,
    },
    market_value: c.player.market_value,
    rank_in_club: i + 1,
  }))

  const seed = clubId.charCodeAt(0) * 31 + clubId.charCodeAt(clubId.length - 1) + gameweek * 17
  return computeBotScore(inputs, seed)
}

// Traite tous les matchs d'une journée
export async function runSimulation(gameweek: number) {
  const supabase = createServerSupabaseClient()

  // 1. Générer les stats
  const count = await generateTestStats(gameweek)

  // 2. Récupérer les matchs non traités
  const { data: matches, error: mErr } = await supabase
    .from('matches')
    .select('id, home_club_id, away_club_id')
    .eq('gameweek', gameweek)
    .eq('processed', false)

  if (mErr) throw new Error(`Matches error: ${mErr.message}`)
  if (!matches?.length) return { count, processed: 0 }

  let processed = 0

  for (const match of matches) {
    const [homeScore, awayScore] = await Promise.all([
      calcClubScore(supabase, match.home_club_id, gameweek),
      calcClubScore(supabase, match.away_club_id, gameweek),
    ])

    const { error: uErr } = await supabase
      .from('matches')
      .update({
        home_score: parseFloat(homeScore.toFixed(2)),
        away_score: parseFloat(awayScore.toFixed(2)),
        processed: true,
      })
      .eq('id', match.id)

    if (uErr) throw new Error(`Update error: ${uErr.message}`)

    // Distribuer paquets journée aux clubs joueurs
    for (const clubId of [match.home_club_id, match.away_club_id]) {
      const { data: club } = await supabase
        .from('clubs').select('is_bot').eq('id', clubId).single()
      if (!club?.is_bot) {
        const myScore = clubId === match.home_club_id ? homeScore : awayScore
        const oppScore = clubId === match.home_club_id ? awayScore : homeScore
        const packType = myScore >= oppScore ? 'journee' : 'standard'
        await supabase.from('card_packs').insert({
          club_id: clubId, type: packType, opened: false,
        })
      }
    }

    // Incrémenter réputation
    if (homeScore > awayScore) {
      const { data: c } = await supabase.from('clubs').select('reputation').eq('id', match.home_club_id).single()
      if (c) await supabase.from('clubs').update({ reputation: Math.min(100, c.reputation + 3) }).eq('id', match.home_club_id)
    } else if (awayScore > homeScore) {
      const { data: c } = await supabase.from('clubs').select('reputation').eq('id', match.away_club_id).single()
      if (c) await supabase.from('clubs').update({ reputation: Math.min(100, c.reputation + 3) }).eq('id', match.away_club_id)
    }

    processed++
  }

  // 3. Avancer la gameweek du joueur
  await supabase
    .from('onboarding_state')
    .update({ current_gameweek: gameweek + 1 })
    .not('user_id', 'is', null)

  revalidatePath('/')
  revalidatePath('/standings')
  revalidatePath('/results')

  return { count, processed }
}
