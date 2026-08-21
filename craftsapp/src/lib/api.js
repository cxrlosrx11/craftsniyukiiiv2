import { sb } from './supabaseClient';
import { defaultShopData } from './constants';

export function shopRowToShop(row) {
  return {
    id: row.id, shopName: row.shop_name, username: row.username, email: row.email,
    currency: row.currency, showcaseSlug: row.showcase_slug, createdAt: row.created_at
  };
}

export async function loadShopProfile(userId) {
  const res = await sb.from('shops').select('*').eq('id', userId).maybeSingle();
  if (res.error || !res.data) return null;
  return shopRowToShop(res.data);
}

// Never silently falls back to empty data on a read failure — a failed read
// throws, and callers must catch it rather than treat it as "new/empty shop".
// This is the fix for the bug that previously wiped an account: a failed
// read used to resolve to defaultShopData(), and the next save would then
// overwrite the real row with that empty blob.
export async function loadShopData(shopId) {
  const res = await sb.from('shop_data').select('data').eq('shop_id', shopId).maybeSingle();
  if (res.error) {
    throw res.error;
  }
  const d = Object.assign(defaultShopData(), (res.data && res.data.data) || {});
  if (!d.customCategories) d.customCategories = [];
  if (!d.customCostTypes) d.customCostTypes = [];
  return d;
}

let saveTimer = null;
// Debounced save — same 500ms debounce as the original app. dataLoaded must
// be true (i.e. a real load succeeded this session) or the save is refused.
export function saveShopData(shopId, snapshot, dataLoaded) {
  if (!shopId) return Promise.resolve();
  if (!dataLoaded) {
    console.error('saveShopData blocked — shop data was never successfully loaded from the server for this session.');
    return Promise.resolve();
  }
  if (saveTimer) clearTimeout(saveTimer);
  return new Promise((resolve) => {
    saveTimer = setTimeout(() => {
      sb.from('shop_data')
        .update({ data: snapshot, updated_at: new Date().toISOString() })
        .eq('shop_id', shopId)
        .then(() => resolve());
    }, 500);
  });
}

export function saveShopProfile(shop) {
  if (!shop) return Promise.resolve();
  return sb.from('shops').update({
    shop_name: shop.shopName,
    currency: shop.currency
  }).eq('id', shop.id);
}
