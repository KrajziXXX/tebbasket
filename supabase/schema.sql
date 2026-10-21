-- =====================================================================
-- tebBasket — Supabase schema (tables, RLS, RPC)
-- Run once in: Supabase Dashboard → SQL Editor → New query → Run.
-- Re-runnable: functions/policies use create or replace / drop if exists.
--
-- Security model:
--  * Client (anon key) can only READ its own profile and UPDATE cosmetic
--    columns (username, outfit, appearance, settings) — enforced by
--    column-level GRANTs + RLS.
--  * Everything economic (XP, level, coins, gems, rating, owned outfits)
--    changes ONLY through SECURITY DEFINER RPCs below, which compute
--    rewards server-side. Keep the numbers in sync with
--    src/lib/progression.ts and src/lib/outfits.ts.
-- =====================================================================

-- ---------- tables ----------

create table if not exists public.shop_items (
  id          text primary key,
  kind        text not null check (kind in ('outfit')),
  price_coins int  not null default 0 check (price_coins >= 0),
  price_gems  int  not null default 0 check (price_gems >= 0)
);

insert into public.shop_items (id, kind, price_coins, price_gems) values
  ('mint',         'outfit',  250,   0),
  ('fire-red',     'outfit',  300,   0),
  ('cherry',       'outfit',  400,   0),
  ('retro-orange', 'outfit',  450,   0),
  ('night-black',  'outfit',  600,   0),
  ('ice',          'outfit',  700,   0),
  ('neon',         'outfit',  800,   0),
  ('camo',         'outfit',  900,   0),
  ('pinstripe',    'outfit', 1200,   0),
  ('lava',         'outfit', 1500,   0),
  ('cyber',        'outfit', 2000,   0),
  ('flamingo',     'outfit',    0,  40),
  ('galaxy',       'outfit',    0,  60),
  ('sunset',       'outfit',    0,  80),
  ('royal',        'outfit',    0, 100),
  ('gold-legend',  'outfit',    0, 150)
on conflict (id) do update
  set price_coins = excluded.price_coins, price_gems = excluded.price_gems;

create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      text not null unique check (username ~ '^[A-Za-z0-9_]{3,16}$'),
  level         int  not null default 1    check (level >= 1),
  xp            int  not null default 0    check (xp >= 0),
  coins         int  not null default 0    check (coins >= 0),
  gems          int  not null default 0    check (gems >= 0),
  rating        int  not null default 1000 check (rating >= 0),
  wins          int  not null default 0,
  losses        int  not null default 0,
  outfit        text not null default 'teb-blue',
  owned_outfits text[] not null default array['teb-blue', 'teb-white'],
  appearance    jsonb not null default '{"skin":0,"hair":0,"hairColor":0,"number":12}'
                check (jsonb_typeof(appearance) = 'object' and octet_length(appearance::text) < 512),
  settings      jsonb not null default '{"sound":true,"volume":0.7,"lang":"pl"}'
                check (jsonb_typeof(settings) = 'object' and octet_length(settings::text) < 512),
  last_match_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists profiles_rating_idx on public.profiles (rating desc, wins desc);

create table if not exists public.matches (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  mode           text not null check (mode in ('quick', 'ranked', 'practice')),
  player_score   int  not null,
  opponent_score int  not null,
  won            boolean not null,
  xp_gained      int  not null,
  coins_gained   int  not null,
  rating_delta   int  not null,
  created_at     timestamptz not null default now()
);
create index if not exists matches_user_idx on public.matches (user_id, created_at desc);

