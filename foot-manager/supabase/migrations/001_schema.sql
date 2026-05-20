-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 001 — Schéma complet Foot Manager
-- À exécuter dans Supabase > SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- Extensions
create extension if not exists "uuid-ossp";

-- ─── JOUEURS L1 ────────────────────────────────────────────────
create table if not exists players (
  id                  uuid primary key default uuid_generate_v4(),
  real_team           text not null,
  firstname           text not null default '',
  lastname            text not null,
  position            text not null check (position in ('GK','DEF','MID','ATT')),
  age                 integer not null,
  market_value        bigint not null default 0,
  salary              integer not null default 0,
  availability_status text not null default 'available'
    check (availability_status in ('available','expensive','locked','opportunity')),
  created_at          timestamptz default now()
);

-- ─── CLUBS ─────────────────────────────────────────────────────
create table if not exists clubs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade,
  name        text not null,
  budget      bigint not null default 2000000,
  wage_budget bigint not null default 500000,
  reputation  integer not null default 50,
  is_bot      boolean not null default false,
  created_at  timestamptz default now()
);

-- ─── JOUEURS DANS UN CLUB ──────────────────────────────────────
create table if not exists club_players (
  id               uuid primary key default uuid_generate_v4(),
  club_id          uuid not null references clubs(id) on delete cascade,
  player_id        uuid not null references players(id) on delete cascade,
  xp               integer not null default 0,
  level            integer not null default 1,
  bonus_attack     numeric not null default 0,
  bonus_defense    numeric not null default 0,
  bonus_collective numeric not null default 0,
  created_at       timestamptz default now(),
  unique(player_id)  -- un joueur = un seul club à la fois
);

-- ─── STATS RÉELLES PAR JOURNÉE ─────────────────────────────────
create table if not exists player_real_stats (
  id           uuid primary key default uuid_generate_v4(),
  player_id    uuid not null references players(id) on delete cascade,
  gameweek     integer not null,
  minutes      integer not null default 0,
  rating       numeric not null default 5.0,
  goals        integer not null default 0,
  assists      integer not null default 0,
  clean_sheet  boolean not null default false,
  yellow_card  boolean not null default false,
  red_card     boolean not null default false,
  unique(player_id, gameweek)
);

-- ─── COMPOSITIONS ──────────────────────────────────────────────
create table if not exists lineups (
  id        uuid primary key default uuid_generate_v4(),
  club_id   uuid not null references clubs(id) on delete cascade,
  gameweek  integer not null,
  formation text not null default '4-3-3',
  locked    boolean not null default false,
  unique(club_id, gameweek)
);

create table if not exists lineup_players (
  id          uuid primary key default uuid_generate_v4(),
  lineup_id   uuid not null references lineups(id) on delete cascade,
  player_id   uuid not null references players(id) on delete cascade,
  starter     boolean not null default true,
  bench_order integer,
  unique(lineup_id, player_id)
);

-- ─── MATCHS ────────────────────────────────────────────────────
create table if not exists matches (
  id            uuid primary key default uuid_generate_v4(),
  gameweek      integer not null,
  home_club_id  uuid not null references clubs(id),
  away_club_id  uuid not null references clubs(id),
  home_score    numeric,
  away_score    numeric,
  processed     boolean not null default false
);

-- ─── UPGRADES RPG ──────────────────────────────────────────────
create table if not exists club_upgrades (
  id      uuid primary key default uuid_generate_v4(),
  club_id uuid not null references clubs(id) on delete cascade,
  type    text not null check (type in ('offense_center','defense_center','tactical_room','academy')),
  level   integer not null default 0,
  unique(club_id, type)
);

-- ─── MARCHÉ ────────────────────────────────────────────────────
create table if not exists market (
  id           uuid primary key default uuid_generate_v4(),
  player_id    uuid not null references players(id) on delete cascade,
  price        bigint not null,
  availability text not null default 'available',
  expires_at   timestamptz not null,
  created_at   timestamptz default now()
);

-- ─── PAQUETS ───────────────────────────────────────────────────
create table if not exists card_packs (
  id         uuid primary key default uuid_generate_v4(),
  club_id    uuid not null references clubs(id) on delete cascade,
  type       text not null check (type in ('standard','journee','prestige')),
  opened     boolean not null default false,
  created_at timestamptz default now()
);

