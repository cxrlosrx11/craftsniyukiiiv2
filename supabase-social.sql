-- Seller profiles that buyers can follow, plus product likes.
-- Run once in the Supabase SQL Editor AFTER supabase-support.sql. Safe to re-run.

-- ---------- Profile photo (lives with the rest of the shop profile) ----------
alter table public.shop_support add column if not exists avatar text not null default '';
alter table public.shop_support drop constraint if exists shop_support_avatar_len;
alter table public.shop_support add constraint shop_support_avatar_len
  check (char_length(avatar) <= 150000 and (avatar = '' or avatar like 'data:image/%'));

-- ---------- Follows ----------
create table if not exists public.follows (
  buyer_id uuid not null references auth.users(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (buyer_id, shop_id)
);
create index if not exists follows_shop_idx on public.follows (shop_id);
alter table public.follows enable row level security;
-- A buyer sees only their own follows. Sellers get a follower COUNT, never a list.
drop policy if exists "Buyer reads own follows" on public.follows;
create policy "Buyer reads own follows" on public.follows for select using (auth.uid() = buyer_id);

-- ---------- Product likes ----------
create table if not exists public.product_likes (
  buyer_id uuid not null references auth.users(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  product_id text not null check (char_length(product_id) between 1 and 80),
  created_at timestamptz not null default now(),
  primary key (buyer_id, shop_id, product_id)
);
create index if not exists product_likes_shop_idx on public.product_likes (shop_id, product_id);
alter table public.product_likes enable row level security;
drop policy if exists "Buyer reads own likes" on public.product_likes;
create policy "Buyer reads own likes" on public.product_likes for select using (auth.uid() = buyer_id);

-- ---------- Public profile: everything a shop page shows ----------
create or replace function public.public_shop_profile(shop_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  shop_row public.shops;
  sup public.shop_support;
  followers int;
  total_likes int;
  product_count int;
  like_counts jsonb;
  my_likes jsonb := '[]'::jsonb;
  following boolean := false;
begin
  select * into shop_row from public.shops where coalesce(showcase_slug, username) = shop_slug limit 1;
  if not found then return null; end if;
  select * into sup from public.shop_support where shop_id = shop_row.id;

  select count(*) into followers from public.follows where shop_id = shop_row.id;
  select count(*) into total_likes from public.product_likes where shop_id = shop_row.id;
  select count(*) into product_count
    from public.shop_data d, jsonb_array_elements(coalesce(d.data->'products', '[]'::jsonb)) p
   where d.shop_id = shop_row.id
     and not coalesce((p->>'archived')::boolean, false)
     and coalesce((p->>'stock')::numeric, 0) > 0;
  select coalesce(jsonb_object_agg(product_id, c), '{}'::jsonb) into like_counts
    from (select product_id, count(*) as c from public.product_likes where shop_id = shop_row.id group by product_id) x;
  if uid is not null then
    following := exists (select 1 from public.follows where shop_id = shop_row.id and buyer_id = uid);
    select coalesce(jsonb_agg(product_id), '[]'::jsonb) into my_likes
      from public.product_likes where shop_id = shop_row.id and buyer_id = uid;
  end if;

  return jsonb_build_object(
    'shopName', shop_row.shop_name,
    'username', shop_row.username,
    'avatar', coalesce(sup.avatar, ''),
    'joined', shop_row.created_at,
    'productCount', product_count,
    'followers', followers,
    'totalLikes', total_likes,
    'likeCounts', like_counts,
    'following', following,
    'myLikes', my_likes
  );
end;
$$;

-- ---------- Follow / unfollow (toggle) ----------
create or replace function public.toggle_follow(shop_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  shop_row public.shops;
  now_following boolean;
  followers int;
begin
  if uid is null or not exists (select 1 from public.buyers where id = uid) then
    raise exception 'Log in with a buyer account to follow shops.';
  end if;
  select * into shop_row from public.shops where coalesce(showcase_slug, username) = shop_slug limit 1;
  if not found then raise exception 'Shop not found.'; end if;

  if exists (select 1 from public.follows where buyer_id = uid and shop_id = shop_row.id) then
    delete from public.follows where buyer_id = uid and shop_id = shop_row.id;
    now_following := false;
  else
    insert into public.follows (buyer_id, shop_id) values (uid, shop_row.id);
    now_following := true;
  end if;
  select count(*) into followers from public.follows where shop_id = shop_row.id;
  return jsonb_build_object('following', now_following, 'followers', followers);
end;
$$;

-- ---------- Like / unlike a product (toggle) ----------
create or replace function public.toggle_like(shop_slug text, liked_product_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  shop_row public.shops;
  now_liked boolean;
  like_count int;
begin
  if uid is null or not exists (select 1 from public.buyers where id = uid) then
    raise exception 'Log in with a buyer account to like products.';
  end if;
  select * into shop_row from public.shops where coalesce(showcase_slug, username) = shop_slug limit 1;
  if not found then raise exception 'Shop not found.'; end if;
  if not exists (
    select 1 from public.shop_data d, jsonb_array_elements(coalesce(d.data->'products', '[]'::jsonb)) p
     where d.shop_id = shop_row.id and p->>'id' = liked_product_id
       and not coalesce((p->>'archived')::boolean, false)
  ) then
    raise exception 'That product is no longer available.';
  end if;

  if exists (select 1 from public.product_likes where buyer_id = uid and shop_id = shop_row.id and product_id = liked_product_id) then
    delete from public.product_likes where buyer_id = uid and shop_id = shop_row.id and product_id = liked_product_id;
    now_liked := false;
  else
    insert into public.product_likes (buyer_id, shop_id, product_id) values (uid, shop_row.id, liked_product_id);
    now_liked := true;
  end if;
  select count(*) into like_count from public.product_likes where shop_id = shop_row.id and product_id = liked_product_id;
  return jsonb_build_object('liked', now_liked, 'count', like_count);
end;
$$;

-- ---------- A buyer's own lists ----------
create or replace function public.my_following()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'slug', coalesce(s.showcase_slug, s.username), 'shopName', s.shop_name, 'since', f.created_at
         ) order by f.created_at desc), '[]'::jsonb)
    from public.follows f join public.shops s on s.id = f.shop_id
   where f.buyer_id = auth.uid();
$$;

create or replace function public.my_liked_products()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'shopSlug', coalesce(s.showcase_slug, s.username), 'shopName', s.shop_name, 'currency', s.currency,
           'productId', l.product_id, 'name', p->>'name', 'price', p->'price'
         ) order by l.created_at desc), '[]'::jsonb)
    from public.product_likes l
    join public.shops s on s.id = l.shop_id
    join public.shop_data d on d.shop_id = l.shop_id
    cross join lateral jsonb_array_elements(coalesce(d.data->'products', '[]'::jsonb)) p
   where l.buyer_id = auth.uid() and p->>'id' = l.product_id
     and not coalesce((p->>'archived')::boolean, false);
$$;

revoke execute on function public.toggle_follow(text) from public;
revoke execute on function public.toggle_like(text, text) from public;
revoke execute on function public.my_following() from public;
revoke execute on function public.my_liked_products() from public;
grant execute on function public.public_shop_profile(text) to anon, authenticated;
grant execute on function public.toggle_follow(text) to authenticated;
grant execute on function public.toggle_like(text, text) to authenticated;
grant execute on function public.my_following() to authenticated;
grant execute on function public.my_liked_products() to authenticated;
