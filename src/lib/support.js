import { sb } from './supabaseClient';

// Only allow web links; anything else (e.g. "javascript:") is dropped.
export function safeUrl(raw) {
  const v = (raw || '').trim();
  if (!v) return '';
  const withProto = /^https?:\/\//i.test(v) ? v : (/^[a-z][a-z0-9+.-]*:/i.test(v) ? '' : 'https://' + v);
  try {
    const u = new URL(withProto);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : '';
  } catch (e) { return ''; }
}

export const emptySupport = () => ({
  tipsEnabled: false, bio: '', announcement: '', links: [], payMethods: [],
  goalTitle: '', goalAmount: 0
});

function rowToSupport(r) {
  return {
    tipsEnabled: !!r.tips_enabled, bio: r.bio || '', announcement: r.announcement || '',
    links: Array.isArray(r.links) ? r.links : [], payMethods: Array.isArray(r.pay_methods) ? r.pay_methods : [],
    goalTitle: r.goal_title || '', goalAmount: Number(r.goal_amount) || 0
  };
}

export async function loadSupport(shopId) {
  const res = await sb.from('shop_support').select('*').eq('shop_id', shopId).maybeSingle();
  if (res.error) throw res.error;
  return res.data ? rowToSupport(res.data) : emptySupport();
}

export async function saveSupport(shopId, s) {
  const links = s.links.map((l) => ({ label: (l.label || '').trim().slice(0, 30), url: safeUrl(l.url) })).filter((l) => l.url).slice(0, 6);
  const payMethods = s.payMethods
    .map((m) => ({ method: (m.method || '').trim().slice(0, 30), number: (m.number || '').trim().slice(0, 40), accountName: (m.accountName || '').trim().slice(0, 60) }))
    .filter((m) => m.method && m.number).slice(0, 5);
  const res = await sb.from('shop_support').upsert({
    shop_id: shopId, tips_enabled: !!s.tipsEnabled,
    bio: s.bio.trim().slice(0, 600), announcement: s.announcement.trim().slice(0, 200),
    links, pay_methods: payMethods,
    goal_title: s.goalTitle.trim().slice(0, 80), goal_amount: Math.max(0, Number(s.goalAmount) || 0),
    updated_at: new Date().toISOString()
  }, { onConflict: 'shop_id' });
  if (res.error) throw res.error;
  return { ...s, links, payMethods };
}

// Start a fresh goal: only tips confirmed from now on count toward it.
export async function restartGoal(shopId) {
  const res = await sb.from('shop_support').update({ goal_started_at: new Date().toISOString() }).eq('shop_id', shopId);
  if (res.error) throw res.error;
}

export async function fetchPublicSupport(slug) {
  const res = await sb.rpc('public_shop_support', { shop_slug: slug });
  if (res.error) throw res.error;
  return res.data; // null when the shop is unknown
}

export async function submitTip(slug, t) {
  const res = await sb.rpc('submit_tip', {
    shop_slug: slug, tip_name: t.name, tip_amount: t.amount, tip_message: t.message,
    tip_method: t.method, tip_reference: t.reference, tip_public: t.isPublic
  });
  if (res.error) throw res.error;
  return res.data;
}

export async function loadTips(shopId) {
  const res = await sb.from('tips').select('*').eq('shop_id', shopId).order('created_at', { ascending: false }).limit(100);
  if (res.error) throw res.error;
  return res.data || [];
}

export async function reviewTip(tipId, status) {
  const res = await sb.rpc('review_tip', { tip_id: tipId, new_status: status });
  if (res.error) throw res.error;
}
