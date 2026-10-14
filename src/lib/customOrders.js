import { sb } from './supabaseClient';

const unwrap = (res) => { if (res.error) throw res.error; return res.data; };
export const newId = (prefix) => prefix + Math.random().toString(36).slice(2, 8);

export const KINDS = { single: 'Pick one', multi: 'Pick several', text: 'Text (e.g. a name)' };
export const ACTIVE = ['Requested', 'Accepted', 'InProgress', 'Ready'];
export const STATUS_LABEL = {
  Requested: 'New request', Accepted: 'Accepted', InProgress: 'In progress', Ready: 'Ready',
  Completed: 'Completed', Declined: 'Declined', Cancelled: 'Cancelled'
};

/* ---------- seller ---------- */
export async function listOffers(shopId) {
  return unwrap(await sb.from('custom_offers').select('*').eq('shop_id', shopId).order('created_at', { ascending: true })) || [];
}

// Cleans the editor form into what the database accepts. Throws a readable message if something is missing.
export function normalizeOffer(f) {
  const title = (f.title || '').trim();
  if (!title) throw new Error('Give this custom order a name.');
  const options = (f.options || []).map((g) => {
    const label = (g.label || '').trim().slice(0, 40);
    if (!label) return null;
    const kind = KINDS[g.kind] ? g.kind : 'single';
    if (kind === 'text') return { id: g.id, label, kind, required: !!g.required };
    const choices = (g.choices || [])
      .map((c) => ({ id: c.id, label: (c.label || '').trim().slice(0, 40), price: Math.max(0, Math.round((Number(c.price) || 0) * 100) / 100) }))
      .filter((c) => c.label).slice(0, 12);
    if (choices.length === 0) throw new Error(`Add at least one choice to "${label}".`);
    const out = { id: g.id, label, kind, required: !!g.required, choices };
    if (kind === 'multi') out.max = Math.max(1, Math.min(12, Number(g.max) || 2));
    return out;
  }).filter(Boolean).slice(0, 6);
  const slots = Number(f.slotsTotal);
  return {
    title: title.slice(0, 80),
    description: (f.description || '').trim().slice(0, 400),
    base_price: Math.max(0, Number(f.basePrice) || 0),
    lead_time_days: Math.max(0, Math.min(365, Math.round(Number(f.leadTimeDays) || 0))),
    slots_total: slots >= 1 ? Math.min(50, Math.round(slots)) : null,
    is_open: !!f.isOpen,
    options
  };
}

export async function saveOffer(shopId, f) {
  const row = normalizeOffer(f);
  if (f.id) return unwrap(await sb.from('custom_offers').update(row).eq('id', f.id));
  return unwrap(await sb.from('custom_offers').insert({ ...row, shop_id: shopId }));
}
export async function setOfferOpen(id, open) { return unwrap(await sb.from('custom_offers').update({ is_open: open }).eq('id', id)); }
export async function deleteOffer(id) { return unwrap(await sb.from('custom_offers').delete().eq('id', id)); }

export async function listRequests(shopId) {
  return unwrap(await sb.from('custom_requests').select('*').eq('shop_id', shopId).order('created_at', { ascending: false }).limit(300)) || [];
}
export async function setRequestStatus(id, status, { quote = null, note = null, eta = null } = {}) {
  return unwrap(await sb.rpc('set_custom_request', { req_id: id, new_status: status, new_quote: quote, new_note: note, new_eta: eta }));
}
export async function updateQuote(id, { quote = null, note = null, eta = null } = {}) {
  return unwrap(await sb.rpc('update_custom_quote', { req_id: id, new_quote: quote, new_note: note, new_eta: eta }));
}

/* ---------- public / buyer ---------- */
export async function fetchPublicOffers(slug) { return unwrap(await sb.rpc('public_shop_offers', { shop_slug: slug })) || []; }
export async function submitRequest(offerId, selections, qty, note, name) {
  return unwrap(await sb.rpc('submit_custom_request', { p_offer: offerId, p_selections: selections, p_qty: qty, p_note: note, p_name: name }));
}
export async function cancelRequest(id) { return unwrap(await sb.rpc('cancel_custom_request', { req_id: id })); }
export async function myRequests() { return unwrap(await sb.rpc('my_custom_requests')) || []; }

/* ---------- display helpers ---------- */
// One readable line per chosen option, e.g. "Charms: Star, Moon" or "Name: Bea".
export function selectionLines(selections) {
  return (selections || []).map((s) => (s.kind === 'text' ? `${s.label}: ${s.text}` : `${s.label}: ${(s.picks || []).map((p) => p.label).join(', ')}`));
}

// Live price preview in the request form (the database recalculates the real price).
export function estimate(offer, picks, qty) {
  let unit = Number(offer.basePrice) || 0;
  (offer.options || []).forEach((g) => {
    if (g.kind === 'text') return;
    (picks[g.id] || []).forEach((cid) => {
      const c = (g.choices || []).find((x) => x.id === cid);
      if (c) unit += Number(c.price) || 0;
    });
  });
  return Math.round(unit * qty * 100) / 100;
}

export function addDaysStr(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
