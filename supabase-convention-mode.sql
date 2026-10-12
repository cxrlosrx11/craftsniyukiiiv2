-- Convention Mode: sellers publish where they will be selling, buyers reserve items to
-- pick up at the booth, sellers get a pick-list. No online payment: money changes hands
-- at the booth. Run once in the Supabase SQL Editor. Safe to re-run.

do $$
begin
  if to_regclass('public.shops') is null or to_regclass('public.buyers') is null then
    raise exception 'The shops and buyers tables are missing. Set up the app database first.';
  end if;
end $$;

-- ---------- Events a seller will attend ----------
create table if not exists public.shop_events (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  venue text not null default '' check (char_length(venue) <= 80),
  booth text not null default '' check (char_length(booth) <= 30),
  starts_on date not null,
  ends_on date not null,
  reserve_enabled boolean not null default true,
  note text not null default '' check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index if not exists shop_events_shop_idx on public.shop_events (shop_id, ends_on);
alter table public.shop_events enable row level security;
drop policy if exists "Owner manages events" on public.shop_events;
create policy "Owner manages events" on public.shop_events
  for all using (auth.uid() = shop_id) with check (auth.uid() = shop_id);

-- ---------- Reservations ----------
create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.shop_events(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  buyer_name text not null check (char_length(buyer_name) between 1 and 60),
  code text not null unique,
  items jsonb not null,
  total numeric(12,2) not null,
  note text not null default '' check (char_length(note) <= 200),
  status text not null default 'Reserved' check (status in ('Reserved', 'Ready', 'PickedUp', 'NoShow', 'Cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reservations_shop_idx on public.reservations (shop_id, status);
create index if not exists reservations_buyer_idx on public.reservations (buyer_id);
alter table public.reservations enable row level security;
-- Seller sees their reservations, buyer sees their own. All changes go through the functions below.
drop policy if exists "Seller or buyer reads reservations" on public.reservations;
create policy "Seller or buyer reads reservations" on public.reservations
  for select using (auth.uid() = shop_id or auth.uid() = buyer_id);

-- ---------- Stock currently held for pickups: { productId: qty } ----------
-- Counts Reserved/Ready reservations. Holds lapse by themselves 1 day after the event ends.
create or replace function public.held_map(p_shop uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(pid, q), '{}'::jsonb) from (
    select it->>'productId' as pid, sum((it->>'qty')::int) as q
      from public.reservations r
      join public.shop_events e on e.id = r.event_id
      cross join lateral jsonb_array_elements(r.items) it
     where r.shop_id = p_shop and r.status in ('Reserved', 'Ready')
       and e.ends_on >= (now() at time zone 'Asia/Manila')::date - 1
     group by 1
  ) x;
$$;
revoke execute on function public.held_map(uuid) from public, anon, authenticated;

-- Seller: what is on hold for pickups (the POS uses this so booth sales don't sell reserved stock)
create or replace function public.my_shop_holds()
returns jsonb language sql stable security definer set search_path = public as $$
  select public.held_map(auth.uid());
$$;

-- ---------- Public: upcoming events for a shop page ----------
create or replace function public.public_shop_events(shop_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  shop_row public.shops;
  evs jsonb;
begin
  select * into shop_row from public.shops where coalesce(showcase_slug, username) = shop_slug limit 1;
  if not found then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'name', name, 'venue', venue, 'booth', booth,
           'startsOn', starts_on, 'endsOn', ends_on, 'reserveEnabled', reserve_enabled, 'note', note
         ) order by starts_on), '[]'::jsonb) into evs
    from (select * from public.shop_events
           where shop_id = shop_row.id and ends_on >= (now() at time zone 'Asia/Manila')::date
           order by starts_on limit 6) e;
  return jsonb_build_object('events', evs, 'held', public.held_map(shop_row.id));
end;
$$;

-- ---------- Buyer reserves items for an event ----------
create or replace function public.reserve_items(p_event uuid, p_items jsonb, p_note text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ev public.shop_events;
  held jsonb;
  it jsonb;
  prod jsonb;
  pid text;
  qty int;
  avail int;
  total numeric := 0;
  clean jsonb := '[]'::jsonb;
  seen text[] := '{}';
  active int;
  new_code text;
  new_id uuid;
  tries int := 0;
begin
  if uid is null or not exists (select 1 from public.buyers where id = uid) then
    raise exception 'Log in with a buyer account to reserve items.';
  end if;
  select * into ev from public.shop_events where id = p_event;
  if not found then raise exception 'Event not found.'; end if;
  if not ev.reserve_enabled then raise exception 'Reservations are closed for this event.'; end if;
  if ev.ends_on < (now() at time zone 'Asia/Manila')::date then raise exception 'This event has already ended.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 10 then
    raise exception 'Pick between 1 and 10 items.';
  end if;
  if nullif(btrim(p_name), '') is null then raise exception 'Enter a name for the pickup.'; end if;

  -- one reservation at a time per shop, so two buyers can't grab the last piece together
  perform pg_advisory_xact_lock(hashtext(ev.shop_id::text));

  select count(*) into active from public.reservations
   where shop_id = ev.shop_id and buyer_id = uid and status in ('Reserved', 'Ready');
  if active >= 5 then raise exception 'You already have 5 active reservations with this shop.'; end if;

  held := public.held_map(ev.shop_id);
  for it in select * from jsonb_array_elements(p_items) loop
    pid := it->>'productId';
    begin qty := (it->>'qty')::int; exception when others then qty := null; end;
    if pid is null or qty is null or qty < 1 or qty > 5 then
      raise exception 'Each item needs a quantity from 1 to 5.';
    end if;
    if pid = any(seen) then raise exception 'Each item can only be listed once.'; end if;
    seen := seen || pid;

    prod := null;
    select p into prod
      from public.shop_data d, jsonb_array_elements(coalesce(d.data->'products', '[]'::jsonb)) p
     where d.shop_id = ev.shop_id and p->>'id' = pid and not coalesce((p->>'archived')::boolean, false)
     limit 1;
    if prod is null then raise exception 'One of those products is no longer available.'; end if;

    avail := floor(coalesce((prod->>'stock')::numeric, 0))::int - coalesce((held->>pid)::int, 0);
    if avail < qty then
      raise exception '% only has % left to reserve.', prod->>'name', greatest(avail, 0);
    end if;
    clean := clean || jsonb_build_object('productId', pid, 'name', prod->>'name', 'price', (prod->>'price')::numeric, 'qty', qty);
    total := total + (prod->>'price')::numeric * qty;
  end loop;

  loop
    new_code := 'R-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));
    exit when not exists (select 1 from public.reservations where code = new_code);
    tries := tries + 1;
    if tries > 10 then raise exception 'Could not create a pickup code. Please try again.'; end if;
  end loop;

  insert into public.reservations (event_id, shop_id, buyer_id, buyer_name, code, items, total, note)
  values (ev.id, ev.shop_id, uid, left(btrim(p_name), 60), new_code, clean, round(total, 2), left(coalesce(p_note, ''), 200))
  returning id into new_id;
  return jsonb_build_object('id', new_id, 'code', new_code, 'total', round(total, 2));
end;
$$;

-- ---------- Buyer cancels ----------
create or replace function public.cancel_reservation(res_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.reservations set status = 'Cancelled', updated_at = now()
   where id = res_id and buyer_id = auth.uid() and status in ('Reserved', 'Ready');
  if not found then raise exception 'Reservation not found or already closed.'; end if;
end;
$$;

-- ---------- Seller updates a reservation ----------
create or replace function public.set_reservation_status(res_id uuid, new_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if new_status not in ('Ready', 'PickedUp', 'NoShow', 'Cancelled') then raise exception 'Invalid status.'; end if;
  update public.reservations set status = new_status, updated_at = now()
   where id = res_id and shop_id = auth.uid() and status in ('Reserved', 'Ready');
  if not found then raise exception 'Reservation not found or already closed.'; end if;
end;
$$;

-- ---------- Buyer's own reservations with event details ----------
create or replace function public.my_reservations()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id, 'code', r.code, 'status', r.status, 'total', r.total, 'items', r.items, 'note', r.note,
           'createdAt', r.created_at, 'eventName', e.name, 'venue', e.venue, 'booth', e.booth,
           'startsOn', e.starts_on, 'endsOn', e.ends_on,
           'shopName', s.shop_name, 'shopSlug', coalesce(s.showcase_slug, s.username), 'currency', s.currency
         ) order by r.created_at desc), '[]'::jsonb)
    from public.reservations r
    join public.shop_events e on e.id = r.event_id
    join public.shops s on s.id = r.shop_id
   where r.buyer_id = auth.uid();
$$;

revoke execute on function public.my_shop_holds() from public;
revoke execute on function public.reserve_items(uuid, jsonb, text, text) from public;
revoke execute on function public.cancel_reservation(uuid) from public;
revoke execute on function public.set_reservation_status(uuid, text) from public;
revoke execute on function public.my_reservations() from public;
grant execute on function public.public_shop_events(text) to anon, authenticated;
grant execute on function public.my_shop_holds() to authenticated;
grant execute on function public.reserve_items(uuid, jsonb, text, text) to authenticated;
grant execute on function public.cancel_reservation(uuid) to authenticated;
grant execute on function public.set_reservation_status(uuid, text) to authenticated;
grant execute on function public.my_reservations() to authenticated;
