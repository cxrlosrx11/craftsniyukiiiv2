import React, { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import Modal from './Modal.jsx';
import { useShop } from '../lib/ShopContext.jsx';
import { navigate } from '../lib/router.js';
import { money } from '../lib/utils.js';
import { fetchPublicOffers, submitRequest, estimate } from '../lib/customOrders.js';

const RETURN_KEY = 'cy_return_to';

function RequestModal({ slug, offer, onClose, onDone }) {
  const { buyer, setAuthRole, setAuthView } = useShop();
  const [picks, setPicks] = useState({});   // groupId -> [choiceId]
  const [texts, setTexts] = useState({});   // groupId -> string
  const [qty, setQty] = useState(1);
  const [name, setName] = useState(buyer ? (buyer.fullName || '').split(' ')[0] : '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);
  const cur = offer.currency || 'PHP';

  function goAuth(view) {
    try { localStorage.setItem(RETURN_KEY, '/shop/' + encodeURIComponent(slug)); } catch (e) { /* ignore */ }
    setAuthRole('buyer'); setAuthView(view); onClose(); navigate('/login');
  }

  function toggle(g, cid) {
    setPicks((p) => {
      const cur = p[g.id] || [];
      if (g.kind === 'single') return { ...p, [g.id]: cur[0] === cid ? [] : [cid] };
      if (cur.includes(cid)) return { ...p, [g.id]: cur.filter((x) => x !== cid) };
      if (cur.length >= (g.max || 12)) return p;
      return { ...p, [g.id]: [...cur, cid] };
    });
  }

  async function submit(e) {
    e.preventDefault();
    for (const g of offer.options) {
      if (!g.required) continue;
      if (g.kind === 'text' ? !(texts[g.id] || '').trim() : !(picks[g.id] || []).length) {
        setError(g.kind === 'text' ? `Please fill in "${g.label}".` : `Please choose an option for "${g.label}".`); return;
      }
    }
    const selections = offer.options.map((g) => (g.kind === 'text' ? { groupId: g.id, text: texts[g.id] || '' } : { groupId: g.id, picks: picks[g.id] || [] }));
    setBusy(true); setError('');
    try { setDone(await submitRequest(offer.id, selections, qty, note, name)); onDone && onDone(); }
    catch (err) { setError(err.message || 'Could not send your request. Please try again.'); }
    setBusy(false);
  }

  if (!buyer) {
    return (
      <Modal title={offer.title} onClose={onClose}>
        <p className="hint">Requests are tied to a free buyer account so the seller can reply to you.</p>
        <button className="btn btn-primary btn-block" onClick={() => goAuth('signup')}>Create a buyer account</button>
        <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => goAuth('login')}>I already have an account</button>
      </Modal>
    );
  }

  if (done) {
    return (
      <Modal title="Request sent!" onClose={onClose}>
        <p style={{ marginTop: 0 }}>Your request code:</p>
        <div className="ins-big mono" style={{ textAlign: 'center', letterSpacing: 2 }}>{done.code}</div>
        <p className="hint" style={{ textAlign: 'center' }}>
          Estimated {money(done.estTotal, cur)}. The seller will review it and send you a final price and a ready date. You only pay once you agree. Follow it on your buyer dashboard.
        </p>
        <button className="btn btn-primary btn-block" onClick={onClose}>Done</button>
      </Modal>
    );
  }

  return (
    <Modal title={offer.title} onClose={onClose}>
      {offer.description && <p className="hint" style={{ marginTop: 0 }}>{offer.description}</p>}
      <form onSubmit={submit}>
        {offer.options.map((g) => (
          <div className="form-field" key={g.id}>
            <label>{g.label}{g.required ? ' *' : ''}{g.kind === 'multi' ? ` (up to ${g.max || 12})` : ''}</label>
            {g.kind === 'text' ? (
              <input maxLength={200} value={texts[g.id] || ''} onChange={(e) => setTexts({ ...texts, [g.id]: e.target.value })} />
            ) : (
              <div className="chips" style={{ margin: 0 }}>
                {g.choices.map((c) => {
                  const on = (picks[g.id] || []).includes(c.id);
                  return (
                    <button key={c.id} type="button" className={'chip ' + (on ? 'active' : '')} aria-pressed={on} onClick={() => toggle(g, c.id)}>
                      {c.label}{c.price > 0 ? ` +${money(c.price, cur)}` : ''}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        <div className="form-row">
          <div className="form-field"><label>Quantity</label>
            <div className="pos-cart-item-qty">
              <button type="button" className="pos-qty-btn" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Fewer">−</button>
              <span className="pos-qty-val">{qty}</span>
              <button type="button" className="pos-qty-btn" onClick={() => setQty(Math.min(20, qty + 1))} aria-label="More">+</button>
            </div>
          </div>
          <div className="form-field"><label>Your name</label><input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></div>
        </div>
        <div className="form-field"><label>Anything else? (optional)</label><textarea rows={2} maxLength={400} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Colors, deadline, reference ideas…" /></div>
        {error && <div className="form-error">{error}</div>}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? 'Sending…' : `Send request · about ${money(estimate(offer, picks, qty), cur)}`}
        </button>
        <p className="hint small" style={{ textAlign: 'center' }}>The seller confirms the final price before you pay anything.</p>
      </form>
    </Modal>
  );
}

// Custom order options on a seller's public page.
export default function CustomOffersCard({ slug, isSeller }) {
  const [offers, setOffers] = useState([]);
  const [open, setOpen] = useState(null);
  const load = () => fetchPublicOffers(slug).then(setOffers).catch((e) => console.error(e));
  useEffect(() => { setOffers([]); load(); /* eslint-disable-next-line */ }, [slug]);

  if (!offers.length) return null;
  return (
    <div className="panel" style={{ marginBottom: 18 }}>
      <div className="panel-head"><div className="panel-title"><Icon name="layers" size={17} /> Custom orders</div></div>
      {offers.map((o) => {
        const full = o.slotsLeft === 0;
        return (
          <div className="ins-row" key={o.id} style={{ alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <div className="order-name">{o.title}</div>
              {o.description && <div className="hint small">{o.description}</div>}
              <div className="order-meta">
                From {money(o.basePrice, o.currency)} · ready in about {o.leadTimeDays} day{o.leadTimeDays === 1 ? '' : 's'}
                {o.slotsLeft != null ? ` · ${full ? 'no slots left' : o.slotsLeft + ' slot' + (o.slotsLeft === 1 ? '' : 's') + ' left'}` : ''}
              </div>
            </div>
            <div className="ins-side">
              {!isSeller && <button className="btn btn-primary btn-sm" disabled={full} onClick={() => setOpen(o)}>{full ? 'Full' : 'Request'}</button>}
            </div>
          </div>
        );
      })}
      {open && <RequestModal slug={slug} offer={open} onClose={() => setOpen(null)} onDone={load} />}
    </div>
  );
}