create table if not exists public.purchases (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  item        text not null,
  kind        text not null check (kind in ('outfit', 'exchange', 'mock_gems')),
  coins_delta int  not null default 0,
  gems_delta  int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists purchases_user_idx on public.purchases (user_id, created_at desc);

-- ---------- triggers ----------

-- create a profile for every new auth user (username from sign-up metadata)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text := coalesce(new.raw_user_meta_data ->> 'username', '');
begin
  if v_name !~ '^[A-Za-z0-9_]{3,16}$' or exists (select 1 from public.profiles where username = v_name) then
    v_name := 'player_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  insert into public.profiles (id, username) values (new.id, v_name);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- players may only equip outfits they own
create or replace function public.profiles_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.outfit is distinct from old.outfit and not (new.outfit = any (new.owned_outfits)) then
    raise exception 'outfit not owned';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.profiles_guard();

-- ---------- RLS + privileges ----------

alter table public.profiles   enable row level security;
alter table public.matches    enable row level security;
alter table public.shop_items enable row level security;
alter table public.purchases  enable row level security;

drop policy if exists "profiles: read own"   on public.profiles;
drop policy if exists "profiles: update own" on public.profiles;
drop policy if exists "matches: read own"    on public.matches;
drop policy if exists "shop: read all"       on public.shop_items;
drop policy if exists "purchases: read own"  on public.purchases;

create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "matches: read own" on public.matches
  for select to authenticated using (user_id = auth.uid());
create policy "shop: read all" on public.shop_items
  for select to anon, authenticated using (true);
create policy "purchases: read own" on public.purchases
  for select to authenticated using (user_id = auth.uid());

-- column-level: the client can change cosmetics only
revoke all on public.profiles, public.matches, public.purchases, public.shop_items from anon, authenticated;
grant select on public.profiles, public.matches, public.purchases to authenticated;
grant select on public.shop_items to anon, authenticated;
grant update (username, outfit, appearance, settings) on public.profiles to authenticated;

-- ---------- RPC ----------

-- Called after every match. Rewards are computed here, not trusted from the client.
create or replace function public.finish_match(
  p_mode text, p_player_score int, p_opponent_score int, p_makes int default 0
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  p        public.profiles%rowtype;
  v_won    boolean;
  v_xp     int;
  v_coins  int;
  v_delta  int := 0;
  v_levels int := 0;
  v_gap    interval;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_mode not in ('quick', 'ranked', 'practice') then raise exception 'invalid mode'; end if;
  if p_player_score not between 0 and 200 or p_opponent_score not between 0 and 200 or p_makes not between 0 and 200 then
    raise exception 'invalid score';
  end if;

  select * into p from public.profiles where id = v_uid for update;

  -- a real match lasts 3 min (practice 2 min) — reject faster submissions
  v_gap := case p_mode when 'practice' then interval '90 seconds' else interval '150 seconds' end;
  if p.last_match_at is not null and now() - p.last_match_at < v_gap then
    raise exception 'too many matches, slow down';
  end if;

  v_won := p_mode <> 'practice' and p_player_score > p_opponent_score;
  if p_mode = 'practice' then
    v_xp := least(20, 5 + least(p_makes, 15));
    v_coins := 5;
  elsif p_mode = 'quick' then
    v_xp := case when v_won then 70 else 25 end;
    v_coins := case when v_won then 35 else 10 end;
  else
    v_xp := case when v_won then 120 else 45 end;
    v_coins := case when v_won then 60 else 15 end;
    v_delta := case when v_won then 20 + least(10, (p_player_score - p_opponent_score) / 2) else -15 end;
  end if;

  p.xp := p.xp + v_xp;
  while p.xp >= 100 + (p.level - 1) * 40 loop
    p.xp := p.xp - (100 + (p.level - 1) * 40);
    p.level := p.level + 1;
    v_levels := v_levels + 1;
  end loop;

  update public.profiles set
    level = p.level,
    gems = gems + v_levels * 10,  -- GEMS_PER_LEVEL in progression.ts
    xp = p.xp,
    coins = coins + v_coins,
    rating = greatest(0, rating + v_delta),
    wins = wins + case when p_mode <> 'practice' and v_won then 1 else 0 end,
    losses = losses + case when p_mode <> 'practice' and not v_won then 1 else 0 end,
    last_match_at = now()
  where id = v_uid;

  insert into public.matches (user_id, mode, player_score, opponent_score, won, xp_gained, coins_gained, rating_delta)
  values (v_uid, p_mode, p_player_score, p_opponent_score, v_won, v_xp, v_coins, v_delta);

  return json_build_object('won', v_won, 'xp', v_xp, 'coins', v_coins, 'gems', v_levels * 10, 'rating_delta', v_delta, 'levels_gained', v_levels);
end $$;

create or replace function public.buy_outfit(p_item text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  it    public.shop_items%rowtype;
  p     public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into it from public.shop_items where id = p_item and kind = 'outfit';
  if not found then raise exception 'unknown item'; end if;
  select * into p from public.profiles where id = v_uid for update;
  if p_item = any (p.owned_outfits) then return; end if;
  if p.coins < it.price_coins or p.gems < it.price_gems then raise exception 'insufficient funds'; end if;
  update public.profiles
     set coins = coins - it.price_coins,
         gems = gems - it.price_gems,
         owned_outfits = array_append(owned_outfits, p_item)
   where id = v_uid;
  insert into public.purchases (user_id, item, kind, coins_delta, gems_delta)
  values (v_uid, p_item, 'outfit', -it.price_coins, -it.price_gems);
end $$;

-- gems → coins exchange (in-game currency, no real money)
create or replace function public.exchange_gems(p_pack text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_gems  int;
  v_coins int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select g, c into v_gems, v_coins
    from (values ('x10', 10, 1000), ('x50', 50, 5500), ('x100', 100, 12000)) as t (id, g, c)
   where t.id = p_pack;
  if v_gems is null then raise exception 'unknown pack'; end if;
  update public.profiles set gems = gems - v_gems, coins = coins + v_coins
   where id = v_uid and gems >= v_gems;
  if not found then raise exception 'insufficient funds'; end if;
  insert into public.purchases (user_id, item, kind, coins_delta, gems_delta)
  values (v_uid, p_pack, 'exchange', v_coins, -v_gems);
end $$;

-- !!! DEMO ONLY — grants gems for free. Replace with a payment webhook
-- (e.g. Stripe → Edge Function with service_role) before going live, then:
--   drop function public.mock_purchase(text);
create or replace function public.mock_purchase(p_pack text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_gems int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  v_gems := case p_pack when 'gems_100' then 100 when 'gems_550' then 550 when 'gems_1200' then 1200 end;
  if v_gems is null then raise exception 'unknown pack'; end if;
  update public.profiles set gems = gems + v_gems where id = v_uid;
  insert into public.purchases (user_id, item, kind, gems_delta) values (v_uid, p_pack, 'mock_gems', v_gems);
end $$;

-- public leaderboard: exposes only non-sensitive columns
create or replace function public.get_leaderboard(p_limit int default 50)
returns table (id uuid, username text, level int, rating int, wins int)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.level, p.rating, p.wins
    from public.profiles p
   order by p.rating desc, p.wins desc, p.created_at asc
   limit least(greatest(p_limit, 1), 100);
$$;

revoke execute on function public.finish_match(text, int, int, int) from public, anon;
revoke execute on function public.buy_outfit(text)                  from public, anon;
revoke execute on function public.exchange_gems(text)               from public, anon;
revoke execute on function public.mock_purchase(text)               from public, anon;
revoke execute on function public.get_leaderboard(int)              from public, anon;
grant  execute on function public.finish_match(text, int, int, int) to authenticated;
grant  execute on function public.buy_outfit(text)                  to authenticated;
grant  execute on function public.exchange_gems(text)               to authenticated;
grant  execute on function public.mock_purchase(text)               to authenticated;
grant  execute on function public.get_leaderboard(int)              to authenticated;
