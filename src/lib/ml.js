// Smart-insight helpers for Crafts ni Yukiii.
//
// TensorFlow.js is loaded lazily (dynamic import) so it is NOT part of the main
// bundle: shoppers and sellers who never open "Smart insights" or a product
// pop-up never download it. Everything runs in the browser on data the app has
// already loaded — nothing is sent anywhere.
//
// This file has no React or Supabase imports so it can be unit-tested in Node.

let tfPromise = null;
export function loadTF() {
  if (!tfPromise) tfPromise = import('@tensorflow/tfjs');
  return tfPromise;
}

const DAY_MS = 86400000;

function dayKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* ------------------------------------------------------------------ */
/* 1. Daily series from data.sales                                     */
/* ------------------------------------------------------------------ */

// Zero-filled daily totals from the first sale up to YESTERDAY (today is still
// in progress, so including it would drag the forecast down).
export function dailySeries(sales, now = new Date()) {
  const empty = { dates: [], units: [], revenue: [] };
  if (!sales || !sales.length) return empty;
  const byDay = new Map();
  let first = null;
  for (const s of sales) {
    const d = new Date(s.date);
    if (isNaN(d.getTime())) continue;
    const k = dayKey(d);
    const e = byDay.get(k) || { units: 0, revenue: 0 };
    e.units += (s.items || []).reduce((a, it) => a + (Number(it.qty) || 0), 0);
    e.revenue += Number(s.total) || 0;
    byDay.set(k, e);
    if (!first || d < first) first = d;
  }
  if (!first) return empty;
  const start = new Date(first.getFullYear(), first.getMonth(), first.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const dates = [], units = [], revenue = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const e = byDay.get(dayKey(d)) || { units: 0, revenue: 0 };
    dates.push(new Date(d));
    units.push(e.units);
    revenue.push(e.revenue);
  }
  return { dates, units, revenue };
}

/* ------------------------------------------------------------------ */
/* 2. Sales forecast (small neural net, checked against a simple mean) */
/* ------------------------------------------------------------------ */

const WINDOW = 7;

function mean(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }

function featureRow(values, t, date, scale) {
  const row = [];
  for (let i = t - WINDOW; i < t; i++) row.push(values[i] / scale);
  for (let d = 0; d < 7; d++) row.push(date.getDay() === d ? 1 : 0); // day-of-week one-hot
  return row;
}

async function trainNet(tf, X, Y, epochs) {
  const init = (seed) => tf.initializers.glorotUniform({ seed });
  const model = tf.sequential();
  model.add(tf.layers.dense({
    units: 16, activation: 'relu', inputShape: [WINDOW + 7],
    kernelInitializer: init(1), kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
  }));
  model.add(tf.layers.dense({ units: 8, activation: 'relu', kernelInitializer: init(2) }));
  model.add(tf.layers.dense({ units: 1, kernelInitializer: init(3) }));
  model.compile({ optimizer: tf.train.adam(0.01), loss: 'meanSquaredError' });
  const xs = tf.tensor2d(X);
  const ys = tf.tensor2d(Y, [Y.length, 1]);
  await model.fit(xs, ys, { epochs, batchSize: 16, shuffle: false, verbose: 0 });
  xs.dispose(); ys.dispose();
  return model;
}

async function predictBatch(tf, model, X) {
  const t = tf.tensor2d(X);
  const out = model.predict(t);
  const arr = Array.from(await out.data());
  t.dispose(); out.dispose();
  return arr;
}

