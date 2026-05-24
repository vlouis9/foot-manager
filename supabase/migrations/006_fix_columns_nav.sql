-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 006 — Corrections colonnes + navigation
-- À exécuter dans Supabase > SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ─── S'assurer que toutes les colonnes existent ───────────────
alter table players
  add column if not exists joueurid     text,
  add column if not exists base_rating  integer not null default 50,
  add column if not exists category     text    not null default 'bronze';

-- Index unique sur joueurid (si pas encore fait)
create unique index if not exists players_joueurid_key on players(joueurid)
  where joueurid is not null;

-- ─── Colonnes stats_raw ───────────────────────────────────────
create table if not exists stats_raw (
  joueurid   text    not null,
  gameweek   integer not null,
  played     integer not null default 0,
  starter    integer not null default 0,
  rating     numeric not null default 0,
  goals      integer not null default 0,
  primary key (joueurid, gameweek)
);
alter table stats_raw enable row level security;
drop policy if exists "stats_raw_read"  on stats_raw;
drop policy if exists "stats_raw_write" on stats_raw;
create policy "stats_raw_read"  on stats_raw for select using (true);
create policy "stats_raw_write" on stats_raw for all    using (true);

-- ─── Colonnes matches ─────────────────────────────────────────
alter table matches
  add column if not exists home_goals        integer,
  add column if not exists away_goals        integer,
  add column if not exists home_goals_real   integer,
  add column if not exists away_goals_real   integer,
  add column if not exists home_goals_fictif integer,
  add column if not exists away_goals_fictif integer;

-- ─── Colonnes player_real_stats ───────────────────────────────
alter table player_real_stats
  add column if not exists goals_real    integer not null default 0,
  add column if not exists goals_fictif  numeric not null default 0,
  add column if not exists score_base    numeric not null default 0,
  add column if not exists score_bonus   numeric not null default 0;

-- ─── Table game_saves (si pas encore créée) ───────────────────
create table if not exists game_saves (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references auth.users(id) on delete cascade,
  club_id      uuid references clubs(id) on delete cascade,
  save_name    text        not null default 'Partie',
  is_active    boolean     not null default false,
  started_at   timestamptz default now(),
  last_played  timestamptz default now(),
  gameweek     integer     not null default 1,
  created_at   timestamptz default now()
);
alter table game_saves enable row level security;
drop policy if exists "saves_own" on game_saves;
create policy "saves_own" on game_saves for all using (auth.uid() = user_id);

-- ─── Colonnes onboarding_state ────────────────────────────────
alter table onboarding_state
  add column if not exists save_id         uuid references game_saves(id),
  add column if not exists simulated_date  timestamptz default now(),
  add column if not exists game_started_at timestamptz default now();

-- ─── Clubs bots : s'assurer qu'ils existent ───────────────────
insert into clubs (user_id, name, budget, wage_budget, reputation, is_bot) values
  (null,'PSG',500000,150000,99,true),
  (null,'Monaco',1200000,100000,80,true),
  (null,'Marseille',1200000,100000,80,true),
  (null,'Lyon',1200000,100000,78,true),
  (null,'Lille',1500000,80000,75,true),
  (null,'Nice',1500000,80000,72,true),
  (null,'Lens',1800000,70000,68,true),
  (null,'Rennes',1800000,70000,68,true),
  (null,'Strasbourg',2000000,60000,60,true),
  (null,'Nantes',2000000,60000,58,true),
  (null,'Toulouse',2000000,60000,57,true),
  (null,'Brest',2200000,55000,55,true),
  (null,'Lorient',2500000,50000,50,true),
  (null,'Le Havre',2500000,50000,48,true),
  (null,'Auxerre',2500000,50000,48,true),
  (null,'Angers',2500000,50000,46,true),
  (null,'Paris FC',3000000,45000,44,true),
  (null,'Metz',3500000,40000,40,true)
on conflict do nothing;

-- ─── Corriger draft_done si bloqué ────────────────────────────
-- Si un joueur a un club actif mais draft_done = false, corriger
update onboarding_state os
set draft_done = true
where draft_done = false
  and exists (
    select 1 from clubs c
    where c.user_id = os.user_id
      and c.is_bot = false
  );

-- ─── Créer game_saves manquantes pour les clubs actifs ────────
insert into game_saves (user_id, club_id, save_name, is_active, gameweek)
select
  c.user_id,
  c.id,
  c.name || ' — Saison 2025',
  true,
  coalesce(os.current_gameweek, 1)
from clubs c
join onboarding_state os on os.user_id = c.user_id
where c.is_bot = false
  and not exists (
    select 1 from game_saves gs where gs.club_id = c.id
  );
