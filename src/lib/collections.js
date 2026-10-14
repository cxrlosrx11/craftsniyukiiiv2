import { sb } from './supabaseClient';
import { myReservations } from './pickups.js';

const unwrap = (res) => { if (res.error) throw res.error; return res.data; };

/* ---------- seller ---------- */
export async function listCollections(shopId) {
  return unwrap(await sb.from('collections').select('*').eq('shop_id', shopId).order('created_at', { ascending: true })) || [];
}

export function normalizeCollection(f) {
  const title = (f.title || '').trim();
  if (!title) throw new Error('Give this set a name.');
  const ids = Array.from(new Set(f.productIds || [])).slice(0, 24);
  if (ids.length < 2) throw new Error('Pick at least 2 products for a set.');
  return {
    title: title.slice(0, 60), description: (f.description || '').trim().slice(0, 200),
    perk: (f.perk || '').trim().slice(0, 120), product_ids: ids, is_published: !!f.isPublished
  };
}

export async function saveCollection(shopId, f) {
  const row = normalizeCollection(f);
  if (f.id) return unwrap(await sb.from('collections').update(row).eq('id', f.id));
  return unwrap(await sb.from('collections').insert({ ...row, shop_id: shopId }));
}
export async function setPublished(id, on) { return unwrap(await sb.from('collections').update({ is_published: on }).eq('id', id)); }
export async function deleteCollection(id) { return unwrap(await sb.from('collections').delete().eq('id', id)); }
export async function collectionStats() { return unwrap(await sb.rpc('collection_stats')) || []; }

/* ---------- public / buyer ---------- */
export async function fetchPublicCollections(slug) { return unwrap(await sb.rpc('public_shop_collections', { shop_slug: slug })) || []; }
export async function toggleOwned(slug, productId) { return unwrap(await sb.rpc('toggle_owned', { shop_slug: slug, owned_product_id: productId })); }
export async function syncOwned(slug, ids) { return unwrap(await sb.rpc('sync_owned', { shop_slug: slug, found_product_ids: ids })); }

// Product ids a buyer has really bought: confirmed online orders + picked-up convention reservations.
export async function detectOwnedFromPurchases() {
  const found = new Set();
  const orders = await sb.from('orders').select('*');
  if (!orders.error) {
    (orders.data || []).filter((o) => o.status === 'Confirmed').forEach((o) => (o.items || []).forEach((it) => it.productId && found.add(it.productId)));
  }
  try {
    (await myReservations()).filter((r) => r.status === 'PickedUp').forEach((r) => (r.items || []).forEach((it) => it.productId && found.add(it.productId)));
  } catch (e) { /* convention mode not installed yet */ }
  return found;
}