// values: daily totals (oldest -> newest). dates: matching Date objects.
// Returns { forecast[], forecastDates[], method: 'neural' | 'average', mae, reason }.
// The neural net is only used when it beats "average of the last 7 days" on
// days it did not train on; otherwise the simple average is returned.
export async function forecastDaily(values, dates, { horizon = 7, minDays = 21, epochs = 150 } = {}) {
  const n = values.length;
  const lastDate = dates.length ? dates[dates.length - 1] : new Date();
  const forecastDates = Array.from({ length: horizon }, (_, k) =>
    new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate() + k + 1));
  const baseValue = mean(values.slice(-WINDOW));
  const fallback = (reason) => ({
    forecast: Array(horizon).fill(baseValue), forecastDates, method: 'average', mae: null, reason
  });

  if (n < minDays) return fallback(`Only ${n} day${n === 1 ? '' : 's'} of sales history so far. A model needs about ${minDays}+ days, so this is just your recent daily average.`);

  const scale = Math.max(1, ...values);
  const rows = [];
  for (let t = WINDOW; t < n; t++) rows.push({ x: featureRow(values, t, dates[t], scale), y: values[t] / scale, t });
  const holdout = Math.max(5, Math.floor(rows.length * 0.25));
  const train = rows.slice(0, rows.length - holdout);
  const test = rows.slice(rows.length - holdout);
  if (train.length < 10) return fallback('Not enough history to test a model fairly yet, so this is your recent daily average.');

  const tf = await loadTF();

  // Backtest on the most recent days the model never saw.
  const probe = await trainNet(tf, train.map((r) => r.x), train.map((r) => r.y), epochs);
  const probePred = await predictBatch(tf, probe, test.map((r) => r.x));
  probe.dispose();
  const modelMAE = mean(probePred.map((p, i) => Math.abs(Math.max(0, p) * scale - test[i].y * scale)));
  const baseMAE = mean(test.map((r) => Math.abs(mean(values.slice(r.t - WINDOW, r.t)) - r.y * scale)));
  const mae = { model: modelMAE, baseline: baseMAE };

  if (!(modelMAE < baseMAE * 0.9)) {
    return { ...fallback('The neural model did not beat a plain 7-day average on your recent days, so the average is shown. This usually changes once you have more sales history.'), mae };
  }

  // The model wins: retrain on everything and forecast ahead, feeding each prediction back in.
  const model = await trainNet(tf, rows.map((r) => r.x), rows.map((r) => r.y), epochs);
  const hist = values.slice();
  const forecast = [];
  for (let k = 0; k < horizon; k++) {
    const x = featureRow(hist, hist.length, forecastDates[k], scale);
    const [p] = await predictBatch(tf, model, [x]);
    const v = Math.max(0, p) * scale;
    forecast.push(v);
    hist.push(v);
  }
  model.dispose();
  return { forecast, forecastDates, method: 'neural', mae, reason: '' };
}

/* ------------------------------------------------------------------ */
/* 3. Restock prediction (plain arithmetic: sales speed vs. stock)     */
/* ------------------------------------------------------------------ */

export function restockPredictions(data, now = new Date()) {
  const sales = data.sales || [];
  const nowMs = now.getTime();
  let firstMs = nowMs;
  const sold14 = new Map(), sold30 = new Map();
  for (const s of sales) {
    const ms = new Date(s.date).getTime();
    if (isNaN(ms)) continue;
    if (ms < firstMs) firstMs = ms;
    const age = (nowMs - ms) / DAY_MS;
    for (const it of s.items || []) {
      if (age <= 30) sold30.set(it.productId, (sold30.get(it.productId) || 0) + it.qty);
      if (age <= 14) sold14.set(it.productId, (sold14.get(it.productId) || 0) + it.qty);
    }
  }
  const historyDays = Math.max(1, (nowMs - firstMs) / DAY_MS);
  const w14 = Math.min(14, historyDays), w30 = Math.min(30, historyDays);
  const rank = { out: 0, urgent: 1, soon: 2, low: 3, ok: 4, idle: 5 };

  return (data.products || []).filter((p) => !p.archived).map((p) => {
    const rate = 0.6 * ((sold14.get(p.id) || 0) / w14) + 0.4 * ((sold30.get(p.id) || 0) / w30);
    const daysLeft = rate > 0 ? p.stock / rate : Infinity;
    let status = 'ok';
    if (p.stock <= 0) status = 'out';
    else if (daysLeft <= 7) status = 'urgent';
    else if (daysLeft <= 14) status = 'soon';
    else if (p.stock <= (p.lowStockAt || 0)) status = 'low';
    else if (rate === 0) status = 'idle';
    const suggest = rate > 0 ? Math.max(0, Math.ceil(rate * 21) - p.stock) : 0; // ~3 weeks of cover
    return { id: p.id, name: p.name, stock: p.stock, rate, daysLeft, status, suggest, thin: historyDays < 7 };
  }).sort((a, b) => rank[a.status] - rank[b.status] || a.daysLeft - b.daysLeft);
}

