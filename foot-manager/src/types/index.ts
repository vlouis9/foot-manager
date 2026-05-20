// ─── Joueur ────────────────────────────────────────────────────────────────
export type Position = 'GK' | 'DEF' | 'MID' | 'ATT'
export type AvailabilityStatus = 'available' | 'expensive' | 'locked' | 'opportunity'

export interface Player {
  id: string
  real_team: string
  firstname: string
  lastname: string
  position: Position
  age: number
  market_value: number
  salary: number
  availability_status: AvailabilityStatus
}

// ─── Club ──────────────────────────────────────────────────────────────────
export interface Club {
  id: string
  user_id: string
  name: string
  budget: number
  wage_budget: number
  reputation: number
  is_bot: boolean
  created_at: string
}

// ─── Joueur dans un club ───────────────────────────────────────────────────
export interface ClubPlayer {
  id: string
  club_id: string
  player_id: string
  xp: number
  level: number
  bonus_attack: number
  bonus_defense: number
  bonus_collective: number
  player?: Player
}

// ─── Stats réelles par journée ─────────────────────────────────────────────
export interface PlayerRealStats {
  id: string
  player_id: string
  gameweek: number
  minutes: number
  rating: number
  goals: number
  assists: number
  clean_sheet: boolean
  yellow_card: boolean
  red_card: boolean
}

// ─── Composition ──────────────────────────────────────────────────────────
export interface Lineup {
  id: string
  club_id: string
  gameweek: number
  formation: Formation
  locked: boolean
}

export interface LineupPlayer {
  id: string
  lineup_id: string
  player_id: string
  starter: boolean
  bench_order: number | null
  player?: Player
  club_player?: ClubPlayer
}

export type Formation = '4-3-3' | '4-4-2' | '3-5-2' | '4-2-3-1' | '5-3-2'

// ─── Match ─────────────────────────────────────────────────────────────────
export interface Match {
  id: string
  gameweek: number
  home_club_id: string
  away_club_id: string
  home_score: number | null
  away_score: number | null
  processed: boolean
  home_club?: Club
  away_club?: Club
}

// ─── Upgrades RPG ─────────────────────────────────────────────────────────
export type UpgradeType = 'offense_center' | 'defense_center' | 'tactical_room' | 'academy'

export interface ClubUpgrade {
  id: string
  club_id: string
  type: UpgradeType
  level: number
}

// ─── Marché ────────────────────────────────────────────────────────────────
export interface Market {
  id: string
  player_id: string
  price: number
  availability: AvailabilityStatus
  expires_at: string
  player?: Player
}

// ─── Paquets ───────────────────────────────────────────────────────────────
export type PackType = 'standard' | 'journee' | 'prestige'

export interface CardPack {
  id: string
  club_id: string
  type: PackType
  opened: boolean
  created_at: string
}

// ─── Événements ────────────────────────────────────────────────────────────
export type EventType = 'sponsor_bonus' | 'tactical_camp' | 'market_discount' | 'training_boost'

export interface DailyEvent {
  id: string
  club_id: string
  type: EventType
  value: number
  expires_at: string
}

// ─── Score Engine ──────────────────────────────────────────────────────────
export interface PlayerScoreInput {
  player_id: string
  position: Position
  stats: PlayerRealStats
  level: number
  bonus_attack: number
  bonus_defense: number
  starter: boolean
  bench_order: number | null
  upgrades: ClubUpgrade[]
}

export interface TeamScoreResult {
  total: number
  player_scores: { player_id: string; score: number; coefficient: number }[]
  collective_bonus: number
  rpg_bonus: number
  random_factor: number
}

// ─── Classement ────────────────────────────────────────────────────────────
export interface StandingRow {
  club_id: string
  club_name: string
  played: number
  won: number
  drawn: number
  lost: number
  goals_for: number
  goals_against: number
  points: number
  is_player: boolean
}

// ─── Onboarding ────────────────────────────────────────────────────────────
export interface ClubConfig {
  name: string
  initial_budget: number
}

export const CLUB_CONFIGS: Record<string, ClubConfig> = {
  'PSG':        { name: 'PSG',        initial_budget: 500_000 },
  'Monaco':     { name: 'Monaco',     initial_budget: 1_200_000 },
  'Marseille':  { name: 'Marseille',  initial_budget: 1_200_000 },
  'Lyon':       { name: 'Lyon',       initial_budget: 1_200_000 },
  'Lille':      { name: 'Lille',      initial_budget: 1_500_000 },
  'Nice':       { name: 'Nice',       initial_budget: 1_500_000 },
  'Lens':       { name: 'Lens',       initial_budget: 1_800_000 },
  'Rennes':     { name: 'Rennes',     initial_budget: 1_800_000 },
  'Strasbourg': { name: 'Strasbourg', initial_budget: 2_000_000 },
  'Nantes':     { name: 'Nantes',     initial_budget: 2_000_000 },
  'Toulouse':   { name: 'Toulouse',   initial_budget: 2_000_000 },
  'Brest':      { name: 'Brest',      initial_budget: 2_200_000 },
  'Lorient':    { name: 'Lorient',    initial_budget: 2_500_000 },
  'Le Havre':   { name: 'Le Havre',   initial_budget: 2_500_000 },
  'Auxerre':    { name: 'Auxerre',    initial_budget: 2_500_000 },
  'Angers':     { name: 'Angers',     initial_budget: 2_500_000 },
  'Paris FC':   { name: 'Paris FC',   initial_budget: 3_000_000 },
  'Metz':       { name: 'Metz',       initial_budget: 3_500_000 },
}