-- ─── ÉVÉNEMENTS QUOTIDIENS ─────────────────────────────────────
create table if not exists daily_events (
  id         uuid primary key default uuid_generate_v4(),
  club_id    uuid not null references clubs(id) on delete cascade,
  type       text not null check (type in ('sponsor_bonus','tactical_camp','market_discount','training_boost')),
  value      numeric not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

-- ─── STATE ONBOARDING ──────────────────────────────────────────
create table if not exists onboarding_state (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  club_chosen      boolean not null default false,
  draft_done       boolean not null default false,
  current_gameweek integer not null default 1,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════

alter table players       enable row level security;
alter table clubs         enable row level security;
alter table club_players  enable row level security;
alter table player_real_stats enable row level security;
alter table lineups       enable row level security;
alter table lineup_players enable row level security;
alter table matches       enable row level security;
alter table club_upgrades enable row level security;
alter table market        enable row level security;
alter table card_packs    enable row level security;
alter table daily_events  enable row level security;
alter table onboarding_state enable row level security;

-- Players : lecture publique
create policy "players_read" on players for select using (true);

-- Clubs : lecture publique (pour le classement), écriture uniquement sur son propre club
create policy "clubs_read"   on clubs for select using (true);
create policy "clubs_insert" on clubs for insert with check (auth.uid() = user_id or is_bot = true);
create policy "clubs_update" on clubs for update using (auth.uid() = user_id);

-- Club players : lecture publique, écriture sur son propre club
create policy "club_players_read" on club_players for select using (true);
create policy "club_players_insert" on club_players for insert
  with check (
    club_id in (select id from clubs where user_id = auth.uid() or is_bot = true)
  );
create policy "club_players_update" on club_players for update
  using (club_id in (select id from clubs where user_id = auth.uid()));
create policy "club_players_delete" on club_players for delete
  using (club_id in (select id from clubs where user_id = auth.uid() or is_bot = true));

-- Stats : lecture publique
create policy "stats_read" on player_real_stats for select using (true);
create policy "stats_insert" on player_real_stats for insert with check (true); -- admin only en prod

-- Lineups : propre club uniquement
create policy "lineups_read"   on lineups for select
  using (club_id in (select id from clubs where user_id = auth.uid()));
create policy "lineups_insert" on lineups for insert
  with check (club_id in (select id from clubs where user_id = auth.uid()));
create policy "lineups_update" on lineups for update
  using (club_id in (select id from clubs where user_id = auth.uid()));

create policy "lineup_players_read" on lineup_players for select
  using (lineup_id in (
    select l.id from lineups l
    join clubs c on c.id = l.club_id
    where c.user_id = auth.uid()
  ));
create policy "lineup_players_write" on lineup_players for all
  using (lineup_id in (
    select l.id from lineups l
    join clubs c on c.id = l.club_id
    where c.user_id = auth.uid()
  ));

-- Matches : lecture publique
create policy "matches_read" on matches for select using (true);

-- Upgrades : propre club
create policy "upgrades_read" on club_upgrades for select
  using (club_id in (select id from clubs where user_id = auth.uid()));
create policy "upgrades_write" on club_upgrades for all
  using (club_id in (select id from clubs where user_id = auth.uid()));

-- Market : lecture publique
create policy "market_read" on market for select using (true);

-- Paquets & events : propre club
create policy "packs_read" on card_packs for select
  using (club_id in (select id from clubs where user_id = auth.uid()));
create policy "packs_write" on card_packs for all
  using (club_id in (select id from clubs where user_id = auth.uid()));

create policy "events_read" on daily_events for select
  using (club_id in (select id from clubs where user_id = auth.uid()));

-- Onboarding : propre user
create policy "onboarding_all" on onboarding_state for all
  using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- FONCTIONS UTILITAIRES
-- ═══════════════════════════════════════════════════════════════

-- Trigger : mettre à jour updated_at automatiquement
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger onboarding_updated_at
  before update on onboarding_state
  for each row execute function update_updated_at();

-- Fonction : créer le profil onboarding après inscription
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into onboarding_state (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
