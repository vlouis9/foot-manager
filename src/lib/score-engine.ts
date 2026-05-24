import type { Position, ClubUpgrade, Formation } from '@/types'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface RawStat {
  joueurid:  string
  gameweek:  number
  played:    number   // 0 ou 1
  starter:   number   // 0 ou 1
  rating:    number   // note MPG (0 si non joué)
  goals:     number   // buts réels
}

export interface PlayerScoreResult {
  player_id:     string
  joueurid:      string
  lastname:      string
  position:      Position
  starter:       boolean
  played:        boolean
  rating:        number        // note brute
  goals_real:    number        // buts réels
  goals_fictif:  number        // buts fictifs calculés
  score_base:    number        // note × coeff (avant bonus)
  score_bonus:   number        // bonus RPG appliqués
  score_total:   number        // score_base + score_bonus
}

export interface TeamScoreResult {
  player_scores:     PlayerScoreResult[]
  total_score:       number
  goals_real:        number   // somme buts réels
  goals_fictif:      number   // buts fictifs d'équipe
  goals_total:       number   // pour l'affichage match
  collective_bonus:  number
  random_factor:     number
}

// ═══════════════════════════════════════════════════════════════
// BUTS FICTIFS (style MPG)
// ═══════════════════════════════════════════════════════════════
// Probabilité de marquer un but fictif basée sur la note
function computeFictifGoals(rating: number, position: Position, seed: number): number {
  if (rating <= 0) return 0
  // Seuils MPG approximatifs
  // ATT : note ≥ 7 = 30% de chance, ≥ 8 = 60%, ≥ 9 = 100%
  // MID : note ≥ 7.5 = 20%, ≥ 9 = 50%
  // DEF/GK : très rare
  const rng = seededRandom(seed)
  let threshold: number
  if      (position === 'ATT') threshold = rating >= 9 ? 1.0 : rating >= 8 ? 0.6 : rating >= 7 ? 0.3 : 0
  else if (position === 'MID') threshold = rating >= 9 ? 0.5 : rating >= 7.5 ? 0.2 : 0
  else                          threshold = rating >= 9 ? 0.15 : 0
  return rng < threshold ? 1 : 0
}

// ═══════════════════════════════════════════════════════════════
// SCORE INDIVIDUEL
// ═══════════════════════════════════════════════════════════════
export function computePlayerScore(
  stat:        RawStat,
  position:    Position,
  level:       number,
  bonusAtk:    number,
  bonusDef:    number,
  upgrades:    ClubUpgrade[],
  seed:        number,
): PlayerScoreResult {
  const played  = stat.played === 1
  const starter = stat.starter === 1

  if (!played) {
    return {
      player_id: '', joueurid: stat.joueurid, lastname: '', position,
      starter: false, played: false,
      rating: 0, goals_real: 0, goals_fictif: 0,
      score_base: 0, score_bonus: 0, score_total: 0,
    }
  }

  // Coefficient selon titulaire / remplaçant
  const coeff = starter ? 1.0 : 0.5   // remplaçants divisés par 2

  // Score de base = note × coeff
  let score_base = stat.rating * coeff

  // Buts fictifs
  const goals_fictif = computeFictifGoals(stat.rating, position, seed)

  // ── Bonus RPG ───────────────────────────────────────────────
  let score_bonus = 0
  score_bonus += level * 0.1
  score_bonus += bonusAtk
  score_bonus += bonusDef

  // Bonus upgrades
  const offUp = upgrades.find(u => u.type === 'offense_center')
  const defUp = upgrades.find(u => u.type === 'defense_center')
  if (offUp && offUp.level > 0 && (position === 'MID' || position === 'ATT')) {
    score_bonus += offUp.level * 0.15
  }
  if (defUp && defUp.level > 0 && (position === 'GK' || position === 'DEF')) {
    score_bonus += defUp.level * 0.15
  }

  const score_total = score_base + score_bonus

  return {
    player_id: '', joueurid: stat.joueurid, lastname: '', position,
    starter, played,
    rating:       stat.rating,
    goals_real:   stat.goals,
    goals_fictif,
    score_base:   parseFloat(score_base.toFixed(3)),
    score_bonus:  parseFloat(score_bonus.toFixed(3)),
    score_total:  parseFloat(score_total.toFixed(3)),
  }
}

