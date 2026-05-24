'use server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { computePlayerScore, computeTeamScore, computeBotTeamScore, scoreToDisplay } from '@/lib/score-engine'
import type { Position, ClubUpgrade, Formation } from '@/types'
import { revalidatePath } from 'next/cache'

// ─── Calcul score club joueur ──────────────────────────────────
async function calcPlayerClubScore(supabase: any, clubId: string, gameweek: number) {
  // Composition validée
  const { data: lineup } = await supabase
    .from('lineups')
    .select('formation, lineup_players(player_id, starter, bench_order)')
    .eq('club_id', clubId).eq('gameweek', gameweek).maybeSingle()

  // Joueurs du club
  const { data: clubPlayers } = await supabase
    .from('club_players')
    .select('player_id, level, bonus_attack, bonus_defense, players(joueurid, position, market_value)')
    .eq('club_id', clubId)

  if (!clubPlayers?.length) return { total_score: 20, goals_real: 0, goals_fictif: 0, goals_total: 0, player_scores: [], collective_bonus: 0, random_factor: 1 }

  // Stats réelles depuis stats_raw
  const joueurids = clubPlayers.map((cp: any) => cp.players?.joueurid).filter(Boolean)
  const { data: rawStats } = await supabase
    .from('stats_raw')
    .select('*')
    .eq('gameweek', gameweek)
    .in('joueurid', joueurids)

  const statsMap = new Map((rawStats ?? []).map((s: any) => [s.joueurid, s]))

  // Upgrades
  const { data: upgrades } = await supabase
    .from('club_upgrades').select('*').eq('club_id', clubId)

  // Déterminer titulaires
  const starterIds = lineup?.lineup_players
    ? new Set(lineup.lineup_players.filter((lp: any) => lp.starter).map((lp: any) => lp.player_id))
    : new Set(clubPlayers.sort((a: any, b: any) => b.players.market_value - a.players.market_value).slice(0, 11).map((cp: any) => cp.player_id))

  const playerResults = clubPlayers.map((cp: any, i: number) => {
    const p       = cp.players
    const joueurid = p?.joueurid
    const stat    = statsMap.get(joueurid) ?? { joueurid, gameweek, played: 0, starter: 0, rating: 0, goals: 0 }
    const isStarter = (starterIds as Set<string>).has(cp.player_id)
    const result  = computePlayerScore(
      { ...stat, starter: isStarter ? 1 : 0 } as any,
      p?.position as Position ?? 'ATT',
      cp.level ?? 1,
      cp.bonus_attack ?? 0,
      cp.bonus_defense ?? 0,
      upgrades ?? [],
      i * 31 + gameweek * 17,
    )
    result.player_id = cp.player_id
    result.lastname  = joueurid?.split(/ATT|MID|DEF|GK/)[0] ?? ''
    return result
  })

  const formation = lineup?.formation ?? '4-3-3'
  const teamResult = computeTeamScore(playerResults, formation as Formation, upgrades ?? [], gameweek * 7)
  return teamResult
}

// ─── Calcul score bot fantôme ──────────────────────────────────
async function calcBotScore(supabase: any, clubId: string, gameweek: number) {
  const { data: botPlayers } = await supabase
    .from('club_players')
    .select('player_id, players(joueurid, position, market_value)')
    .eq('club_id', clubId)

  if (!botPlayers?.length) return { total_score: 15, goals_real: 0, goals_fictif: 0, goals_total: 0, player_scores: [], collective_bonus: 0, random_factor: 1 }

  const joueurids = botPlayers.map((cp: any) => cp.players?.joueurid).filter(Boolean)
  const { data: rawStats } = await supabase
    .from('stats_raw').select('*').eq('gameweek', gameweek).in('joueurid', joueurids)

  const players = botPlayers.map((cp: any) => ({
    joueurid:     cp.players?.joueurid ?? '',
    position:     cp.players?.position as Position ?? 'ATT',
    market_value: cp.players?.market_value ?? 0,
  }))

  const seed = clubId.charCodeAt(0) + gameweek * 13
  return computeBotTeamScore(rawStats ?? [], players, seed)
}

