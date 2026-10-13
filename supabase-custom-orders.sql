-- Custom orders: a seller defines a custom-order option (a set of choices with prices),
-- buyers pick from it and send a request, the seller replies with a final price and a
-- ready date. Money changes hands outside the app, like your other orders.
-- Run once in the Supabase SQL Editor. Safe to re-run.

do $$
begin
  if to_regclass('public.shops') is null or to_regclass('public.buyers') is null then
    raise exception 'The shops and buyers tables are missing. Set up the app database first.';
  end if;
end $$;

-- ---------- Offers (what the seller sets up) ----------
-- options = [{ id, label, kind: 'single' | 'multi' | 'text', required, max, choices: [{ id, label, price }] }]
create table if not exists public.custom_offers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  description text not null default '' check (char_length(description) <= 400),
  base_price numeric(12,2) not null default 0 check (base_price >= 0 and base_price <= 1000000),
  lead_time_days int not null default 7 check (lead_time_days between 0 and 365),
  slots_total int check (slots_total is null or slots_total between 1 and 50),
  is_open boolean not null default true,
  options jsonb not null default '[]'::jsonb
    check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) <= 6 and length(options::text) <= 8000),
  created_at timestamptz not null default now()
);
create index if not exists custom_offers_shop_idx on public.custom_offers (shop_id);
alter table public.custom_offers enable row level security;
drop policy if exists "Owner manages custom offers" on public.custom_offers;
create policy "Owner manages custom offers" on public.custom_offers
  for all using (auth.uid() = shop_id) with check (auth.uid() = shop_id);

