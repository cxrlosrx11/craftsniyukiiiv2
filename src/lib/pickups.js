import { sb } from './supabaseClient';

const unwrap = (res) => { if (res.error) throw res.error; return res.data; };

/* ---------- seller ---------- */
export async function listEvents(shopId) {
  return unwrap(await sb.from('shop_events').select('*').eq('shop_id', shopId).order('starts_on', { ascending: true })) || [];
}

export async function saveEvent(shopId, ev) {
  const row = {
    name: ev.name.trim().slice(0, 80), venue: (ev.venue || '').trim().slice(0, 80), booth: (ev.booth || '').trim().slice(0, 30),
    starts_on: ev.startsOn, ends_on: ev.endsOn, reserve_enabled: !!ev.reserveEnabled, note: (ev.note || '').trim().slice(0, 200)
  };
  if (ev.id) return unwrap(await sb.from('shop_events').update(row).eq('id', ev.id));
  return unwrap(await sb.from('shop_events').insert({ ...row, shop_id: shopId }));
}

export async function setReserveEnabled(id, enabled) {
  return unwrap(await sb.from('shop_events').update({ reserve_enabled: enabled }).eq('id', id));
}

export async function deleteEvent(id) {
  return unwrap(await sb.from('shop_events').delete().eq('id', id));
}

export async function listReservations(shopId) {
  return unwrap(await sb.from('reservations').select('*').eq('shop_id', shopId).order('created_at', { ascending: false }).limit(300)) || [];
}

export async function setReservationStatus(id, status) {
  return unwrap(await sb.rpc('set_reservation_status', { res_id: id, new_status: status }));
}

// Stock held for pickups, { productId: qty }. Used by the POS.
export async function myShopHolds() {
  return unwrap(await sb.rpc('my_shop_holds')) || {};
}

/* ---------- public / buyer ---------- */
export async function fetchPublicEvents(slug) {
  return unwrap(await sb.rpc('public_shop_events', { shop_slug: slug })); // { events, held } or null
}

export async function reserveItems(eventId, items, note, name) {
  return unwrap(await sb.rpc('reserve_items', { p_event: eventId, p_items: items, p_note: note, p_name: name }));
}

export async function cancelReservation(id) {
  return unwrap(await sb.rpc('cancel_reservation', { res_id: id }));
}

export async function myReservations() {
  return unwrap(await sb.rpc('my_reservations')) || [];
}

/* ---------- dates (events use plain YYYY-MM-DD) ---------- */
export function todayStr(now = new Date()) {
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
}

function parseDay(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function fmtRange(startsOn, endsOn) {
  const a = parseDay(startsOn), b = parseDay(endsOn);
  const md = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (startsOn === endsOn) return md(a);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) return md(a) + '–' + b.getDate();
  return md(a) + ' – ' + md(b);
}

export function itemsText(items) {
  return (items || []).map((it) => `${it.qty}× ${it.name}`).join(', ');
}
