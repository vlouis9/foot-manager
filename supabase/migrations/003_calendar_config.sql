-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 003 — Calendrier, config jeu, nouvelles infras
-- À exécuter dans Supabase > SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ─── TABLE CALENDRIER ─────────────────────────────────────────
create table if not exists calendar (
  id            uuid primary key default uuid_generate_v4(),
  gameweek      integer not null,
  match_date    timestamptz not null,
  home_team     text not null,
  away_team     text not null,
  created_at    timestamptz default now()
);

create index if not exists calendar_gameweek_idx on calendar(gameweek);
create index if not exists calendar_date_idx on calendar(match_date);

alter table calendar enable row level security;
create policy "calendar_read" on calendar for select using (true);
create policy "calendar_insert" on calendar for insert with check (true);
create policy "calendar_delete" on calendar for delete using (true);

-- ─── TABLE CONFIG JEU ─────────────────────────────────────────
create table if not exists game_config (
  key   text primary key,
  value jsonb not null,
  label text not null,
  category text not null default 'general'
);

alter table game_config enable row level security;
create policy "config_read"   on game_config for select using (true);
create policy "config_write"  on game_config for all using (true);

-- Valeurs par défaut
insert into game_config (key, value, label, category) values
  -- Budgets initiaux
  ('budget_psg',        '500000',   'Budget PSG (€)',         'budgets'),
  ('budget_top',        '1200000',  'Budget Top clubs (€)',   'budgets'),
  ('budget_solide',     '1500000',  'Budget clubs solides (€)','budgets'),
  ('budget_milieu',     '2000000',  'Budget clubs milieu (€)','budgets'),
  ('budget_outsider',   '2500000',  'Budget outsiders (€)',   'budgets'),
  ('budget_defi',       '3500000',  'Budget clubs défi (€)',  'budgets'),
  -- Coefficients de score
  ('coeff_goal',        '3',        'Points par but',          'scoring'),
  ('coeff_assist',      '1.5',      'Points par passe déc.',   'scoring'),
  ('coeff_clean_sheet', '1',        'Points clean sheet (GK/DEF)', 'scoring'),
  ('coeff_yellow',      '-0.5',     'Pénalité carton jaune',   'scoring'),
  ('coeff_red',         '-2',       'Pénalité carton rouge',   'scoring'),
  ('coeff_starter',     '1.0',      'Coeff titulaire',         'scoring'),
  ('coeff_sub_played',  '0.7',      'Coeff remplaçant entrant','scoring'),
  ('coeff_sub_bench',   '0.2',      'Coeff remplaçant non utilisé','scoring'),
  -- RPG
  ('rpg_level_bonus',   '0.1',      'Bonus par niveau joueur', 'rpg'),
  ('rpg_collective_max','1.0',      'Bonus collectif max (pts)','rpg'),
  ('random_factor_min', '0.9',      'Facteur aléatoire min',   'scoring'),
  ('random_factor_max', '1.1',      'Facteur aléatoire max',   'scoring'),
  -- Marché
  ('market_sell_ratio', '0.85',     'Ratio vente (% valeur)',  'market'),
  ('market_duration_h', '72',       'Durée offre marché (h)',  'market'),
  ('draft_cards_count', '25',       'Cartes tirées au draft',  'onboarding')
on conflict (key) do nothing;

-- ─── NOUVELLES INFRASTRUCTURES ────────────────────────────────
-- Mettre à jour le check pour inclure les nouvelles infras
alter table club_upgrades drop constraint if exists club_upgrades_type_check;
alter table club_upgrades add constraint club_upgrades_type_check
  check (type in (
    'offense_center',
    'defense_center',
    'tactical_room',
    'academy',
    'training_center',
    'stadium',
    'tactical_staff'
  ));

-- Ajouter les nouvelles infras aux clubs existants
insert into club_upgrades (club_id, type, level)
select c.id, u.type, 0
from clubs c
cross join (values
  ('training_center'),
  ('stadium'),
  ('tactical_staff')
) as u(type)
where c.is_bot = false
  and not exists (
    select 1 from club_upgrades cu
    where cu.club_id = c.id and cu.type = u.type
  );

-- ─── COLONNE PARTIE SAUVEGARDÉE ───────────────────────────────
-- Permettre plusieurs parties (pour plus tard)
alter table clubs add column if not exists season integer not null default 1;
alter table onboarding_state add column if not exists season integer not null default 1;
alter table onboarding_state add column if not exists game_started_at timestamptz default now();
alter table onboarding_state add column if not exists simulated_date timestamptz default now();
