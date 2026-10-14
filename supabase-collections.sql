-- Collect the set: sellers group products into a set (a series of pins, charms, stickers...),
-- buyers get a checklist of which pieces they own, and sellers see which pieces collectors
-- are still missing. Ownership comes from the buyer's own confirmed orders and picked-up
-- reservations (detected by the app) plus pieces they tick off themselves.
-- Run once in the Supabase SQL Editor. Safe to re-run.

do $$
begin
  if to_regclass('public.shops') is null or to_regclass('public.buyers') is null then
    raise exception 'The shops and buyers tables are missing. Set up the app database first.';
  end if;
end $$;

-- ---------- Sets ----------
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  description text not null default '' check (char_length(description) <= 200),
  perk text not null default '' check (char_length(perk) <= 120),
  product_ids jsonb not null check (
    jsonb_typeof(product_ids) = 'array' and jsonb_array_length(product_ids) between 2 and 24
  ),
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists collections_shop_idx on public.collections (shop_id);
alter table public.collections enable row level security;
drop policy if exists "Owner manages collections" on public.collections;
create policy "Owner manages collections" on public.collections
  for all using (auth.uid() = shop_id) with check (auth.uid() = shop_id);

-- ---------- What each buyer owns ('auto' = found in their orders, 'manual' = they ticked it) ----------
create table if not exists public.collection_marks (
  buyer_id uuid not null references auth.users(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  product_id text not null check (char_length(product_id) between 1 and 80),
  source text not null default 'manual' check (source in ('manual', 'auto')),
  created_at timestamptz not null default now(),
  primary key (buyer_id, shop_id, product_id)
);
create index if not exists collection_marks_shop_idx on public.collection_marks (shop_id, product_id);
alter table public.collection_marks enable row level security;
-- Buyers read their own marks. Sellers only ever get counts (see collection_stats).
drop policy if exists "Buyer reads own marks" on public.collection_marks;
create policy "Buyer reads own marks" on public.collection_marks for select using (auth.uid() = buyer_id);

-- True when this product belongs to one of the shop's published sets
create or replace function public.in_published_set(p_shop uuid, p_product text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.collections c
     where c.shop_id = p_shop and c.is_published and c.product_ids ? p_product);
$$;
revoke execute on function public.in_published_set(uuid, text) from public, anon, authenticated;

-- ---------- Public: the sets on a seller's page ----------
create or replace function public.public_shop_collections(shop_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  shop_row public.shops;
  result jsonb;
begin
  select * into shop_row from public.shops where coalesce(showcase_slug, username) = shop_slug limit 1;
  if not found then return null; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'title', c.title, 'description', c.description, 'perk', c.perk,
    'pieces', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', pid, 'name', coalesce(p->>'name', 'Retired piece'), 'price', p->'price',
               'inStock', coalesce((p->>'stock')::numeric, 0) > 0 and not coalesce((p->>'archived')::boolean, false)
             ) order by ord), '[]'::jsonb)
        from jsonb_array_elements_text(c.product_ids) with ordinality as t(pid, ord)
        left join lateral (
          select pp as p from public.shop_data d, jsonb_array_elements(coalesce(d.data->'products', '[]'::jsonb)) pp
           where d.shop_id = shop_row.id and pp->>'id' = t.pid limit 1) prod on true),
    'owned', case when uid is null then '[]'::jsonb else (
      select coalesce(jsonb_agg(jsonb_build_object('id', m.product_id, 'source', m.source)), '[]'::jsonb)
        from public.collection_marks m
       where m.buyer_id = uid and m.shop_id = shop_row.id and c.product_ids ? m.product_id) end,
    'collectors', (
      select count(distinct m.buyer_id) from public.collection_marks m
       where m.shop_id = shop_row.id and c.product_ids ? m.product_id),
    'completers', (
      select count(*) from (
        select m.buyer_id from public.collection_marks m
         where m.shop_id = shop_row.id and c.product_ids ? m.product_id
         group by m.buyer_id having count(*) >= jsonb_array_length(c.product_ids)) done)
  ) order by c.created_at), '[]'::jsonb) into result
  from public.collections c
  where c.shop_id = shop_row.id and c.is_published;
  return result;
