'use server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  computeTeamScore,
  computeBotScore,
  scoreToGoals,
  getMatchResult,
} from '@/lib/score-engine'
import type { PlayerScoreInput, Formation } from '@/types'
import type { BotPlayerInput } from '@/lib/score-engine'
import { revalidatePath } from 'next/cache'

// ── Simuler une journée complète ──────────────────────────────
export async function processGameweek(gameweek: number) {
  const supabase = createServerSupabaseClient()

  // 1. Récupérer tous les matchs non traités de cette journée
  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .eq('gameweek', gameweek)
    .eq('processed', false)

  if (!matches?.length) return { processed: 0 }

  // 2. Récupérer les stats réelles de cette journée
  const { data: allStats } = await supabase
    .from('player_real_stats')
    .select('*')
    .eq('gameweek', gameweek)

  const statsMap = new Map(allStats?.map(s => [s.player_id, s]) ?? [])

  let processed = 0

  for (const match of matches) {
    const homeScore = await computeClubScore(supabase, match.home_club_id, gameweek, statsMap)
    const awayScore = await computeClubScore(supabase, match.away_club_id, gameweek, statsMap)

    const homeGoals = scoreToGoals(homeScore)
    const awayGoals = scoreToGoals(awayScore)

    // Mettre à jour le match
    await supabase.from('matches').update({
      home_score: homeScore,
      away_score: awayScore,
      processed: true,
    }).eq('id', match.id)

    // Mettre à jour les stats des clubs (réputation)
    const result = getMatchResult(homeScore, awayScore)
    const homePoints = result === 'home' ? 3 : result === 'draw' ? 1 : 0
    const awayPoints = result === 'away' ? 3 : result === 'draw' ? 1 : 0

    if (homePoints > 0) {
      await supabase.rpc('increment_reputation', { club_id: match.home_club_id, amount: homePoints })
    }
    if (awayPoints > 0) {
      await supabase.rpc('increment_reputation', { club_id: match.away_club_id, amount: awayPoints })
    }

    // Distribuer les paquets journée aux clubs joueurs
    await distributeJourneePacks(supabase, match, homePoints, awayPoints)

    processed++
  }

  // 3. Avancer la gameweek
  await supabase.from('onboarding_state')
    .update({ current_gameweek: gameweek + 1 })
    .gt('current_gameweek', 0) // tous les joueurs

  revalidatePath('/')
  revalidatePath('/standings')
  return { processed }
}

async function computeClubScore(
  supabase: any,
  clubId: string,
  gameweek: number,
  statsMap: Map<string, any>
): Promise<number> {
  // Vérifier si c'est un club bot
  const { data: club } = await supabase
    .from('clubs').select('is_bot').eq('id', clubId).single()

  if (club?.is_bot) {
    // Score bot fantôme
    const { data: botPlayers } = await supabase
      .from('club_players')
      .select('player_id, player:players(position, market_value)')
      .eq('club_id', clubId)

    if (!botPlayers?.length) return 0

    const sorted = [...botPlayers].sort(
      (a: any, b: any) => b.player.market_value - a.player.market_value
    )

    const inputs: BotPlayerInput[] = sorted.map((cp: any, i: number) => ({
      player_id: cp.player_id,
      position: cp.player.position,
      stats: statsMap.get(cp.player_id) ?? {
        player_id: cp.player_id, gameweek,
        minutes: Math.random() > 0.3 ? 90 : 0,
        rating: 4.5 + Math.random() * 3,
        goals: 0, assists: 0, clean_sheet: false,
        yellow_card: false, red_card: false,
      },
      market_value: cp.player.market_value,
      rank_in_club: i + 1,
    }))

    const seed = clubId.charCodeAt(0) + gameweek * 17
    return computeBotScore(inputs, seed)
  }

  // Score club joueur
  const { data: lineup } = await supabase
    .from('lineups')
    .select('*, lineup_players(*)')
    .eq('club_id', clubId)
    .eq('gameweek', gameweek)
    .single()

  if (!lineup) {
    // Pas de composition : auto-sélection des meilleurs joueurs
    return await computeAutoScore(supabase, clubId, gameweek, statsMap)
  }

  const { data: upgrades } = await supabase
    .from('club_upgrades').select('*').eq('club_id', clubId)

  const lp = lineup.lineup_players ?? []
  const inputs: PlayerScoreInput[] = []

  for (const entry of lp) {
    const { data: cp } = await supabase
      .from('club_players')
      .select('*, player:players(*)')
      .eq('club_id', clubId)
      .eq('player_id', entry.player_id)
      .single()
    if (!cp) continue

    const stats = statsMap.get(entry.player_id) ?? {
      player_id: entry.player_id, gameweek,
      minutes: entry.starter ? 90 : 0,
      rating: 5.0, goals: 0, assists: 0,
      clean_sheet: false, yellow_card: false, red_card: false,
    }

    inputs.push({
      player_id: entry.player_id,
      position: cp.player.position,
      stats,
      level: cp.level,
      bonus_attack: cp.bonus_attack,
      bonus_defense: cp.bonus_defense,
      starter: entry.starter,
      bench_order: entry.bench_order,
      upgrades: upgrades ?? [],
    })
  }

  if (!inputs.length) return 0

  const seed = clubId.charCodeAt(0) + gameweek * 13
  const result = computeTeamScore(inputs, lineup.formation as Formation, upgrades ?? [], seed)
  return result.total
}

