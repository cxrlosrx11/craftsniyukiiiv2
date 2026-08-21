-- Run this in the Supabase SQL Editor for a fresh project.
-- Matches the table/column names the React app (src/lib/api.js) expects.

create table if not exists public.shops (
  id uuid primary key references auth.users(id) on delete cascade,
  shop_name text not null,
  username text unique not null,
  email text not null,
  currency text not null default 'PHP',
  showcase_slug text,
  created_at timestamptz not null default now()
);

create table if not exists public.shop_data (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.shops enable row level security;
alter table public.shop_data enable row level security;

create policy "Users can read their own shop" on public.shops
  for select using (auth.uid() = id);
create policy "Users can update their own shop" on public.shops
  for update using (auth.uid() = id);
create policy "Users can insert their own shop" on public.shops
  for insert with check (auth.uid() = id);

create policy "Users can read their own shop_data" on public.shop_data
  for select using (auth.uid() = shop_id);
create policy "Users can update their own shop_data" on public.shop_data
  for update using (auth.uid() = shop_id);
create policy "Users can insert their own shop_data" on public.shop_data
  for insert with check (auth.uid() = shop_id);

-- Lets the app look up an email by username for the "log in with username" flow,
-- without exposing the shops table's email column broadly via RLS.
create or replace function public.email_for_username(uname text)
returns text
language sql
security definer
set search_path = public
as $$
  select email from public.shops where username = lower(uname) limit 1;
$$;

grant execute on function public.email_for_username(text) to anon, authenticated;
