import React, { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { useShop } from '../lib/ShopContext.jsx';
import { shopLink } from '../lib/router.js';
import { fmtDateTime, money } from '../lib/utils.js';
import { emptySupport, loadSupport, saveSupport, restartGoal, loadTips, reviewTip } from '../lib/support.js';

const METHOD_HINTS = ['GCash', 'Maya', 'GoTyme'];

export default function SupportTab() {
  const { shop } = useShop();
  const cur = shop.currency || 'PHP';
  const slug = shop.showcaseSlug || shop.username;
  const [s, setS] = useState(emptySupport());
  const [loadState, setLoadState] = useState('loading'); // loading | ready | error
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [tips, setTips] = useState([]);
  const [filter, setFilter] = useState('Pending');
  const [busyId, setBusyId] = useState('');
  const [tipError, setTipError] = useState('');

  async function load() {
    setLoadState('loading');
    try {
      const [settings, list] = await Promise.all([loadSupport(shop.id), loadTips(shop.id)]);
      setS(settings); setTips(list); setLoadState('ready');
    } catch (e) { console.error(e); setLoadState('error'); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const set = (patch) => { setMsg(''); setS((prev) => ({ ...prev, ...patch })); };
  const setLink = (i, patch) => set({ links: s.links.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const setPay = (i, patch) => set({ payMethods: s.payMethods.map((m, j) => (j === i ? { ...m, ...patch } : m)) });

  async function save(e) {
    e.preventDefault();
    if (s.tipsEnabled && !s.payMethods.some((m) => m.method.trim() && m.number.trim())) {
      setMsg('Add at least one payment method so supporters know where to send tips.'); return;
    }
    setSaving(true); setMsg('');
    try { setS(await saveSupport(shop.id, s)); setMsg('Saved.'); }
    catch (err) { console.error(err); setMsg("Couldn't save. Check your connection and try again."); }
    setSaving(false);
  }

  async function review(t, status) {
    setBusyId(t.id); setTipError('');
    try { await reviewTip(t.id, status); await load(); }
    catch (err) { setTipError(err.message || 'Could not update this tip.'); }
    setBusyId('');
  }

  async function newGoal() {
    if (!confirm('Start a new goal? The progress bar goes back to zero. Past tips stay in your list.')) return;
    try { await restartGoal(shop.id); setMsg('New goal started.'); } catch (err) { console.error(err); setMsg("Couldn't restart the goal."); }
  }

  if (loadState === 'loading') return <div className="empty-box">Loading…</div>;
  if (loadState === 'error') {
    return <div className="empty-box">Couldn't load this page. Did you run <code>supabase-support.sql</code> in Supabase? <button className="link-btn" onClick={load}>Try again</button></div>;
  }

  const shown = tips.filter((t) => filter === 'All' || t.status === filter);
  const pending = tips.filter((t) => t.status === 'Pending').length;
  const confirmedTotal = tips.filter((t) => t.status === 'Confirmed').reduce((a, t) => a + Number(t.amount), 0);

  return (
    <div>
      <div className="page-head">
        <div><h1>Support &amp; goals</h1><p>A tip jar, funding goal and shop profile for <a href={shopLink(slug)} target="_blank" rel="noopener noreferrer">your shop page</a>.</p></div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">Tips {pending > 0 && <span className="nav-badge" style={{ position: 'static', marginLeft: 6 }}>{pending}</span>}</div>
          <span className="hint small">{money(confirmedTotal, cur)} confirmed all-time</span>
        </div>
        <p className="hint small" style={{ marginTop: 0 }}>Supporters pay you directly (GCash, Maya...) and then log the tip here. Check your payment app, then confirm. Only confirmed tips count toward your goal and show on the supporter wall.</p>
        <div className="chips">
          {['Pending', 'Confirmed', 'Declined', 'All'].map((f) => (
            <button key={f} type="button" className={'chip ' + (filter === f ? 'active' : '')} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
        {tipError && <div className="form-error">{tipError}</div>}
        {shown.length === 0 && <div className="empty-box">No {filter === 'All' ? '' : filter.toLowerCase() + ' '}tips.</div>}
        {shown.map((t) => (
          <div className="ins-row" key={t.id}>
            <div style={{ minWidth: 0 }}>
              <div className="order-name">{t.display_name} · <span className="mono">{money(t.amount, cur)}</span></div>
              <div className="order-meta">{fmtDateTime(t.created_at)}{t.method ? ` · via ${t.method}` : ''}{t.reference ? ` · ref ${t.reference}` : ''}{t.is_public ? '' : ' · private'}</div>
              {t.message && <div className="hint small" style={{ marginTop: 4 }}>"{t.message}"</div>}
            </div>
            <div className="ins-side">
              {t.status === 'Pending' ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-primary btn-sm" disabled={busyId === t.id} onClick={() => review(t, 'Confirmed')}>Confirm</button>
                  <button className="btn btn-ghost btn-sm" disabled={busyId === t.id} onClick={() => review(t, 'Declined')}>Decline</button>
                </div>
              ) : <span className={'order-badge ' + t.status.toLowerCase()}>{t.status}</span>}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={save}>
        <div className="panel">
          <div className="panel-head"><div className="panel-title">Shop profile</div></div>
          <div className="form-field"><label>Announcement banner</label>
            <input value={s.announcement} maxLength={200} onChange={(e) => set({ announcement: e.target.value })} placeholder="e.g. Booth at Komikon this weekend! New pins dropping Friday." />
          </div>
          <div className="form-field"><label>About your shop</label>
            <textarea rows={3} value={s.bio} maxLength={600} onChange={(e) => set({ bio: e.target.value })} placeholder="A few lines about you and what you make." />
          </div>
          <label style={{ fontWeight: 700, fontSize: 13 }}>Links</label>
          {s.links.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, margin: '6px 0' }}>
              <input style={{ width: 120 }} placeholder="Label" value={l.label} maxLength={30} onChange={(e) => setLink(i, { label: e.target.value })} />
              <input style={{ flex: 1 }} placeholder="instagram.com/yourshop" value={l.url} onChange={(e) => setLink(i, { url: e.target.value })} />
              <button type="button" className="icon-btn" title="Remove" onClick={() => set({ links: s.links.filter((_, j) => j !== i) })}><Icon name="trash" size={15} /></button>
            </div>
          ))}
          {s.links.length < 6 && <button type="button" className="link-btn" onClick={() => set({ links: [...s.links, { label: '', url: '' }] })}>+ Add link</button>}
        </div>

        <div className="panel">
          <div className="panel-head"><div className="panel-title">Tip jar &amp; goal</div></div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700, marginBottom: 12 }}>
            <input type="checkbox" checked={s.tipsEnabled} onChange={(e) => set({ tipsEnabled: e.target.checked })} /> Accept tips on my shop page
          </label>
          <label style={{ fontWeight: 700, fontSize: 13 }}>Where supporters should send tips</label>
          {s.payMethods.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, margin: '6px 0', flexWrap: 'wrap' }}>
              <input style={{ width: 110 }} list="pay-hints" placeholder="GCash" value={m.method} maxLength={30} onChange={(e) => setPay(i, { method: e.target.value })} />
              <input style={{ flex: 1, minWidth: 140 }} placeholder="Number or username" value={m.number} maxLength={40} onChange={(e) => setPay(i, { number: e.target.value })} />
              <input style={{ flex: 1, minWidth: 140 }} placeholder="Account name" value={m.accountName || ''} maxLength={60} onChange={(e) => setPay(i, { accountName: e.target.value })} />
              <button type="button" className="icon-btn" title="Remove" onClick={() => set({ payMethods: s.payMethods.filter((_, j) => j !== i) })}><Icon name="trash" size={15} /></button>
            </div>
          ))}
          <datalist id="pay-hints">{METHOD_HINTS.map((h) => <option key={h} value={h} />)}</datalist>
          {s.payMethods.length < 5 && <button type="button" className="link-btn" onClick={() => set({ payMethods: [...s.payMethods, { method: '', number: '', accountName: '' }] })}>+ Add payment method</button>}
          <div className="form-row" style={{ marginTop: 14 }}>
            <div className="form-field"><label>Goal (optional)</label><input value={s.goalTitle} maxLength={80} onChange={(e) => set({ goalTitle: e.target.value })} placeholder="e.g. Next convention booth fee" /></div>
            <div className="form-field"><label>Goal amount ({cur})</label><input type="number" min="0" step="1" value={s.goalAmount} onChange={(e) => set({ goalAmount: e.target.value })} /></div>
          </div>
          <button type="button" className="link-btn" onClick={newGoal}>Start a new goal (resets the progress bar)</button>
        </div>

        {msg && <div className={msg === 'Saved.' || msg === 'New goal started.' ? 'form-success' : 'form-error'}>{msg}</div>}
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
      </form>
    </div>
  );
}