async function computeAutoScore(
  supabase: any, clubId: string, gameweek: number,
  statsMap: Map<string, any>
): Promise<number> {
  const { data: clubPlayers } = await supabase
    .from('club_players')
    .select('*, player:players(*)')
    .eq('club_id', clubId)
  if (!clubPlayers?.length) return 0

  const sorted = [...clubPlayers].sort(
    (a: any, b: any) => b.player.market_value - a.player.market_value
  )
  const inputs: BotPlayerInput[] = sorted.map((cp: any, i: number) => ({
    player_id: cp.player_id,
    position: cp.player.position,
    stats: statsMap.get(cp.player_id) ?? {
      player_id: cp.player_id, gameweek,
      minutes: i < 11 ? 90 : 0,
      rating: 5.0 + Math.random() * 2, goals: 0, assists: 0,
      clean_sheet: false, yellow_card: false, red_card: false,
    },
    market_value: cp.player.market_value,
    rank_in_club: i + 1,
  }))

  const seed = clubId.charCodeAt(0) + gameweek * 7
  return computeBotScore(inputs, seed)
}

async function distributeJourneePacks(
  supabase: any, match: any, homePoints: number, awayPoints: number
) {
  // Paquet journée pour les clubs joueurs selon le résultat
  for (const [clubId, pts] of [
    [match.home_club_id, homePoints],
    [match.away_club_id, awayPoints],
  ]) {
    const { data: club } = await supabase
      .from('clubs').select('is_bot').eq('id', clubId).single()
    if (club?.is_bot) continue

    const packType = pts === 3 ? 'journee' : pts === 1 ? 'journee' : 'standard'
    await supabase.from('card_packs').insert({
      club_id: clubId,
      type: packType,
      opened: false,
    })
  }
}

// ── Générer des stats simulées pour tester ────────────────────
export async function generateTestStats(gameweek: number) {
  const supabase = createServerSupabaseClient()

  const { data: players } = await supabase
    .from('players').select('id, position')

  if (!players?.length) return

  const stats = players.map(p => ({
    player_id: p.id,
    gameweek,
    minutes: Math.random() > 0.25 ? (Math.random() > 0.5 ? 90 : 45 + Math.floor(Math.random() * 45)) : 0,
    rating: parseFloat((4 + Math.random() * 5).toFixed(1)),
    goals: Math.random() > 0.85 ? Math.floor(Math.random() * 3) : 0,
    assists: Math.random() > 0.80 ? Math.floor(Math.random() * 2) : 0,
    clean_sheet: Math.random() > 0.6,
    yellow_card: Math.random() > 0.9,
    red_card: Math.random() > 0.97,
  }))

  await supabase.from('player_real_stats').upsert(stats, { onConflict: 'player_id,gameweek' })
  return stats.length
}
