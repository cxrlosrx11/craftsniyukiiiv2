import React, { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { useShop } from '../lib/ShopContext.jsx';
import { money } from '../lib/utils.js';
import { dailySeries, forecastDaily, restockPredictions, boughtTogether, trainSentiment } from '../lib/ml.js';

function BarChart({ history, forecast }) {
  const all = [...history, ...forecast];
  const max = Math.max(1, ...all);
  const W = 600, H = 140, pad = 4;
  const bw = (W - pad * 2) / all.length;
  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="ins-chart" role="img" aria-label="Past daily sales and the forecast for the next 7 days">
      {all.map((v, i) => {
        const h = (v / max) * H;
        const f = i >= history.length;
        return <rect key={i} x={pad + i * bw + 1} y={H - h} width={Math.max(1, bw - 2)} height={h} rx="2"
          fill={f ? 'var(--accent-soft)' : 'var(--accent)'} stroke={f ? 'var(--accent)' : 'none'} strokeDasharray={f ? '3 2' : undefined} />;
      })}
      <text x={pad} y={H + 15} fontSize="11" fill="var(--muted)">Past {history.length} days</text>
      <text x={W - pad} y={H + 15} fontSize="11" fill="var(--muted)" textAnchor="end">Next {forecast.length} days (forecast)</text>
    </svg>
  );
}

const STATUS_LABEL = { out: 'Out of stock', urgent: 'Runs out within a week', soon: 'Runs out within 2 weeks', low: 'Below your low-stock level' };

