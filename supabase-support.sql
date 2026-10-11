-- "Support the shop" (tip jar, funding goal, supporter wall, shop profile).
-- Run once in the Supabase SQL Editor. Safe to re-run.
--
-- How tips work: the app does NOT move money. A buyer pays the seller directly
-- (GCash, Maya, GoTyme...) and then logs the tip here. The seller checks their
-- own payment app and presses Confirm, and only confirmed tips count toward the
-- goal and appear on the supporter wall.

-- ---------- Shop profile / settings (one row per shop) ----------
create table if not exists public.shop_support (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  tips_enabled boolean not null default false,
  bio text not null default '',
  announcement text not null default '',
  links jsonb not null default '[]'::jsonb,        -- [{label, url}]
  pay_methods jsonb not null default '[]'::jsonb,  -- [{method, number, accountName}]
  goal_title text not null default '',
  goal_amount numeric(12,2) not null default 0,
  goal_started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shop_support_len check (
    char_length(bio) <= 600 and char_length(announcement) <= 200 and char_length(goal_title) <= 80
    and jsonb_typeof(links) = 'array' and jsonb_typeof(pay_methods) = 'array'
    and jsonb_array_length(links) <= 6 and jsonb_array_length(pay_methods) <= 5
  )
);
alter table public.shop_support enable row level security;

drop policy if exists "Owner reads support settings" on public.shop_support;
create policy "Owner reads support settings" on public.shop_support
  for select using (auth.uid() = shop_id);
drop policy if exists "Owner inserts support settings" on public.shop_support;
create policy "Owner inserts support settings" on public.shop_support
  for insert with check (auth.uid() = shop_id);
drop policy if exists "Owner updates support settings" on public.shop_support;
create policy "Owner updates support settings" on public.shop_support
  for update using (auth.uid() = shop_id);

-- ---------- Tips ----------
create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  amount numeric(12,2) not null check (amount >= 1 and amount <= 100000),
  message text not null default '' check (char_length(message) <= 280),
  method text not null default '' check (char_length(method) <= 30),
  reference text not null default '' check (char_length(reference) <= 40),
  is_public boolean not null default true,
  status text not null default 'Pending' check (status in ('Pending', 'Confirmed', 'Declined')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists tips_shop_idx on public.tips (shop_id, status, created_at desc);
alter table public.tips enable row level security;

-- Sellers see tips sent to them; buyers see their own. No insert/update policies:
-- all writes go through the functions below.
drop policy if exists "Seller or sender reads tips" on public.tips;
create policy "Seller or sender reads tips" on public.tips
  for select using (auth.uid() = shop_id or auth.uid() = buyer_id);

-- ---------- Public read: what a shop page may show ----------
create or replace function public.public_shop_support(shop_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  shop_row public.shops;
  sup public.shop_support;
  raised numeric;
  supporters jsonb;
begin
  select * into shop_row from public.shops where coalesce(showcase_slug, username) = shop_slug limit 1;
  if not found then return null; end if;
  select * into sup from public.shop_support where shop_id = shop_row.id;
  if not found then return jsonb_build_object('enabled', false); end if;

  select coalesce(sum(amount), 0) into raised from public.tips
   where shop_id = shop_row.id and status = 'Confirmed' and created_at >= sup.goal_started_at;
  select coalesce(jsonb_agg(x), '[]'::jsonb) into supporters from (
    select display_name as name, amount, message, created_at as date
    from public.tips
    where shop_id = shop_row.id and status = 'Confirmed' and is_public
    order by created_at desc limit 8
  ) x;

  return jsonb_build_object(
    'enabled', sup.tips_enabled,
    'currency', shop_row.currency,
    'bio', sup.bio,
    'announcement', sup.announcement,
    'links', sup.links,
    'payMethods', case when sup.tips_enabled then sup.pay_methods else '[]'::jsonb end,
    'goalTitle', sup.goal_title,
    'goalAmount', sup.goal_amount,
    'raised', raised,
    'supporters', case when sup.tips_enabled then supporters else '[]'::jsonb end
  );
end;
$$;

-- ---------- Buyer logs a tip they have sent ----------
create or replace function public.submit_tip(
  shop_slug text, tip_name text, tip_amount numeric, tip_message text,
  tip_method text, tip_reference text, tip_public boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  shop_row public.shops;
  sup public.shop_support;
  waiting int;
  new_id uuid;
begin
  if uid is null then raise exception 'Please log in to send a tip.'; end if;
  if not exists (select 1 from public.buyers where id = uid) then
    raise exception 'Only buyer accounts can send tips.';
  end if;
  select * into shop_row from public.shops where coalesce(showcase_slug, username) = shop_slug limit 1;
  if not found then raise exception 'Shop not found.'; end if;
  select * into sup from public.shop_support where shop_id = shop_row.id;
  if not found or not sup.tips_enabled then raise exception 'This shop is not accepting tips right now.'; end if;
  if tip_amount is null or tip_amount < 1 or tip_amount > 100000 then
    raise exception 'Enter an amount between 1 and 100,000.';
  end if;
  if nullif(btrim(tip_name), '') is null then raise exception 'Enter a name to show.'; end if;
  select count(*) into waiting from public.tips
   where shop_id = shop_row.id and buyer_id = uid and status = 'Pending';
  if waiting >= 3 then
    raise exception 'You already have 3 tips waiting for this seller to confirm.';
  end if;

  insert into public.tips (shop_id, buyer_id, display_name, amount, message, method, reference, is_public)
  values (shop_row.id, uid, left(btrim(tip_name), 60), round(tip_amount, 2),
          left(coalesce(tip_message, ''), 280), left(coalesce(tip_method, ''), 30),
          left(coalesce(tip_reference, ''), 40), coalesce(tip_public, true))
  returning id into new_id;
  return new_id;
end;
$$;

-- ---------- Seller confirms or declines ----------
create or replace function public.review_tip(tip_id uuid, new_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_status not in ('Confirmed', 'Declined') then raise exception 'Invalid status.'; end if;
  update public.tips set status = new_status, reviewed_at = now()
   where id = tip_id and shop_id = auth.uid() and status = 'Pending';
  if not found then raise exception 'Tip not found or already handled.'; end if;
end;
$$;

revoke execute on function public.submit_tip(text, text, numeric, text, text, text, boolean) from public;
revoke execute on function public.review_tip(uuid, text) from public;
grant execute on function public.public_shop_support(text) to anon, authenticated;
grant execute on function public.submit_tip(text, text, numeric, text, text, text, boolean) to authenticated;
grant execute on function public.review_tip(uuid, text) to authenticated;
