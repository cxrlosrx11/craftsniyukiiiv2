-- Keeps buyer accounts and seller accounts separate.
-- Run in the Supabase SQL Editor, ONE STEP AT A TIME, reading each result.

-- ============================================================
-- STEP 1 (read-only): find accounts that are both a buyer and a seller
-- (or were signed up as a buyer but own a shop row).
-- ============================================================
select u.email,
       u.raw_user_meta_data->>'role' as signed_up_as,
       s.shop_name, s.username,
       coalesce(jsonb_array_length(d.data->'products'), 0) as products,
       coalesce(jsonb_array_length(d.data->'sales'), 0)    as sales
from auth.users u
join public.shops s on s.id = u.id
left join public.shop_data d on d.shop_id = s.id
where u.raw_user_meta_data->>'role' = 'buyer'
   or exists (select 1 from public.buyers b where b.id = u.id);

-- ============================================================
-- STEP 2 (read-only preview): which of those are SAFE to clean up?
-- Only buyer-signed-up accounts whose shop has no products and no sales.
-- ============================================================
select s.id, u.email, s.shop_name
from public.shops s
join auth.users u on u.id = s.id
left join public.shop_data d on d.shop_id = s.id
where u.raw_user_meta_data->>'role' = 'buyer'
  and coalesce(jsonb_array_length(d.data->'products'), 0) = 0
  and coalesce(jsonb_array_length(d.data->'sales'), 0) = 0;

-- STEP 3 (optional, DELETES rows): remove those empty stray shops.
-- Only run this after checking the Step 2 list. Deleting a shop also deletes its
-- shop_data. Accounts with real products or sales are never touched here;
-- decide those one by one using the Step 1 list.
-- delete from public.shops where id in (
--   select s.id
--   from public.shops s
--   join auth.users u on u.id = s.id
--   left join public.shop_data d on d.shop_id = s.id
--   where u.raw_user_meta_data->>'role' = 'buyer'
--     and coalesce(jsonb_array_length(d.data->'products'), 0) = 0
--     and coalesce(jsonb_array_length(d.data->'sales'), 0) = 0
-- );

-- ============================================================
-- STEP 4: stop it happening again. A buyer account can no longer get a shop
-- row, and a seller account can no longer get a buyer row.
-- ============================================================
create or replace function public.block_cross_role()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if tg_table_name = 'shops' then
    if exists (select 1 from public.buyers where id = new.id)
       or exists (select 1 from auth.users where id = new.id and raw_user_meta_data->>'role' = 'buyer') then
      raise exception 'This is a buyer account and cannot open a shop. Use a different email to sell.';
    end if;
  elsif tg_table_name = 'buyers' then
    if exists (select 1 from public.shops where id = new.id)
       or exists (select 1 from auth.users where id = new.id and raw_user_meta_data->>'role' = 'seller') then
      raise exception 'This is a seller account and cannot be a buyer. Use a different email to buy.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists shops_block_buyer on public.shops;
create trigger shops_block_buyer before insert on public.shops
  for each row execute function public.block_cross_role();

drop trigger if exists buyers_block_seller on public.buyers;
create trigger buyers_block_seller before insert on public.buyers
  for each row execute function public.block_cross_role();
