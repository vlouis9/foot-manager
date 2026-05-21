-- ═══════════════════════════════════════════════════════════════
-- SEED 001 — Clubs bots L1
-- À exécuter APRÈS la migration 001 ET après l'import du CSV joueurs
-- ═══════════════════════════════════════════════════════════════

-- ─── CLUBS BOTS (un par équipe L1) ────────────────────────────
insert into clubs (id, user_id, name, budget, wage_budget, reputation, is_bot) values
  ('00000000-0000-0000-0000-000000000001', null, 'PSG',        500000,   150000, 99, true),
  ('00000000-0000-0000-0000-000000000002', null, 'Monaco',     1200000,  100000, 80, true),
  ('00000000-0000-0000-0000-000000000003', null, 'Marseille',  1200000,  100000, 80, true),
  ('00000000-0000-0000-0000-000000000004', null, 'Lyon',       1200000,  100000, 78, true),
  ('00000000-0000-0000-0000-000000000005', null, 'Lille',      1500000,  80000,  75, true),
  ('00000000-0000-0000-0000-000000000006', null, 'Nice',       1500000,  80000,  72, true),
  ('00000000-0000-0000-0000-000000000007', null, 'Lens',       1800000,  70000,  68, true),
  ('00000000-0000-0000-0000-000000000008', null, 'Rennes',     1800000,  70000,  68, true),
  ('00000000-0000-0000-0000-000000000009', null, 'Strasbourg', 2000000,  60000,  60, true),
  ('00000000-0000-0000-0000-000000000010', null, 'Nantes',     2000000,  60000,  58, true),
  ('00000000-0000-0000-0000-000000000011', null, 'Toulouse',   2000000,  60000,  57, true),
  ('00000000-0000-0000-0000-000000000012', null, 'Brest',      2200000,  55000,  55, true),
  ('00000000-0000-0000-0000-000000000013', null, 'Lorient',    2500000,  50000,  50, true),
  ('00000000-0000-0000-0000-000000000014', null, 'Le Havre',   2500000,  50000,  48, true),
  ('00000000-0000-0000-0000-000000000015', null, 'Auxerre',    2500000,  50000,  48, true),
  ('00000000-0000-0000-0000-000000000016', null, 'Angers',     2500000,  50000,  46, true),
  ('00000000-0000-0000-0000-000000000017', null, 'Paris FC',   3000000,  45000,  44, true),
  ('00000000-0000-0000-0000-000000000018', null, 'Metz',       3500000,  40000,  40, true)
on conflict (id) do nothing;

-- ─── AFFECTER TOUS LES JOUEURS AUX CLUBS BOTS ─────────────────
-- Chaque joueur de la table players est assigné au club bot correspondant
-- Cette requête utilise le nom du club (real_team) pour trouver le bon bot

insert into club_players (club_id, player_id, xp, level)
select
  c.id as club_id,
  p.id as player_id,
  0 as xp,
  1 as level
from players p
join clubs c on c.name = p.real_team and c.is_bot = true
on conflict (player_id) do nothing;

-- ─── CALENDRIER SIMPLIFIÉ (34 journées, joueur vs bots tournants) ──
-- On génère les matchs pour les 34 journées
-- Le club joueur sera inséré dynamiquement à la création du club
-- Ces matchs sont entre bots uniquement pour l'instant

-- Journée 1 : matchs bots vs bots (exemple de 9 matchs)
insert into matches (gameweek, home_club_id, away_club_id, processed) values
(1, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', false),
(1, '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004', false),
(1, '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000006', false),
(1, '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000008', false),
(1, '00000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000010', false),
(1, '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000012', false),
(1, '00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000014', false),
(1, '00000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000016', false),
(1, '00000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000018', false);

-- ─── MARCHÉ INITIAL ────────────────────────────────────────────
-- 30 joueurs disponibles au démarrage (prix = market_value + 10%)
-- expire dans 72h à partir de maintenant
insert into market (player_id, price, availability, expires_at)
select
  p.id,
  (p.market_value * 1.1)::bigint as price,
  case
    when p.market_value > 20000000 then 'expensive'
    when row_number() over (order by random()) <= 3 then 'opportunity'
    else 'available'
  end as availability,
  now() + interval '72 hours' as expires_at
from players p
order by random()
limit 30
on conflict do nothing;
