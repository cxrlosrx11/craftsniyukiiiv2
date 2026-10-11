import React, { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import Modal from './Modal.jsx';
import { useShop } from '../lib/ShopContext.jsx';
import { navigate } from '../lib/router.js';
import { money } from '../lib/utils.js';
import { fetchPublicSupport, submitTip, safeUrl } from '../lib/support.js';

const RETURN_KEY = 'cy_return_to';

function TipModal({ slug, info, onClose }) {
  const { buyer, setAuthRole, setAuthView } = useShop();
  const cur = info.currency || 'PHP';
  const presets = [20, 50, 100, 200];
  const [amount, setAmount] = useState('50');
  const [name, setName] = useState(buyer ? (buyer.fullName || '').split(' ')[0] : '');
  const [message, setMessage] = useState('');
  const [method, setMethod] = useState((info.payMethods[0] && info.payMethods[0].method) || '');
  const [reference, setReference] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState('');

  function goAuth(view) {
    try { localStorage.setItem(RETURN_KEY, '/shop/' + encodeURIComponent(slug)); } catch (e) { /* ignore */ }
    setAuthRole('buyer'); setAuthView(view); onClose(); navigate('/login');
  }

  function copy(text) {
    navigator.clipboard.writeText(text).then(() => { setCopied(text); setTimeout(() => setCopied(''), 1500); });
  }

  async function send(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await submitTip(slug, { name, amount: Number(amount), message, method, reference, isPublic });
      setDone(true);
    } catch (err) { setError(err.message || 'Could not log your tip. Please try again.'); }
    setBusy(false);
  }

  if (done) {
    return (
      <Modal title="Thank you!" onClose={onClose}>
        <p>Your tip is logged. The seller will confirm once they see your payment, and then it counts toward the goal{isPublic ? ' and shows on the supporter wall' : ''}.</p>
        <button className="btn btn-primary btn-block" onClick={onClose}>Close</button>
      </Modal>
    );
  }

  if (!buyer) {
    return (
      <Modal title="Support this shop" onClose={onClose}>
        <p className="hint">Tips are tied to a free buyer account so sellers know who to thank, and to keep spam out.</p>
        <button className="btn btn-primary btn-block" onClick={() => goAuth('signup')}>Create a buyer account</button>
        <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => goAuth('login')}>I already have an account</button>
      </Modal>
    );
  }

  return (
    <Modal title="Support this shop" onClose={onClose}>
      <div className="side-section" style={{ padding: '0 0 6px' }}>1. Send your tip</div>
      {info.payMethods.map((m, i) => (
        <div className="ins-row" key={i}>
          <div>
            <div className="order-name">{m.method}</div>
            <div className="order-meta">{m.accountName || ''}</div>
          </div>
          <div className="ins-side">
            <span className="mono">{m.number}</span>{' '}
            <button type="button" className="link-btn" onClick={() => copy(m.number)}>{copied === m.number ? 'Copied' : 'Copy'}</button>
          </div>
        </div>
      ))}
      <form onSubmit={send}>
        <div className="side-section" style={{ padding: '14px 0 6px' }}>2. Tell the seller you sent it</div>
        <div className="chips">
          {presets.map((p) => (
            <button key={p} type="button" className={'chip ' + (Number(amount) === p ? 'active' : '')} onClick={() => setAmount(String(p))}>{money(p, cur)}</button>
          ))}
        </div>
        <div className="form-row">
          <div className="form-field"><label>Amount sent ({cur})</label><input type="number" min="1" max="100000" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div className="form-field"><label>Paid via</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              {info.payMethods.map((m, i) => <option key={i} value={m.method}>{m.method}</option>)}
            </select>
          </div>
        </div>
        <div className="form-field"><label>Name to show</label><input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="form-field"><label>Reference no. or last 4 digits (helps the seller find it)</label><input maxLength={40} value={reference} onChange={(e) => setReference(e.target.value)} /></div>
        <div className="form-field"><label>Message (optional)</label><textarea rows={2} maxLength={280} value={message} onChange={(e) => setMessage(e.target.value)} /></div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 10 }}>
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /> Show my name and message on the supporter wall
        </label>
        {error && <div className="form-error">{error}</div>}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? 'Sending…' : "I've sent my tip"}</button>
      </form>
    </Modal>
  );
}

// Shown at the top of a single seller's shop page: announcement, about, links,
// funding goal, tip jar and supporter wall. Renders nothing if the seller has
// not set any of it up.
export default function SupportCard({ slug }) {
  const { shop } = useShop();
  const [info, setInfo] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setInfo(null);
    fetchPublicSupport(slug).then((r) => { if (alive) setInfo(r); }).catch((e) => console.error(e));
    return () => { alive = false; };
  }, [slug]);

  if (!info) return null;
  const links = (info.links || []).map((l) => ({ label: l.label, url: safeUrl(l.url) })).filter((l) => l.url);
  const hasGoal = info.enabled && info.goalAmount > 0;
  const anything = info.announcement || info.bio || links.length || info.enabled;
  if (!anything) return null;
  const pct = hasGoal ? Math.min(100, Math.round((info.raised / info.goalAmount) * 100)) : 0;
  const cur = info.currency || 'PHP';

  return (
    <div style={{ marginBottom: 18 }}>
      {info.announcement && <div className="support-banner"><Icon name="sparkles" size={16} /> {info.announcement}</div>}
      {(info.bio || links.length > 0 || info.enabled) && (
        <div className="panel">
          {info.bio && <p style={{ marginTop: 0, whiteSpace: 'pre-line' }}>{info.bio}</p>}
          {links.length > 0 && (
            <div className="wizard-shared-chips">
              {links.map((l, i) => (
                <a key={i} className="wizard-shared-chip" href={l.url} target="_blank" rel="noopener noreferrer">{l.label || l.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 30)}</a>
              ))}
            </div>
          )}
          {info.enabled && (
            <div style={{ marginTop: info.bio || links.length ? 14 : 0 }}>
              {hasGoal && (
                <>
                  <div className="order-name">{info.goalTitle || 'Shop goal'}</div>
                  <div className="goal-track"><div className="goal-fill" style={{ width: pct + '%' }} /></div>
                  <div className="order-meta">{money(info.raised, cur)} of {money(info.goalAmount, cur)} · {pct}%</div>
                </>
              )}
              {!shop && info.payMethods.length > 0 && (
                <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={() => setOpen(true)}><Icon name="gift" size={16} /> Support this shop</button>
              )}
              {info.supporters.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div className="side-section" style={{ padding: '0 0 6px' }}>Supporters</div>
                  {info.supporters.map((s, i) => (
                    <div className="ins-row" key={i}>
                      <div>
                        <div className="order-name">{s.name}</div>
                        {s.message && <div className="hint small">"{s.message}"</div>}
                      </div>
                      <span className="mono">{money(s.amount, cur)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {open && <TipModal slug={slug} info={info} onClose={() => setOpen(false)} />}
    </div>
  );
}