end;
$$;

-- ---------- Buyer ticks / unticks a piece they own (manual only) ----------
create or replace function public.toggle_owned(shop_slug text, owned_product_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  shop_row public.shops;
  existing text;
begin
  if uid is null or not exists (select 1 from public.buyers where id = uid) then
    raise exception 'Log in with a buyer account to track your collection.';
  end if;
  select * into shop_row from public.shops where coalesce(showcase_slug, username) = shop_slug limit 1;
  if not found then raise exception 'Shop not found.'; end if;
  if not public.in_published_set(shop_row.id, owned_product_id) then raise exception 'That piece is not part of a set.'; end if;

  select source into existing from public.collection_marks
   where buyer_id = uid and shop_id = shop_row.id and product_id = owned_product_id;
  if existing = 'auto' then raise exception 'This one comes from your orders, so it stays ticked.'; end if;
  if existing = 'manual' then
    delete from public.collection_marks where buyer_id = uid and shop_id = shop_row.id and product_id = owned_product_id;
    return jsonb_build_object('owned', false);
  end if;
  insert into public.collection_marks (buyer_id, shop_id, product_id, source) values (uid, shop_row.id, owned_product_id, 'manual');
  return jsonb_build_object('owned', true);
end;
$$;

-- ---------- App reports pieces found in the buyer's own orders ----------
create or replace function public.sync_owned(shop_slug text, found_product_ids jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  shop_row public.shops;
  pid text;
begin
  if uid is null or not exists (select 1 from public.buyers where id = uid) then return; end if;
  if found_product_ids is null or jsonb_typeof(found_product_ids) <> 'array' or jsonb_array_length(found_product_ids) > 100 then return; end if;
  select * into shop_row from public.shops where coalesce(showcase_slug, username) = shop_slug limit 1;
  if not found then return; end if;
  for pid in select jsonb_array_elements_text(found_product_ids) loop
    if public.in_published_set(shop_row.id, pid) then
      insert into public.collection_marks (buyer_id, shop_id, product_id, source) values (uid, shop_row.id, pid, 'auto')
      on conflict (buyer_id, shop_id, product_id) do update set source = 'auto';
    end if;
  end loop;
end;
$$;

-- ---------- Seller: how are collectors doing? Counts only, never names ----------
create or replace function public.collection_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'collectors', (select count(distinct m.buyer_id) from public.collection_marks m
                    where m.shop_id = c.shop_id and c.product_ids ? m.product_id),
    'completers', (select count(*) from (
                    select m.buyer_id from public.collection_marks m
                     where m.shop_id = c.shop_id and c.product_ids ? m.product_id
                     group by m.buyer_id having count(*) >= jsonb_array_length(c.product_ids)) d),
    'pieces', (select coalesce(jsonb_object_agg(pid, cnt), '{}'::jsonb) from (
                 select t.pid, (select count(*) from public.collection_marks m
                                 where m.shop_id = c.shop_id and m.product_id = t.pid) as cnt
                   from jsonb_array_elements_text(c.product_ids) as t(pid)) x)
  ) order by c.created_at), '[]'::jsonb)
  from public.collections c where c.shop_id = auth.uid();
$$;

revoke execute on function public.toggle_owned(text, text) from public;
revoke execute on function public.sync_owned(text, jsonb) from public;
revoke execute on function public.collection_stats() from public;
grant execute on function public.public_shop_collections(text) to anon, authenticated;
grant execute on function public.toggle_owned(text, text) to authenticated;
grant execute on function public.sync_owned(text, jsonb) to authenticated;
grant execute on function public.collection_stats() to authenticated;