/* ------------------------------------------------------------------ */
/* 4. Bought together (seller side, from past sales)                   */
/* ------------------------------------------------------------------ */

export function boughtTogether(sales, { minCount = 2, limit = 5 } = {}) {
  const single = new Map(), pairs = new Map(), names = new Map();
  for (const s of sales || []) {
    const ids = Array.from(new Set((s.items || []).map((it) => it.productId)));
    (s.items || []).forEach((it) => names.set(it.productId, it.name));
    ids.forEach((id) => single.set(id, (single.get(id) || 0) + 1));
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const [a, b] = ids[i] < ids[j] ? [ids[i], ids[j]] : [ids[j], ids[i]];
        const k = a + '|' + b;
        pairs.set(k, (pairs.get(k) || 0) + 1);
      }
    }
  }
  return Array.from(pairs, ([k, count]) => {
    const [a, b] = k.split('|');
    return {
      a, b, nameA: names.get(a), nameB: names.get(b), count,
      share: count / Math.min(single.get(a), single.get(b)) // how often the rarer item travels with the other
    };
  }).filter((p) => p.count >= minCount).sort((x, y) => y.count - x.count || y.share - x.share).slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* 5. Review sentiment (logistic regression learned from YOUR reviews)  */
/* ------------------------------------------------------------------ */

const STOP = new Set(['the', 'and', 'for', 'you', 'are', 'was', 'with', 'this', 'that', 'have', 'has', 'but', 'not', 'ang', 'ung', 'yung', 'nang', 'mga', 'sa', 'ng', 'na', 'ako', 'ito', 'din', 'rin', 'lang', 'nga', 'pero', 'kasi', 'para', 'ang', 'ay']);

