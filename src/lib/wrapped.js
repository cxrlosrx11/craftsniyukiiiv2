// Seller "Wrapped": turns a period of sales into a shareable image.
// Pure functions + canvas drawing, no React. Works in the browser and in Node (for tests).
import { THEMES } from './themes.js';

const DAY = 86400000;

/* ---------------- stats ---------------- */

export function computeWrapped(data, from, to) {
  const sales = (data.sales || []).filter((s) => {
    const t = new Date(s.date).getTime();
    return !isNaN(t) && t >= from.getTime() && t < to.getTime();
  });
  const byProduct = new Map();
  const byCategory = new Map();
  const byDay = new Map();
  let units = 0, revenue = 0;
  sales.forEach((s) => {
    const dayKey = new Date(s.date).toDateString();
    let dayUnits = 0;
    (s.items || []).forEach((it) => {
      const q = Number(it.qty) || 0;
      units += q; dayUnits += q;
      const key = it.productId || it.name;
      const cur = byProduct.get(key) || { id: it.productId, name: it.name, qty: 0 };
      cur.qty += q;
      byProduct.set(key, cur);
      const p = (data.products || []).find((x) => x.id === it.productId);
      const cat = it.category || (p && p.category);
      if (cat) byCategory.set(cat, (byCategory.get(cat) || 0) + q);
    });
    byDay.set(dayKey, (byDay.get(dayKey) || 0) + dayUnits);
    revenue += Number(s.total) || 0;
  });
  const topProducts = Array.from(byProduct.values()).sort((a, b) => b.qty - a.qty).slice(0, 3);
  const topCategory = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1])[0];
  let bestDay = null;
  byDay.forEach((u, k) => { if (!bestDay || u > bestDay.units) bestDay = { key: k, units: u }; });
  if (bestDay) {
    bestDay.label = new Date(bestDay.key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return {
    hasSales: sales.length > 0, units, orders: sales.length, revenue, topProducts,
    topCategory: topCategory ? topCategory[0] : '', bestDay, title: titleFor(units)
  };
}

export function titleFor(units) {
  if (units <= 0) return 'Just getting started';
  if (units < 10) return 'Just getting started';
  if (units < 50) return 'Rising maker';
  if (units < 150) return 'Crowd favorite';
  if (units < 500) return 'Bestseller energy';
  return 'Small shop, huge heart';
}

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// kind: 'last30' | 'month' | 'year' | 'all' | 'day' (with opts.day = 'YYYY-MM-DD') | 'range' (opts.from/opts.to = 'YYYY-MM-DD', inclusive)
export function periodRange(kind, opts = {}, now = new Date()) {
  const today = startOfDay(now);
  const tomorrow = new Date(today.getTime() + DAY);
  const parse = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
  if (kind === 'last30') return { from: new Date(tomorrow.getTime() - 30 * DAY), to: tomorrow, label: 'LAST 30 DAYS' };
  if (kind === 'month') return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: tomorrow, label: now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }).toUpperCase() };
  if (kind === 'year') return { from: new Date(now.getFullYear(), 0, 1), to: tomorrow, label: String(now.getFullYear()) };
  if (kind === 'day') { const d = parse(opts.day); return { from: d, to: new Date(d.getTime() + DAY), label: (opts.name || 'EVENT').toUpperCase() }; }
  if (kind === 'range') { const a = parse(opts.from), b = parse(opts.to); return { from: a, to: new Date(b.getTime() + DAY), label: (opts.name || 'EVENT').toUpperCase() }; }
  return { from: new Date(2000, 0, 1), to: tomorrow, label: 'ALL TIME' };
}

/* ---------------- drawing ---------------- */

