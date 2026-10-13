import React, { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import Modal from './Modal.jsx';
import { useShop } from '../lib/ShopContext.jsx';
import { navigate } from '../lib/router.js';
import { money } from '../lib/utils.js';
import { fetchPublicEvents, reserveItems, fmtRange } from '../lib/pickups.js';

const RETURN_KEY = 'cy_return_to';

function ReserveModal({ slug, ev, items, held, onClose, onDone }) {
  const { buyer, setAuthRole, setAuthView } = useShop();
  const avail = (p) => Math.max(0, (p.stock || 0) - (held[p.id] || 0));
  const list = items.filter((p) => avail(p) > 0);
  const [qty, setQty] = useState({});
  const [name, setName] = useState(buyer ? (buyer.fullName || '').split(' ')[0] : '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  const chosen = list.filter((p) => (qty[p.id] || 0) > 0);
  const total = chosen.reduce((a, p) => a + p.price * qty[p.id], 0);
  const cur = (list[0] && list[0].currency) || 'PHP';

  function goAuth(view) {
    try { localStorage.setItem(RETURN_KEY, '/shop/' + encodeURIComponent(slug)); } catch (e) { /* ignore */ }
    setAuthRole('buyer'); setAuthView(view); onClose(); navigate('/login');
  }
  const step = (p, d) => {
    const max = Math.min(5, avail(p));
    setQty((q) => ({ ...q, [p.id]: Math.max(0, Math.min(max, (q[p.id] || 0) + d)) }));
  };

  async function submit(e) {
    e.preventDefault();
    if (!chosen.length) { setError('Pick at least one item.'); return; }
    setBusy(true); setError('');
    try {
      const res = await reserveItems(ev.id, chosen.map((p) => ({ productId: p.id, qty: qty[p.id] })), note, name);
      setDone(res); onDone && onDone();
    } catch (err) { setError(err.message || 'Could not reserve. Please try again.'); }
    setBusy(false);
  }

  if (!buyer) {
    return (
      <Modal title={`Reserve for ${ev.name}`} onClose={onClose}>
        <p className="hint">Reservations are tied to a free buyer account so the seller knows who is picking up.</p>
        <button className="btn btn-primary btn-block" onClick={() => goAuth('signup')}>Create a buyer account</button>
        <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => goAuth('login')}>I already have an account</button>
      </Modal>
    );
  }

  if (done) {
    return (
      <Modal title="You're all set!" onClose={onClose}>
        <p style={{ marginTop: 0 }}>Your pickup code:</p>
        <div className="ins-big mono" style={{ textAlign: 'center', letterSpacing: 2 }}>{done.code}</div>
        <p className="hint" style={{ textAlign: 'center' }}>
          Show this code at {ev.booth ? `booth ${ev.booth}` : 'the booth'} · {fmtRange(ev.startsOn, ev.endsOn)}{ev.venue ? ` · ${ev.venue}` : ''}.<br />
          Pay at the booth: {money(done.total, cur)}.
        </p>
        <button className="btn btn-primary btn-block" onClick={onClose}>Done</button>
      </Modal>
    );
  }

  return (
    <Modal title={`Reserve for ${ev.name}`} onClose={onClose}>
      <p className="hint" style={{ marginTop: 0 }}>Pick what you want. The seller holds it for you and you pay at the booth. No online payment.</p>
      <form onSubmit={submit}>
        {list.length === 0 && <div className="empty-box">Nothing is available to reserve right now.</div>}
        {list.map((p) => (
          <div className="ins-row" key={p.id}>
            <div style={{ minWidth: 0 }}>
              <div className="order-name">{p.name}</div>
              <div className="order-meta">{money(p.price, p.currency)} · {avail(p)} available</div>
            </div>
            <div className="pos-cart-item-qty">
              <button type="button" className="pos-qty-btn" onClick={() => step(p, -1)} aria-label={'Fewer ' + p.name}>−</button>
              <span className="pos-qty-val">{qty[p.id] || 0}</span>
              <button type="button" className="pos-qty-btn" onClick={() => step(p, 1)} aria-label={'More ' + p.name}>+</button>
            </div>
          </div>
        ))}
        <div className="form-field" style={{ marginTop: 12 }}><label>Name for pickup</label><input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="form-field"><label>Note (optional)</label><input maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. I'll come by Saturday afternoon" /></div>
        {error && <div className="form-error">{error}</div>}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy || chosen.length === 0}>
          {busy ? 'Reserving…' : chosen.length ? `Reserve · ${money(total, cur)} at the booth` : 'Reserve'}
        </button>
      </form>
    </Modal>
  );
}

// "Find me at": upcoming conventions on a seller's public page, with pickup reservations.
export default function EventsCard({ slug, items, isSeller }) {
  const [info, setInfo] = useState(null);
  const [open, setOpen] = useState(null);

  const load = () => fetchPublicEvents(slug).then(setInfo).catch((e) => console.error(e));
  useEffect(() => { setInfo(null); load(); /* eslint-disable-next-line */ }, [slug]);

  if (!info || !info.events || info.events.length === 0) return null;
  return (
    <div className="panel" style={{ marginBottom: 18 }}>
      <div className="panel-head"><div className="panel-title"><Icon name="convention" size={17} /> Find me at</div></div>
      {info.events.map((ev) => (
        <div className="ins-row" key={ev.id}>
          <div style={{ minWidth: 0 }}>
            <div className="order-name">{ev.name}</div>
            <div className="order-meta">{fmtRange(ev.startsOn, ev.endsOn)}{ev.venue ? ` · ${ev.venue}` : ''}{ev.booth ? ` · Booth ${ev.booth}` : ''}</div>
            {ev.note && <div className="hint small">{ev.note}</div>}
          </div>
          <div className="ins-side">
            {ev.reserveEnabled
              ? (!isSeller && <button className="btn btn-primary btn-sm" onClick={() => setOpen(ev)}>Reserve for pickup</button>)
              : <span className="order-meta">Walk-ins welcome</span>}
          </div>
        </div>
      ))}
      {open && <ReserveModal slug={slug} ev={open} items={items} held={info.held || {}} onClose={() => setOpen(null)} onDone={load} />}
    </div>
  );
}