export function tokenize(text) {
  return (text || '').toLowerCase().replace(/'/g, '').replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/).filter((w) => w.length >= 3 && !STOP.has(w));
}

// Learns which words go with happy (4-5 star) vs unhappy (1-2 star) reviews.
// Returns { ready:false, ... } until there are enough rated reviews to learn from.
export async function trainSentiment(feedback) {
  const labeled = (feedback || [])
    .filter((f) => f.message && (f.rating >= 4 || f.rating <= 2))
    .map((f) => ({ tokens: tokenize(f.message), y: f.rating >= 4 ? 1 : 0 }))
    .filter((r) => r.tokens.length > 0);
  const pos = labeled.filter((r) => r.y === 1).length;
  const neg = labeled.length - pos;
  if (labeled.length < 12 || pos < 3 || neg < 3) return { ready: false, labeled: labeled.length, pos, neg };

  const df = new Map();
  labeled.forEach((r) => new Set(r.tokens).forEach((w) => df.set(w, (df.get(w) || 0) + 1)));
  const vocab = Array.from(df).filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 400).map(([w]) => w);
  if (vocab.length < 5) return { ready: false, labeled: labeled.length, pos, neg, sparse: true };
  const index = new Map(vocab.map((w, i) => [w, i]));
  const vec = (tokens) => { const v = new Array(vocab.length).fill(0); tokens.forEach((w) => { if (index.has(w)) v[index.get(w)] = 1; }); return v; };

  const tf = await loadTF();
  const model = tf.sequential();
  model.add(tf.layers.dense({
    units: 1, activation: 'sigmoid', inputShape: [vocab.length],
    kernelInitializer: tf.initializers.zeros(), kernelRegularizer: tf.regularizers.l2({ l2: 0.02 })
  }));
  model.compile({ optimizer: tf.train.adam(0.05), loss: 'binaryCrossentropy' });
  const xs = tf.tensor2d(labeled.map((r) => vec(r.tokens)));
  const ys = tf.tensor2d(labeled.map((r) => r.y), [labeled.length, 1]);
  const total = labeled.length;
  await model.fit(xs, ys, {
    epochs: 250, batchSize: 16, shuffle: false, verbose: 0,
    classWeight: { 0: total / (2 * neg), 1: total / (2 * pos) }
  });
  const [kernel, bias] = model.getWeights();
  const w = Array.from(await kernel.data());
  const b = (await bias.data())[0];
  xs.dispose(); ys.dispose(); model.dispose();

  const score = (tokens) => {
    let z = b;
    tokens.forEach((t) => { if (index.has(t)) z += w[index.get(t)]; });
    return 1 / (1 + Math.exp(-z));
  };
  const trainAccuracy = labeled.filter((r) => (score(r.tokens) >= 0.5 ? 1 : 0) === r.y).length / total;
  const ranked = vocab.map((word, i) => ({ word, weight: w[i] }));
  return {
    ready: true, labeled: total, pos, neg, trainAccuracy,
    happyWords: ranked.filter((r) => r.weight > 0.05).sort((a, b2) => b2.weight - a.weight).slice(0, 6).map((r) => r.word),
    unhappyWords: ranked.filter((r) => r.weight < -0.05).sort((a, b2) => a.weight - b2.weight).slice(0, 6).map((r) => r.word),
    predict: (text) => {
      const tokens = tokenize(text);
      const known = tokens.filter((t) => index.has(t)).length;
      return { probability: score(tokens), known };
    }
  };
}

/* ------------------------------------------------------------------ */
/* 6. "You may also like" for the storefront (content-based)           */
/* ------------------------------------------------------------------ */

const keyOf = (p) => p.shopSlug + ':' + p.id;

// Compares products by category, fandom/IP, price level and seller using
// cosine similarity. Uses only public storefront data — it never touches a
// seller's private sales records.
export async function similarProducts(target, items, k = 4) {
  const pool = (items || []).filter((p) => keyOf(p) !== keyOf(target) && p.stock > 0);
  if (!pool.length) return [];
  const tf = await loadTF();
  const all = [target, ...pool];
  const uniq = (fn) => Array.from(new Set(all.map(fn).filter(Boolean)));
  const cats = uniq((p) => p.category), ips = uniq((p) => p.ip), shops = uniq((p) => p.shopSlug);
  const maxLog = Math.max(1, ...all.map((p) => Math.log1p(Number(p.price) || 0)));
  const rows = all.map((p) => [
    ...cats.map((c) => (p.category === c ? 1 : 0)),
    ...ips.map((c) => (p.ip === c ? 1.5 : 0)),
    ...shops.map((c) => (p.shopSlug === c ? 0.5 : 0)),
    (Math.log1p(Number(p.price) || 0) / maxLog) * 0.7
  ]);
  const scores = tf.tidy(() => {
    const m = tf.tensor2d(rows);
    const normed = m.div(m.norm('euclidean', 1, true).add(1e-9));
    const targetRow = normed.slice([0, 0], [1, -1]);
    const poolRows = normed.slice([1, 0], [-1, -1]);
    return poolRows.matMul(targetRow.transpose()).flatten();
  });
  const sims = Array.from(await scores.data());
  scores.dispose();
  return pool.map((p, i) => ({ product: p, score: sims[i] }))
    .filter((r) => r.score >= 0.5)
    .sort((a, b) => b.score - a.score).slice(0, k).map((r) => r.product);
}
