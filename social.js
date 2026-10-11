import { sb } from './supabaseClient';

// Public profile numbers for a shop (followers, likes, and the signed-in buyer's own follow/likes).
export async function fetchProfile(slug) {
  const res = await sb.rpc('public_shop_profile', { shop_slug: slug });
  if (res.error) throw res.error;
  return res.data; // null when the shop is unknown
}

export async function toggleFollow(slug) {
  const res = await sb.rpc('toggle_follow', { shop_slug: slug });
  if (res.error) throw res.error;
  return res.data; // { following, followers }
}

export async function toggleLike(slug, productId) {
  const res = await sb.rpc('toggle_like', { shop_slug: slug, liked_product_id: productId });
  if (res.error) throw res.error;
  return res.data; // { liked, count }
}

export async function myFollowing() {
  const res = await sb.rpc('my_following');
  if (res.error) throw res.error;
  return res.data || [];
}

export async function myLikedProducts() {
  const res = await sb.rpc('my_liked_products');
  if (res.error) throw res.error;
  return res.data || [];
}
