-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 002 — Fonctions utilitaires et cron jobs
-- À exécuter dans Supabase > SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- Fonction pour incrémenter la réputation (utilisée par le moteur de matchday)
create or replace function increment_reputation(club_id uuid, amount integer)
returns void language plpgsql security definer as $$
begin
  update clubs
  set reputation = least(100, reputation + amount)
  where id = club_id;
end;
$$;

-- Fonction pour ajouter un paquet standard à tous les clubs actifs
create or replace function add_daily_packs()
returns void language plpgsql security definer as $$
begin
  insert into card_packs (club_id, type, opened)
  select c.id, 'standard', false
  from clubs c
  where c.is_bot = false
    and c.user_id is not null;
end;
$$;

-- Fonction pour mettre à jour les prix du marché hebdomadairement
create or replace function refresh_market()
returns void language plpgsql security definer as $$
begin
  -- Supprimer les offres expirées
  delete from market where expires_at < now();

  -- Ajouter de nouveaux joueurs disponibles (max 30 en permanence)
  insert into market (player_id, price, availability, expires_at)
  select
    p.id,
    (p.market_value * (1 + (random() * 0.2 - 0.1)))::bigint,
    case
      when random() < 0.1 then 'opportunity'
      when p.market_value > 20000000 then 'expensive'
      else 'available'
    end,
    now() + interval '72 hours'
  from players p
  where p.id not in (select player_id from market where expires_at > now())
    and p.id not in (select player_id from club_players cp
                     join clubs c on c.id = cp.club_id
                     where c.is_bot = false)
  order by random()
  limit greatest(0, 30 - (select count(*) from market where expires_at > now()))
  on conflict do nothing;
end;
$$;

-- ── CRON JOBS via pg_cron ────────────────────────────────────
-- Activer pg_cron dans Supabase : Dashboard > Database > Extensions > pg_cron

-- Paquet quotidien : tous les jours à 8h UTC
-- select cron.schedule('daily-packs', '0 8 * * *', 'select add_daily_packs()');

-- Refresh marché : tous les jours à 9h UTC
-- select cron.schedule('refresh-market', '0 9 * * *', 'select refresh_market()');

-- NOTE : décommenter les lignes ci-dessus une fois pg_cron activé dans Supabase.
-- Pour l'instant, appelle ces fonctions manuellement depuis l'admin ou via un cron Vercel.

-- ── TRIGGER : paquet standard à l'inscription ─────────────────
-- Offrir 3 paquets standard dès que le club est créé
create or replace function gift_starter_packs()
returns trigger language plpgsql security definer as $$
begin
  if new.is_bot = false then
    insert into card_packs (club_id, type, opened) values
      (new.id, 'standard', false),
      (new.id, 'standard', false),
      (new.id, 'standard', false);
  end if;
  return new;
end;
$$;

create trigger on_club_created
  after insert on clubs
  for each row execute function gift_starter_packs();