// ─── Traiter une journée ───────────────────────────────────────
export async function runSimulation(gameweek: number) {
  const supabase = createServerSupabaseClient()

  // Vérifier qu'il y a des stats pour cette journée
  const { count: statsCount } = await supabase
    .from('stats_raw')
    .select('*', { count: 'exact', head: true })
    .eq('gameweek', gameweek)
    .eq('played', 1)

  if (!statsCount || statsCount === 0) {
    throw new Error(`Aucune stat importée pour la journée ${gameweek}. Importe d'abord les stats via Admin → Données.`)
  }

  // Matchs non traités
  const { data: matches } = await supabase
    .from('matches')
    .select('id, home_club_id, away_club_id')
    .eq('gameweek', gameweek)
    .eq('processed', false)

  if (!matches?.length) return { count: statsCount, processed: 0 }

  let processed = 0

  for (const match of matches) {
    // Déterminer si chaque club est un bot
    const [homeClubData, awayClubData] = await Promise.all([
      supabase.from('clubs').select('is_bot, user_id').eq('id', match.home_club_id).single(),
      supabase.from('clubs').select('is_bot, user_id').eq('id', match.away_club_id).single(),
    ])

    const homeIsBot = homeClubData.data?.is_bot ?? true
    const awayIsBot = awayClubData.data?.is_bot ?? true

    const [homeResult, awayResult] = await Promise.all([
      homeIsBot
        ? calcBotScore(supabase, match.home_club_id, gameweek)
        : calcPlayerClubScore(supabase, match.home_club_id, gameweek),
      awayIsBot
        ? calcBotScore(supabase, match.away_club_id, gameweek)
        : calcPlayerClubScore(supabase, match.away_club_id, gameweek),
    ])

    const display = scoreToDisplay(homeResult, awayResult)

    // Sauvegarder le match avec tous les détails
    await supabase.from('matches').update({
      home_score:        homeResult.total_score,
      away_score:        awayResult.total_score,
      home_goals:        homeResult.goals_total,
      away_goals:        awayResult.goals_total,
      home_goals_real:   homeResult.goals_real,
      away_goals_real:   awayResult.goals_real,
      home_goals_fictif: homeResult.goals_fictif,
      away_goals_fictif: awayResult.goals_fictif,
      processed:         true,
    }).eq('id', match.id)

    // Sauvegarder scores joueurs dans player_real_stats
    for (const pr of homeResult.player_scores.concat(awayResult.player_scores)) {
      if (!pr.player_id || !pr.played) continue
      await supabase.from('player_real_stats').upsert({
        player_id:     pr.player_id,
        gameweek,
        minutes:       pr.starter ? 90 : 45,
        rating:        pr.rating,
        goals:         pr.goals_real,
        assists:       0,
        clean_sheet:   false,
        yellow_card:   false,
        red_card:      false,
        goals_real:    pr.goals_real,
        goals_fictif:  pr.goals_fictif,
        score_base:    pr.score_base,
        score_bonus:   pr.score_bonus,
      }, { onConflict: 'player_id,gameweek' })
    }

    // Paquets journée pour clubs joueurs
    for (const [clubId, result] of [
      [match.home_club_id, homeResult],
      [match.away_club_id, awayResult],
    ] as [string, typeof homeResult][]) {
      const clubInfo = clubId === match.home_club_id ? homeClubData.data : awayClubData.data
      if (!clubInfo?.is_bot) {
        const otherGoals = clubId === match.home_club_id ? awayResult.goals_total : homeResult.goals_total
        const myGoals    = result.goals_total
        const packType   = myGoals >= otherGoals ? 'journee' : 'standard'
        await supabase.from('card_packs').insert({ club_id: clubId, type: packType, opened: false })
      }
    }

    processed++
  }

  // Avancer la gameweek
  await supabase.from('onboarding_state')
    .update({ current_gameweek: gameweek + 1 })
    .not('user_id', 'is', null)

  revalidatePath('/')
  revalidatePath('/game/results')
  return { count: statsCount, processed }
}