-- ---------- Requests (what buyers send) ----------
create table if not exists public.custom_requests (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.custom_offers(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  buyer_name text not null check (char_length(buyer_name) between 1 and 60),
  code text not null unique,
  selections jsonb not null,
  qty int not null check (qty between 1 and 20),
  note text not null default '' check (char_length(note) <= 400),
  est_total numeric(12,2) not null,
  quoted_total numeric(12,2) check (quoted_total is null or (quoted_total >= 0 and quoted_total <= 1000000)),
  seller_note text not null default '' check (char_length(seller_note) <= 300),
  eta date,
  status text not null default 'Requested'
    check (status in ('Requested', 'Accepted', 'InProgress', 'Ready', 'Completed', 'Declined', 'Cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists custom_requests_shop_idx on public.custom_requests (shop_id, status);
create index if not exists custom_requests_offer_idx on public.custom_requests (offer_id, status);
create index if not exists custom_requests_buyer_idx on public.custom_requests (buyer_id);
alter table public.custom_requests enable row level security;
drop policy if exists "Seller or buyer reads custom requests" on public.custom_requests;
create policy "Seller or buyer reads custom requests" on public.custom_requests
  for select using (auth.uid() = shop_id or auth.uid() = buyer_id);

-- ---------- Public: open offers on a seller's page ----------
create or replace function public.public_shop_offers(shop_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  shop_row public.shops;
  result jsonb;
begin
  select * into shop_row from public.shops where coalesce(showcase_slug, username) = shop_slug limit 1;
  if not found then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', o.id, 'title', o.title, 'description', o.description, 'basePrice', o.base_price,
           'leadTimeDays', o.lead_time_days, 'slotsTotal', o.slots_total, 'options', o.options,
           'currency', shop_row.currency,
           'slotsLeft', case when o.slots_total is null then null else greatest(o.slots_total - (
              select count(*) from public.custom_requests r
               where r.offer_id = o.id and r.status in ('Requested', 'Accepted', 'InProgress', 'Ready')), 0) end
         ) order by o.created_at), '[]'::jsonb) into result
    from public.custom_offers o
   where o.shop_id = shop_row.id and o.is_open;
  return result;
end;
$$;

-- ---------- Buyer sends a request ----------
create or replace function public.submit_custom_request(
  p_offer uuid, p_selections jsonb, p_qty int, p_note text, p_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  off public.custom_offers;
  g jsonb;
  sel jsonb;
  ch jsonb;
  kind text;
  req boolean;
  mx int;
  picks text[];
  pick text;
  picked jsonb;
  txt text;
  unit numeric;
  total numeric;
  resolved jsonb := '[]'::jsonb;
  active_all int;
  active_buyer int;
  new_code text;
  new_id uuid;
  tries int := 0;
begin
  if uid is null or not exists (select 1 from public.buyers where id = uid) then
    raise exception 'Log in with a buyer account to send a custom order request.';
  end if;
  select * into off from public.custom_offers where id = p_offer;
  if not found then raise exception 'That custom order option was not found.'; end if;
  if not off.is_open then raise exception 'This custom order option is closed right now.'; end if;
  if p_qty is null or p_qty < 1 or p_qty > 20 then raise exception 'Quantity must be between 1 and 20.'; end if;
  if nullif(btrim(p_name), '') is null then raise exception 'Enter your name.'; end if;
  if p_selections is null or jsonb_typeof(p_selections) <> 'array' then p_selections := '[]'::jsonb; end if;

  -- serialize requests per shop so the last slot cannot be taken twice
  perform pg_advisory_xact_lock(hashtext(off.shop_id::text));

  if off.slots_total is not null then
    select count(*) into active_all from public.custom_requests
     where offer_id = off.id and status in ('Requested', 'Accepted', 'InProgress', 'Ready');
    if active_all >= off.slots_total then raise exception 'All slots for this option are taken right now.'; end if;
  end if;
  select count(*) into active_buyer from public.custom_requests
   where shop_id = off.shop_id and buyer_id = uid and status in ('Requested', 'Accepted', 'InProgress', 'Ready');
  if active_buyer >= 3 then raise exception 'You already have 3 active custom requests with this shop.'; end if;

  unit := off.base_price;
  for g in select * from jsonb_array_elements(off.options) loop
    kind := coalesce(g->>'kind', 'single');
    req := coalesce((g->>'required')::boolean, false);
    sel := null;
    select s into sel from jsonb_array_elements(p_selections) s where s->>'groupId' = g->>'id' limit 1;

    if kind = 'text' then
      txt := left(btrim(coalesce(sel->>'text', '')), 200);
      if req and txt = '' then raise exception '"%" is required.', g->>'label'; end if;
      if txt <> '' then
        resolved := resolved || jsonb_build_object('groupId', g->>'id', 'label', g->>'label', 'kind', 'text', 'text', txt);
      end if;
    else
      picks := '{}';
      if sel is not null and jsonb_typeof(sel->'picks') = 'array' then
        select coalesce(array_agg(distinct x), '{}') into picks from jsonb_array_elements_text(sel->'picks') x;
      end if;
      mx := case when kind = 'single' then 1 else coalesce((g->>'max')::int, 12) end;
      if req and cardinality(picks) = 0 then raise exception 'Choose an option for "%".', g->>'label'; end if;
      if cardinality(picks) > mx then raise exception 'Choose at most % for "%".', mx, g->>'label'; end if;
      picked := '[]'::jsonb;
      foreach pick in array picks loop
        ch := null;
        select c into ch from jsonb_array_elements(coalesce(g->'choices', '[]'::jsonb)) c where c->>'id' = pick limit 1;
        if ch is null then raise exception 'One of those choices is no longer available.'; end if;
        unit := unit + greatest(coalesce((ch->>'price')::numeric, 0), 0);
        picked := picked || jsonb_build_object('choiceId', pick, 'label', ch->>'label',
                                               'price', greatest(coalesce((ch->>'price')::numeric, 0), 0));
      end loop;
      if jsonb_array_length(picked) > 0 then
        resolved := resolved || jsonb_build_object('groupId', g->>'id', 'label', g->>'label', 'kind', kind, 'picks', picked);
      end if;
    end if;
  end loop;
  total := round(unit * p_qty, 2);

  loop
    new_code := 'C-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));
    exit when not exists (select 1 from public.custom_requests where code = new_code);
    tries := tries + 1;
    if tries > 10 then raise exception 'Could not create a request code. Please try again.'; end if;
  end loop;

  insert into public.custom_requests (offer_id, shop_id, buyer_id, buyer_name, code, selections, qty, note, est_total)
  values (off.id, off.shop_id, uid, left(btrim(p_name), 60), new_code, resolved, p_qty, left(coalesce(p_note, ''), 400), total)
  returning id into new_id;
  return jsonb_build_object('id', new_id, 'code', new_code, 'estTotal', total);
end;
$$;

-- ---------- Buyer cancels (only before the seller starts working) ----------
create or replace function public.cancel_custom_request(req_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.custom_requests set status = 'Cancelled', updated_at = now()
   where id = req_id and buyer_id = auth.uid() and status in ('Requested', 'Accepted');
  if not found then raise exception 'Request not found, or the seller has already started on it.'; end if;
end;
$$;

-- ---------- Seller moves a request along ----------
-- Requested -> Accepted | Declined;  Accepted -> InProgress | Ready | Cancelled;
-- InProgress -> Ready | Cancelled;  Ready -> Completed | Cancelled
create or replace function public.set_custom_request(
  req_id uuid, new_status text, new_quote numeric, new_note text, new_eta date
)
returns void language plpgsql security definer set search_path = public as $$
declare
  current_status text;
  allowed boolean;
begin
  select status into current_status from public.custom_requests where id = req_id and shop_id = auth.uid() for update;
  if not found then raise exception 'Request not found.'; end if;
  allowed := case current_status
    when 'Requested' then new_status in ('Accepted', 'Declined')
    when 'Accepted' then new_status in ('InProgress', 'Ready', 'Cancelled')
    when 'InProgress' then new_status in ('Ready', 'Cancelled')
    when 'Ready' then new_status in ('Completed', 'Cancelled')
    else false end;
  if not allowed then raise exception 'You can''t change a request from "%" to "%".', current_status, new_status; end if;
  if new_quote is not null and (new_quote < 0 or new_quote > 1000000) then raise exception 'That price is not valid.'; end if;

  update public.custom_requests
     set status = new_status,
         quoted_total = coalesce(round(new_quote, 2), quoted_total, case when new_status = 'Accepted' then est_total end),
         seller_note = coalesce(left(new_note, 300), seller_note),
         eta = coalesce(new_eta, eta),
         updated_at = now()
   where id = req_id;
end;
$$;

-- Seller adjusts the quote / note / ready date without changing the status
create or replace function public.update_custom_quote(req_id uuid, new_quote numeric, new_note text, new_eta date)
returns void language plpgsql security definer set search_path = public as $$
begin
  if new_quote is not null and (new_quote < 0 or new_quote > 1000000) then raise exception 'That price is not valid.'; end if;
  update public.custom_requests
     set quoted_total = coalesce(round(new_quote, 2), quoted_total),
         seller_note = coalesce(left(new_note, 300), seller_note),
         eta = coalesce(new_eta, eta),
         updated_at = now()
   where id = req_id and shop_id = auth.uid() and status in ('Requested', 'Accepted', 'InProgress', 'Ready');
  if not found then raise exception 'Request not found or already closed.'; end if;
end;
$$;

-- ---------- Buyer's own requests ----------
create or replace function public.my_custom_requests()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id, 'code', r.code, 'status', r.status, 'qty', r.qty, 'note', r.note,
           'selections', r.selections, 'estTotal', r.est_total, 'quotedTotal', r.quoted_total,
           'sellerNote', r.seller_note, 'eta', r.eta, 'createdAt', r.created_at,
           'title', o.title, 'shopName', s.shop_name, 'shopSlug', coalesce(s.showcase_slug, s.username), 'currency', s.currency
         ) order by r.created_at desc), '[]'::jsonb)
    from public.custom_requests r
    join public.custom_offers o on o.id = r.offer_id
    join public.shops s on s.id = r.shop_id
   where r.buyer_id = auth.uid();
$$;

revoke execute on function public.submit_custom_request(uuid, jsonb, int, text, text) from public;
revoke execute on function public.cancel_custom_request(uuid) from public;
revoke execute on function public.set_custom_request(uuid, text, numeric, text, date) from public;
revoke execute on function public.update_custom_quote(uuid, numeric, text, date) from public;
revoke execute on function public.my_custom_requests() from public;
grant execute on function public.public_shop_offers(text) to anon, authenticated;
grant execute on function public.submit_custom_request(uuid, jsonb, int, text, text) to authenticated;
grant execute on function public.cancel_custom_request(uuid) to authenticated;
grant execute on function public.set_custom_request(uuid, text, numeric, text, date) to authenticated;
grant execute on function public.update_custom_quote(uuid, numeric, text, date) to authenticated;
grant execute on function public.my_custom_requests() to authenticated;
