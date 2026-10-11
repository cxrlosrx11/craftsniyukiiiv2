-- Customizable seller profiles: cover banner, color theme, tagline, location, status,
-- featured products and shop policies, plus a shops directory for the home page.
-- Run once in the Supabase SQL Editor AFTER supabase-support-and-social.sql. Safe to re-run.

do $$
begin
  if to_regclass('public.shop_support') is null or to_regclass('public.follows') is null then
    raise exception 'Run supabase-support-and-social.sql first, then run this file again.';
  end if;
end $$;

alter table public.shop_support
  add column if not exists cover text not null default '',
  add column if not exists tagline text not null default '',
  add column if not exists location text not null default '',
  add column if not exists status text not null default 'open',
  add column if not exists theme text not null default 'rose',
  add column if not exists policies text not null default '',
  add column if not exists featured jsonb not null default '[]'::jsonb;

alter table public.shop_support drop constraint if exists shop_support_profile_chk;
alter table public.shop_support add constraint shop_support_profile_chk check (
  char_length(cover) <= 250000 and (cover = '' or cover like 'data:image/%')
  and char_length(tagline) <= 80
  and char_length(location) <= 60
  and status in ('open', 'away', 'commissions')
  and theme in ('rose', 'lavender', 'mint', 'sky', 'peach', 'slate')
  and char_length(policies) <= 800
  and jsonb_typeof(featured) = 'array' and jsonb_array_length(featured) <= 6
);

-- ---------- Public profile now includes the customization ----------
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
    'cover', coalesce(sup.cover, ''),
    'tagline', coalesce(sup.tagline, ''),
    'location', coalesce(sup.location, ''),
    'status', coalesce(sup.status, 'open'),
    'theme', coalesce(sup.theme, 'rose'),
    'policies', coalesce(sup.policies, ''),
    'featured', coalesce(sup.featured, '[]'::jsonb),
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

-- ---------- Shops directory (home page strip): shops that have something in stock ----------
create or replace function public.public_shop_directory()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x order by x.followers desc, x."shopName"), '[]'::jsonb) from (
    select coalesce(s.showcase_slug, s.username) as slug,
           s.shop_name as "shopName",
           case when length(coalesce(sp.avatar, '')) <= 60000 then coalesce(sp.avatar, '') else '' end as avatar,
           coalesce(sp.tagline, '') as tagline,
           (select count(*) from public.follows f where f.shop_id = s.id) as followers
      from public.shops s
      left join public.shop_support sp on sp.shop_id = s.id
     where exists (
       select 1 from public.shop_data d, jsonb_array_elements(coalesce(d.data->'products', '[]'::jsonb)) p
        where d.shop_id = s.id
          and not coalesce((p->>'archived')::boolean, false)
          and coalesce((p->>'stock')::numeric, 0) > 0)
     limit 24
  ) x;
$$;

grant execute on function public.public_shop_profile(text) to anon, authenticated;
grant execute on function public.public_shop_directory() to anon, authenticated;