const FONT = '"Inter", "Poppins", "Segoe UI", system-ui, -apple-system, sans-serif';
const FORMATS = { story: { w: 1080, h: 1920 }, square: { w: 1080, h: 1080 } };

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function fit(ctx, text, maxW) {
  let t = String(text || '');
  if (ctx.measureText(t).width <= maxW) return t;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

function drawImageCover(ctx, img, x, y, w, h, r) {
  ctx.save();
  rr(ctx, x, y, w, h, r);
  ctx.clip();
  const s = Math.max(w / img.width, h / img.height);
  const dw = img.width * s, dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

function initialBadge(ctx, letter, x, y, size, fill, ink) {
  ctx.fillStyle = fill;
  rr(ctx, x, y, size, size, size / 2);
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.font = `800 ${Math.round(size * 0.46)}px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(letter, x + size / 2, y + size / 2 + 2);
}

// opts: { format, themeKey, shopName, username, avatarImg, images: {productId: Image}, periodLabel,
//         showRevenue, money: (n) => string, link, followers, likes }
export function drawWrapped(canvas, stats, opts) {
  const f = FORMATS[opts.format] || FORMATS.story;
  const story = f === FORMATS.story;
  const W = f.w, H = f.h;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const t = THEMES[opts.themeKey] || THEMES.rose;
  const pad = 80;

  // background
  const g = ctx.createLinearGradient(0, 0, W * 0.6, H);
  g.addColorStop(0, t.dark); g.addColorStop(1, t.accent);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  [[W * 0.95, H * 0.06, 300], [W * 0.05, H * 0.55, 220], [W * 0.9, H * 0.9, 340]].forEach(([cx, cy, r]) => { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); });

  // header: avatar + shop name
  let y = story ? 110 : 56;
  const av = story ? 124 : 88;
  if (opts.avatarImg) {
    drawImageCover(ctx, opts.avatarImg, pad, y, av, av, av / 2);
  } else {
    initialBadge(ctx, (opts.shopName || '?').trim().charAt(0).toUpperCase(), pad, y, av, 'rgba(255,255,255,0.9)', t.dark);
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  ctx.font = `800 ${story ? 56 : 46}px ${FONT}`;
  ctx.fillText(fit(ctx, opts.shopName, W - pad * 2 - av - 30), pad + av + 28, y + av / 2 - 2);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = `600 ${story ? 32 : 28}px ${FONT}`;
  ctx.fillText('@' + (opts.username || ''), pad + av + 28, y + av / 2 + (story ? 42 : 36));
  y += av + (story ? 56 : 26);

  // period chip
  ctx.font = `800 ${story ? 34 : 30}px ${FONT}`;
  const chipText = `${opts.periodLabel} WRAPPED`;
  const cw = ctx.measureText(chipText).width + 60;
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  rr(ctx, pad, y, cw, story ? 66 : 54, 33); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle';
  ctx.fillText(chipText, pad + 30, y + (story ? 34 : 28));
  y += (story ? 66 : 54) + (story ? 44 : 22);

  // big number card
  const cardH = story ? 470 : 262;
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  rr(ctx, pad, y, W - pad * 2, cardH, 48); ctx.fill();
  ctx.textAlign = 'center';
  if (stats.hasSales) {
    ctx.fillStyle = t.dark; ctx.textBaseline = 'alphabetic';
    ctx.font = `900 ${story ? 230 : 140}px ${FONT}`;
    ctx.fillText(String(stats.units), W / 2, y + (story ? 250 : 148));
    ctx.fillStyle = '#4b4b57';
    ctx.font = `700 ${story ? 44 : 32}px ${FONT}`;
    ctx.fillText(stats.units === 1 ? 'piece found a new home' : 'pieces found new homes', W / 2, y + (story ? 322 : 196));
    const tw = (() => { ctx.font = `800 ${story ? 32 : 26}px ${FONT}`; return ctx.measureText(stats.title).width + 56; })();
    ctx.fillStyle = t.soft;
    rr(ctx, W / 2 - tw / 2, y + (story ? 360 : 212), tw, story ? 62 : 40, 31); ctx.fill();
    ctx.fillStyle = t.dark; ctx.textBaseline = 'middle';
    ctx.fillText(stats.title, W / 2, y + (story ? 391 : 232));
  } else {
    ctx.fillStyle = t.dark; ctx.textBaseline = 'middle';
    ctx.font = `800 ${story ? 60 : 44}px ${FONT}`;
    ctx.fillText('No sales in this period yet', W / 2, y + cardH / 2);
  }
  y += cardH + (story ? 40 : 22);

  // stat tiles
  const tiles = [];
  tiles.push([String(stats.orders), stats.orders === 1 ? 'order' : 'orders']);
  if (stats.bestDay) tiles.push([stats.bestDay.label, `best day · ${stats.bestDay.units} pcs`]);
  if (opts.showRevenue) tiles.push([opts.money(stats.revenue), 'earned']);
  else if (opts.followers != null) tiles.push([String(opts.followers), opts.followers === 1 ? 'follower' : 'followers']);
  else if (stats.topCategory) tiles.push([stats.topCategory, 'top category']);
  if (stats.hasSales && tiles.length > 0) {
    const gap = 24, tw2 = (W - pad * 2 - gap * (tiles.length - 1)) / tiles.length, th = story ? 190 : 118;
    tiles.forEach(([big, small], i) => {
      const x = pad + i * (tw2 + gap);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      rr(ctx, x, y, tw2, th, 36); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      let size = story ? 60 : 44;
      ctx.font = `900 ${size}px ${FONT}`;
      while (ctx.measureText(big).width > tw2 - 30 && size > 24) { size -= 2; ctx.font = `900 ${size}px ${FONT}`; }
      ctx.fillText(big, x + tw2 / 2, y + (story ? 92 : 64));
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = `600 ${story ? 26 : 22}px ${FONT}`;
      ctx.fillText(fit(ctx, small, tw2 - 24), x + tw2 / 2, y + (story ? 142 : 98));
    });
    y += th + (story ? 52 : 26);
  }

  // top picks
  const rows = stats.topProducts.slice(0, story ? 3 : 2);
  if (rows.length) {
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff';
    ctx.font = `800 ${story ? 44 : 32}px ${FONT}`;
    ctx.fillText('Top picks', pad, y + (story ? 30 : 20));
    y += story ? 66 : 40;
    const rowH = story ? 150 : 84, maxQty = rows[0].qty || 1;
    rows.forEach((p, i) => {
      const ry = y + i * (rowH + (story ? 18 : 10));
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      rr(ctx, pad, ry, W - pad * 2, rowH, 32); ctx.fill();
      const img = opts.images && opts.images[p.id];
      const th = rowH - 28;
      if (img) drawImageCover(ctx, img, pad + 14, ry + 14, th, th, 22);
      else initialBadge(ctx, String(i + 1), pad + 14, ry + 14, th, 'rgba(255,255,255,0.9)', t.dark);
      const tx = pad + 14 + th + 24;
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.font = `800 ${story ? 36 : 26}px ${FONT}`;
      ctx.fillText(fit(ctx, p.name, W - pad - tx - 190), tx, ry + (story ? 62 : 36));
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      rr(ctx, tx, ry + (story ? 86 : 50), W - pad - 190 - tx, story ? 18 : 12, 9); ctx.fill();
      ctx.fillStyle = '#fff';
      rr(ctx, tx, ry + (story ? 86 : 50), Math.max(24, (W - pad - 190 - tx) * (p.qty / maxQty)), story ? 18 : 12, 9); ctx.fill();
      ctx.textAlign = 'right';
      ctx.font = `900 ${story ? 54 : 36}px ${FONT}`;
      ctx.fillText('×' + p.qty, W - pad - 28, ry + rowH / 2 + (story ? 18 : 12));
    });
    y += rows.length * (rowH + (story ? 18 : 10));
  }

  // footer
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  ctx.font = `800 ${story ? 36 : 28}px ${FONT}`;
  ctx.fillText(fit(ctx, opts.link, W - pad * 2), W / 2, H - (story ? 118 : 70));
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `600 ${story ? 28 : 22}px ${FONT}`;
  ctx.fillText('Made with Crafts ni Yukiii', W / 2, H - (story ? 66 : 34));
  return { width: W, height: H, usedHeight: y };
}