// ═══════════════════════════════════════════════════════════════
// SCORE D'ÉQUIPE
// ═══════════════════════════════════════════════════════════════
export function computeTeamScore(
  playerResults: PlayerScoreResult[],
  formation:     Formation,
  upgrades:      ClubUpgrade[],
  seed:          number,
): TeamScoreResult {
  const played = playerResults.filter(p => p.played)

  // Bonus collectif (staff tactique)
  let collective_bonus = 0
  const tactStaff = upgrades.find(u => u.type === 'tactical_staff')
  const tactRoom  = upgrades.find(u => u.type === 'tactical_room')
  if (tactStaff && tactStaff.level > 0) collective_bonus += tactStaff.level * 0.2
  if (tactRoom  && tactRoom.level  > 0) collective_bonus += tactRoom.level  * 0.2
  // Max +1.0 pt
  collective_bonus = Math.min(1.0, collective_bonus)

  const total_score = played.reduce((s, p) => s + p.score_total, 0) + collective_bonus
  const goals_real  = played.reduce((s, p) => s + p.goals_real, 0)
  const goals_fictif = played.reduce((s, p) => s + p.goals_fictif, 0)

  // Random factor ±10%
  const random_factor = 0.9 + seededRandom(seed + 99) * 0.2

  return {
    player_scores:    playerResults,
    total_score:      parseFloat((total_score * random_factor).toFixed(2)),
    goals_real,
    goals_fictif,
    goals_total:      goals_real + goals_fictif,
    collective_bonus: parseFloat(collective_bonus.toFixed(2)),
    random_factor:    parseFloat(random_factor.toFixed(3)),
  }
}

// ═══════════════════════════════════════════════════════════════
// BOT FANTÔME (sans RPG, avec vraies stats)
// ═══════════════════════════════════════════════════════════════
export function computeBotTeamScore(
  stats:    RawStat[],
  players:  { joueurid: string; position: Position; market_value: number }[],
  seed:     number,
): TeamScoreResult {
  // Top 11 par valeur = titulaires supposés
  const sorted     = [...players].sort((a, b) => b.market_value - a.market_value)
  const starterIds = new Set(sorted.slice(0, 11).map(p => p.joueurid))

  const playerResults: PlayerScoreResult[] = stats.map(stat => {
    const player = players.find(p => p.joueurid === stat.joueurid)
    const pos    = player?.position ?? 'ATT'
    const isStarter = starterIds.has(stat.joueurid)
    const played = stat.played === 1

    if (!played) return {
      player_id: '', joueurid: stat.joueurid, lastname: '', position: pos,
      starter: isStarter, played: false,
      rating: 0, goals_real: 0, goals_fictif: 0,
      score_base: 0, score_bonus: 0, score_total: 0,
    }

    const coeff        = isStarter ? 1.0 : 0.5
    const score_base   = stat.rating * coeff
    const goals_fictif = computeFictifGoals(stat.rating, pos, seed + stat.goals)

    return {
      player_id: '', joueurid: stat.joueurid, lastname: '', position: pos,
      starter: isStarter, played,
      rating:      stat.rating,
      goals_real:  stat.goals,
      goals_fictif,
      score_base:  parseFloat(score_base.toFixed(3)),
      score_bonus: 0,
      score_total: parseFloat(score_base.toFixed(3)),
    }
  })

  const played       = playerResults.filter(p => p.played)
  const total_score  = played.reduce((s, p) => s + p.score_total, 0)
  const goals_real   = played.reduce((s, p) => s + p.goals_real, 0)
  const goals_fictif = played.reduce((s, p) => s + p.goals_fictif, 0)
  const random_factor = 0.9 + seededRandom(seed) * 0.2

  return {
    player_scores:   playerResults,
    total_score:     parseFloat((total_score * random_factor).toFixed(2)),
    goals_real,
    goals_fictif,
    goals_total:     goals_real + goals_fictif,
    collective_bonus: 0,
    random_factor:   parseFloat(random_factor.toFixed(3)),
  }
}

// ═══════════════════════════════════════════════════════════════
// UTILITAIRES
// ═══════════════════════════════════════════════════════════════
function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000
  return x - Math.floor(x)
}

export function scoreToDisplay(homeResult: TeamScoreResult, awayResult: TeamScoreResult) {
  return {
    home: {
      goals:    homeResult.goals_total,
      goals_real:   homeResult.goals_real,
      goals_fictif: homeResult.goals_fictif,
      score:    homeResult.total_score,
    },
    away: {
      goals:    awayResult.goals_total,
      goals_real:   awayResult.goals_real,
      goals_fictif: awayResult.goals_fictif,
      score:    awayResult.total_score,
    },
    winner: homeResult.goals_total > awayResult.goals_total ? 'home'
           : homeResult.goals_total < awayResult.goals_total ? 'away' : 'draw',
  }
}

// Export legacy pour compatibilité
export type { ClubUpgrade, Formation, Position }
export interface BotPlayerInput {
  player_id: string; position: Position; stats: any; market_value: number; rank_in_club: number
}
export function computeBotScore(players: BotPlayerInput[], seed: number): number {
  return players.reduce((sum, p) => {
    if (!p.stats || p.stats.minutes === 0) return sum
    const coeff = p.rank_in_club <= 11 ? 1.0 : 0.4
    let s = (p.stats.rating ?? 5)
    s += (p.stats.goals ?? 0) * 3
    return sum + s * coeff
  }, 0) * (0.9 + seededRandom(seed) * 0.2)
}
