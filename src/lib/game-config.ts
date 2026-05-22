// Valeurs par défaut si la config n'est pas chargée
export const DEFAULT_CONFIG: Record<string, number> = {
  budget_psg:         500_000,
  budget_top:       1_200_000,
  budget_solide:    1_500_000,
  budget_milieu:    2_000_000,
  budget_outsider:  2_500_000,
  budget_defi:      3_500_000,
  coeff_goal:           3,
  coeff_assist:         1.5,
  coeff_clean_sheet:    1,
  coeff_yellow:        -0.5,
  coeff_red:           -2,
  coeff_starter:        1.0,
  coeff_sub_played:     0.7,
  coeff_sub_bench:      0.2,
  rpg_level_bonus:      0.1,
  rpg_collective_max:   1.0,
  random_factor_min:    0.9,
  random_factor_max:    1.1,
  market_sell_ratio:    0.85,
  market_duration_h:    72,
  draft_cards_count:    25,
}

export type GameConfig = typeof DEFAULT_CONFIG

export async function loadConfig(supabase: any): Promise<GameConfig> {
  const { data } = await supabase.from('game_config').select('key, value')
  if (!data?.length) return DEFAULT_CONFIG
  const config = { ...DEFAULT_CONFIG }
  for (const row of data) {
    config[row.key] = parseFloat(row.value)
  }
  return config
}

export const CLUB_TIER_MAP: Record<string, keyof typeof DEFAULT_CONFIG> = {
  'PSG':        'budget_psg',
  'Monaco':     'budget_top',
  'Marseille':  'budget_top',
  'Lyon':       'budget_top',
  'Lille':      'budget_solide',
  'Nice':       'budget_solide',
  'Lens':       'budget_solide',
  'Rennes':     'budget_solide',
  'Strasbourg': 'budget_milieu',
  'Nantes':     'budget_milieu',
  'Toulouse':   'budget_milieu',
  'Brest':      'budget_milieu',
  'Lorient':    'budget_outsider',
  'Le Havre':   'budget_outsider',
  'Auxerre':    'budget_outsider',
  'Angers':     'budget_outsider',
  'Paris FC':   'budget_defi',
  'Metz':       'budget_defi',
}