export default function Insights() {
  const { shop, data } = useShop();
  const cur = shop.currency || 'PHP';
  const [metric, setMetric] = useState('units');
  const [fc, setFc] = useState({ status: 'loading' });
  const [sent, setSent] = useState({ status: 'loading' });
  const [probe, setProbe] = useState('');
  const runId = useRef(0);

  const series = useMemo(() => dailySeries(data.sales), [data.sales]);
  const restock = useMemo(() => restockPredictions(data), [data]);
  const pairs = useMemo(() => boughtTogether(data.sales), [data.sales]);
  const needAttention = restock.filter((r) => ['out', 'urgent', 'soon', 'low'].includes(r.status));

  useEffect(() => {
    const id = ++runId.current;
    setFc({ status: 'loading' });
    const values = metric === 'units' ? series.units : series.revenue;
    forecastDaily(values, series.dates)
      .then((r) => { if (id === runId.current) setFc({ status: 'ready', ...r }); })
      .catch((e) => { console.error(e); if (id === runId.current) setFc({ status: 'error' }); });
  }, [series, metric]);

  useEffect(() => {
    let alive = true;
    trainSentiment(data.feedback)
      .then((r) => { if (alive) setSent({ status: 'ready', ...r }); })
      .catch((e) => { console.error(e); if (alive) setSent({ status: 'error' }); });
    return () => { alive = false; };
  }, [data.feedback]);

  const fmt = (v) => (metric === 'units' ? `${Math.round(v)} pcs` : money(v, cur));
  const total7 = fc.status === 'ready' ? fc.forecast.reduce((a, b) => a + b, 0) : 0;
  const probeResult = sent.status === 'ready' && sent.ready && probe.trim() ? sent.predict(probe) : null;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Smart insights</h1>
          <p>Predictions learned from your own sales and feedback, calculated in your browser with TensorFlow.js. Treat them as hints, not promises.</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">Next 7 days</div>
          <div className="chips" style={{ margin: 0 }}>
            <button className={'chip ' + (metric === 'units' ? 'active' : '')} onClick={() => setMetric('units')}>Units</button>
            <button className={'chip ' + (metric === 'revenue' ? 'active' : '')} onClick={() => setMetric('revenue')}>Revenue</button>
          </div>
        </div>
        {fc.status === 'loading' && <div className="empty-box">Crunching your sales history…</div>}
        {fc.status === 'error' && <div className="empty-box">The forecast couldn't run in this browser.</div>}
        {fc.status === 'ready' && series.dates.length === 0 && <div className="empty-box">Record some sales first. The forecast needs sales history to learn from.</div>}
        {fc.status === 'ready' && series.dates.length > 0 && (
          <>
            <div className="ins-big">{fmt(total7)} <span>expected over the next 7 days</span></div>
            <BarChart history={(metric === 'units' ? series.units : series.revenue).slice(-28)} forecast={fc.forecast} />
            <p className="hint small">
              {fc.method === 'neural'
                ? `Neural model. On recent days it hadn't seen, it was off by about ${fmt(fc.mae.model)}/day versus ${fmt(fc.mae.baseline)}/day for a plain 7-day average.`
                : fc.reason}
            </p>
          </>
        )}
      </div>

      <div className="panel">
        <div className="panel-head"><div className="panel-title">Restock watch</div></div>
        {data.sales.length === 0 && <div className="empty-box">Sales speed shows up here once you've recorded some sales.</div>}
        {data.sales.length > 0 && needAttention.length === 0 && <div className="empty-box">Nothing is close to running out at your current sales pace.</div>}
        {needAttention.map((r) => (
          <div className="ins-row" key={r.id}>
            <div>
              <div className="order-name">{r.name}</div>
              <div className="order-meta">
                {STATUS_LABEL[r.status]}
                {r.status !== 'out' && r.rate > 0 && ` · about ${r.daysLeft < 1 ? 'under a day' : Math.round(r.daysLeft) + ' days'} left at ${r.rate.toFixed(1)}/day`}
              </div>
            </div>
            <div className="ins-side">
              <div className="mono">{r.stock} left</div>
              {r.suggest > 0 && <div className="order-meta">restock ~{r.suggest} for 3 weeks</div>}
            </div>
          </div>
        ))}
        {needAttention.some((r) => r.thin) && <p className="hint small">Based on less than a week of sales, so these numbers can swing a lot.</p>}
      </div>

      <div className="panel">
        <div className="panel-head"><div className="panel-title">Often bought together</div></div>
        {pairs.length === 0 ? (
          <div className="empty-box">No pair has been bought together at least twice yet.</div>
        ) : pairs.map((p) => (
          <div className="ins-row" key={p.a + p.b}>
            <div className="order-name">{p.nameA} + {p.nameB}</div>
            <div className="order-meta">{p.count} orders · {Math.round(p.share * 100)}% of the rarer item's orders</div>
          </div>
        ))}
        {pairs.length > 0 && <p className="hint small">Good candidates for a bundle (Products tab) or for placing side by side at your booth.</p>}
      </div>

      <div className="panel">
        <div className="panel-head"><div className="panel-title">What buyers are saying</div></div>
        {sent.status === 'loading' && <div className="empty-box">Reading your feedback…</div>}
        {sent.status === 'error' && <div className="empty-box">The sentiment model couldn't run in this browser.</div>}
        {sent.status === 'ready' && !sent.ready && (
          <div className="empty-box">
            This learns from your own 1-2 and 4-5 star feedback (English or Taglish). You have {sent.labeled} usable entries so far
            ({sent.pos} happy, {sent.neg} unhappy). It needs about 12, with at least 3 of each.
          </div>
        )}
        {sent.status === 'ready' && sent.ready && (
          <>
            <div className="ins-words">
              <div><b>Words in happy reviews</b><div className="wizard-shared-chips">{sent.happyWords.map((w) => <span className="wizard-shared-chip" key={w}>{w}</span>)}</div></div>
              <div><b>Words in unhappy reviews</b><div className="wizard-shared-chips">{sent.unhappyWords.map((w) => <span className="wizard-shared-chip ins-bad" key={w}>{w}</span>)}</div></div>
            </div>
            <div className="form-field">
              <label>Try a message</label>
              <input value={probe} onChange={(e) => setProbe(e.target.value)} placeholder="Paste a buyer's message or chat reply…" />
            </div>
            {probeResult && (
              <p className="hint">
                {probeResult.known === 0
                  ? "None of these words appear in your past feedback, so there's nothing to judge from."
                  : `Reads as ${probeResult.probability >= 0.5 ? 'happy' : 'unhappy'} (${Math.round((probeResult.probability >= 0.5 ? probeResult.probability : 1 - probeResult.probability) * 100)}% sure).`}
              </p>
            )}
            <p className="hint small">Learned from {sent.labeled} rated reviews. It fit {Math.round(sent.trainAccuracy * 100)}% of those same reviews, so it hasn't been tested on new ones and works best on wording you've seen before.</p>
          </>
        )}
      </div>
    </div>
  );
}
