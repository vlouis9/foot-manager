-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 004 — Catégories joueurs, multi-parties
-- À exécuter dans Supabase > SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ─── Colonne catégorie sur les joueurs ────────────────────────
alter table players
  add column if not exists category text not null default 'bronze'
  check (category in ('bronze','argent','or','platine','diamant'));

-- Mettre à jour les catégories selon valeur marchande
update players set category = case
  when market_value < 1600000  then 'bronze'
  when market_value < 3600000  then 'argent'
  when market_value < 6000000  then 'or'
  when market_value < 10000000 then 'platine'
  else 'diamant'
end;

-- ─── Multi-parties : lever la contrainte unique player_id ──────
-- club_players avait unique(player_id) pour empêcher les doublons
-- On remplace par une contrainte composite qui permet plusieurs parties
-- (même joueur dans différentes parties du même user)
alter table club_players drop constraint if exists club_players_player_id_key;

-- Nouvelle contrainte : un joueur ne peut être que dans UN club à la fois
-- (géré applicativement — on vérifie avant insert)

-- ─── Table game_saves pour les parties sauvegardées ───────────
create table if not exists game_saves (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references auth.users(id) on delete cascade,
  club_id      uuid references clubs(id) on delete cascade,
  save_name    text not null default 'Partie',
  is_active    boolean not null default false,
  started_at   timestamptz default now(),
  last_played  timestamptz default now(),
  gameweek     integer not null default 1,
  created_at   timestamptz default now()
);

alter table game_saves enable row level security;
create policy "saves_own" on game_saves for all using (auth.uid() = user_id);

-- ─── Colonne save_id sur onboarding_state ─────────────────────
alter table onboarding_state
  add column if not exists save_id uuid references game_saves(id);

-- ─── Index utiles ─────────────────────────────────────────────
create index if not exists idx_club_players_club on club_players(club_id);
create index if not exists idx_club_players_player on club_players(player_id);
create index if not exists idx_game_saves_user on game_saves(user_id);
