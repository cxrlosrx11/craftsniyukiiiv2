// Fun milestones computed from data the dashboard already has. Pure functions.

function dayKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function computeStats(data, now = new Date()) {
  const sales = data.sales || [];
  const units = (s) => (s.items || []).reduce((a, it) => a + (Number(it.qty) || 0), 0);
  const totalUnits = sales.reduce((a, s) => a + units(s), 0);
  const onlineOrders = sales.filter((s) => s.source === 'online').length;

  const byDay = new Map();
  sales.forEach((s) => {
    const d = new Date(s.date);
    if (isNaN(d.getTime())) return;
    const k = dayKey(d);
    byDay.set(k, (byDay.get(k) || 0) + units(s));
  });
  const bestDay = Array.from(byDay.values()).reduce((a, b) => Math.max(a, b), 0);

  // Current streak of consecutive days with at least one sale (today may still be empty).
  let streak = 0;
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!byDay.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (byDay.has(dayKey(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }

  // This week (last 7 days) vs the 7 days before.
  const DAY = 86400000;
  let thisWeek = 0, lastWeek = 0;
  sales.forEach((s) => {
    const age = (now.getTime() - new Date(s.date).getTime()) / DAY;
    if (age < 0) return;
    if (age < 7) thisWeek += units(s);
    else if (age < 14) lastWeek += units(s);
  });

  const products = (data.products || []).filter((p) => !p.archived).length;
  const conventions = (data.conventions || []).length;
  const feedbackCount = (data.feedback || []).length;
  return { totalUnits, onlineOrders, bestDay, streak, thisWeek, lastWeek, products, conventions, feedbackCount, saleCount: sales.length };
}

export const BADGES = [
  { id: 'first', title: 'First sale', desc: 'Record your first sale.', value: (s) => s.saleCount, goal: 1 },
  { id: 'u10', title: '10 pieces sold', desc: 'Sell 10 pieces in total.', value: (s) => s.totalUnits, goal: 10 },
  { id: 'u50', title: '50 pieces sold', desc: 'Sell 50 pieces in total.', value: (s) => s.totalUnits, goal: 50 },
  { id: 'u100', title: 'Century club', desc: 'Sell 100 pieces in total.', value: (s) => s.totalUnits, goal: 100 },
  { id: 'u500', title: 'Small shop, big heart', desc: 'Sell 500 pieces in total.', value: (s) => s.totalUnits, goal: 500 },
  { id: 'online', title: 'Online debut', desc: 'Confirm 5 online orders.', value: (s) => s.onlineOrders, goal: 5 },
  { id: 'streak', title: 'On a roll', desc: 'Make sales 3 days in a row.', value: (s) => s.streak, goal: 3 },
  { id: 'best', title: 'Big day', desc: 'Sell 10 pieces in a single day.', value: (s) => s.bestDay, goal: 10 },
  { id: 'catalog', title: 'Well stocked', desc: 'List 20 products.', value: (s) => s.products, goal: 20 },
  { id: 'con', title: 'Convention regular', desc: 'Log 3 conventions.', value: (s) => s.conventions, goal: 3 },
  { id: 'fans', title: 'Fan mail', desc: 'Collect 5 feedback entries.', value: (s) => s.feedbackCount, goal: 5 }
];

export function evaluateBadges(stats) {
  return BADGES.map((b) => {
    const v = b.value(stats);
    return { id: b.id, title: b.title, desc: b.desc, goal: b.goal, value: Math.min(v, b.goal), earned: v >= b.goal };
  });
}
