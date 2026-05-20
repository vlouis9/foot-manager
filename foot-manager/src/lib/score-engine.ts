import type {
  PlayerRealStats,
  Position,
  ClubUpgrade,
  TeamScoreResult,
  PlayerScoreInput,
  Formation,
} from '@/types'

// ═══════════════════════════════════════════════════════════════
// COEFFICIENTS
// ═══════════════════════════════════════════════════════════════

/** Coefficient selon le statut en jeu */
function getCoefficient(stats: PlayerRealStats, starter: boolean, bench_order: number | null): number {
  if (starter) {
    return stats.minutes >= 45 ? 1.0 : 0.0 // remplacé automatiquement si < 45 min
  }
  // Remplaçant
  if (stats.minutes > 0) return 0.7  // est entré en jeu
  if (bench_order !== null) return 0.2 // sur le banc, pas utilisé
  return 0
}

// ═══════════════════════════════════════════════════════════════
// SCORE INDIVIDUEL D'UN JOUEUR
// ═══════════════════════════════════════════════════════════════

export function computePlayerScore(input: PlayerScoreInput): number {
  const { stats, position, level, bonus_attack, bonus_defense, starter, bench_order, upgrades } = input

  if (!stats) return 0

  const coeff = getCoefficient(stats, starter, bench_order)
  if (coeff === 0) return 0

  // Score de base
  let score = stats.rating
  score += stats.goals * 3
  score += stats.assists * 1.5
  if (stats.clean_sheet && (position === 'GK' || position === 'DEF')) {
    score += 1
  }
  if (stats.yellow_card) score -= 0.5
  if (stats.red_card)    score -= 2

  // Bonus RPG joueur
  const rpg_bonus = level * 0.1 + bonus_attack + bonus_defense
  score += rpg_bonus

  // Bonus upgrades club
  const offenseUpgrade = upgrades.find(u => u.type === 'offense_center')
  const defenseUpgrade  = upgrades.find(u => u.type === 'defense_center')

  if (offenseUpgrade && (position === 'MID' || position === 'ATT')) {
    score += offenseUpgrade.level * 0.15
  }
  if (defenseUpgrade && (position === 'GK' || position === 'DEF')) {
    score += defenseUpgrade.level * 0.15
  }

  return Math.max(0, score * coeff)
}

// ═══════════════════════════════════════════════════════════════
// BONUS COLLECTIF
// ═══════════════════════════════════════════════════════════════

function computeCollectiveBonus(
  inputs: PlayerScoreInput[],
  formation: Formation,
  upgrades: ClubUpgrade[]
): number {
  let bonus = 0
  const starters = inputs.filter(i => i.starter)

  // Synergy défensive : ≥4 DEF avec rating ≥ 6
  const goodDefs = starters.filter(
    i => i.position === 'DEF' && i.stats?.rating >= 6
  ).length
  if (goodDefs >= 4) bonus += 0.5

  // Contrôle milieu : ≥3 MID avec rating ≥ 6
  const goodMids = starters.filter(
    i => i.position === 'MID' && i.stats?.rating >= 6
  ).length
  if (goodMids >= 3) bonus += 0.5

  // Bonus tactical_room si formation respectée
  const tacticalUpgrade = upgrades.find(u => u.type === 'tactical_room')
  if (tacticalUpgrade && tacticalUpgrade.level > 0) {
    bonus += tacticalUpgrade.level * 0.2
  }

  return bonus
}

// ═══════════════════════════════════════════════════════════════
// SCORE D'ÉQUIPE HUMAINE
// ═══════════════════════════════════════════════════════════════

export function computeTeamScore(
  inputs: PlayerScoreInput[],
  formation: Formation,
  upgrades: ClubUpgrade[],
  seed?: number
): TeamScoreResult {
  const player_scores = inputs.map(input => ({
    player_id: input.player_id,
    score: computePlayerScore(input),
    coefficient: getCoefficient(input.stats, input.starter, input.bench_order),
  }))

  const base_total = player_scores.reduce((sum, p) => sum + p.score, 0)
  const collective_bonus = computeCollectiveBonus(inputs, formation, upgrades)
  const rpg_bonus = 0 // déjà inclus dans computePlayerScore

  // Random factor 0.9–1.1 (déterministe si seed fourni)
  const random_factor = seed !== undefined
    ? 0.9 + (seededRandom(seed) * 0.2)
    : 0.9 + Math.random() * 0.2

  const total = (base_total + collective_bonus) * random_factor

  return {
    total: Math.max(0, total),
    player_scores,
    collective_bonus,
    rpg_bonus,
    random_factor,
  }
}

// ═══════════════════════════════════════════════════════════════
// SCORE BOT FANTÔME
// ═══════════════════════════════════════════════════════════════

export interface BotPlayerInput {
  player_id: string
  position: Position
  stats: PlayerRealStats
  market_value: number
  rank_in_club: number // 1-11 = titulaire supposé, 12+ = remplaçant
}

export function computeBotScore(
  players: BotPlayerInput[],
  seed: number
): number {
  const sorted = [...players].sort((a, b) => b.market_value - a.market_value)

  let total = 0
  for (const p of sorted) {
    if (!p.stats) continue

    let score = p.stats.rating
    score += p.stats.goals * 3
    score += p.stats.assists * 1.5
    if (p.stats.clean_sheet && (p.position === 'GK' || p.position === 'DEF')) {
      score += 1
    }
    if (p.stats.yellow_card) score -= 0.5
    if (p.stats.red_card)    score -= 2

    // Coefficient selon rang dans le club
    const coeff = p.rank_in_club <= 11
      ? (p.stats.minutes >= 45 ? 1.0 : 0.4)
      : p.stats.minutes > 0 ? 0.4 : 0.2

    total += Math.max(0, score) * coeff
  }

  const random_factor = 0.9 + (seededRandom(seed) * 0.2)
  return Math.max(0, total * random_factor)
}

// ═══════════════════════════════════════════════════════════════
// UTILITAIRES
// ═══════════════════════════════════════════════════════════════

/** Générateur pseudo-aléatoire déterministe (pour reproductibilité) */
function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000
  return x - Math.floor(x)
}

/** Convertit le score en résultat de match (buts fictifs) */
export function scoreToGoals(score: number): number {
  if (score >= 70) return 4
  if (score >= 55) return 3
  if (score >= 42) return 2
  if (score >= 30) return 1
  return 0
}

/** Détermine le résultat (V/N/D) */
export function getMatchResult(homeScore: number, awayScore: number): 'home' | 'away' | 'draw' {
  const diff = homeScore - awayScore
  if (Math.abs(diff) < 5) return 'draw'
  return diff > 0 ? 'home' : 'away'
}

/** Points de classement selon résultat */
export function getPoints(result: 'win' | 'draw' | 'loss'): number {
  return result === 'win' ? 3 : result === 'draw' ? 1 : 0
}
