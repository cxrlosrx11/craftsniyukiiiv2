import React, { useEffect, useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import Modal from './Modal.jsx';
import { useShop } from '../lib/ShopContext.jsx';
import { money, uid, fmtDateTime } from '../lib/utils.js';
import {
  KINDS, ACTIVE, STATUS_LABEL, newId, listOffers, saveOffer, setOfferOpen, deleteOffer, listRequests,
  setRequestStatus, updateQuote, selectionLines, addDaysStr
} from '../lib/customOrders.js';

const PAYMENTS = ['Cash', 'GCash', 'GoTyme', 'Maya'];
const FILTERS = { Active: ACTIVE, Done: ['Completed'], Closed: ['Declined', 'Cancelled'], All: null };
const blankOffer = () => ({
  id: null, title: '', description: '', basePrice: 0, leadTimeDays: 7, slotsTotal: '', isOpen: true,
  options: [{ id: newId('g'), label: '', kind: 'single', required: true, max: 2, choices: [{ id: newId('c'), label: '', price: 0 }] }]
});

export default function CustomOrders() {
  const { shop, data, mutate } = useShop();
  const cur = shop.currency || 'PHP';
  const [offers, setOffers] = useState([]);
  const [reqs, setReqs] = useState([]);
  const [state, setState] = useState('loading');
  const [form, setForm] = useState(null);
  const [filter, setFilter] = useState('Active');
  const [draft, setDraft] = useState({});
  const [pay, setPay] = useState({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');

  async function load() {
    try {
      const [o, r] = await Promise.all([listOffers(shop.id), listRequests(shop.id)]);
      setOffers(o); setReqs(r); setState('ready');
    } catch (e) { console.error(e); setState('error'); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const offerById = useMemo(() => Object.fromEntries(offers.map((o) => [o.id, o])), [offers]);
  const shown = reqs.filter((r) => !FILTERS[filter] || FILTERS[filter].includes(r.status));
  const activeCount = (o) => reqs.filter((r) => r.offer_id === o.id && ACTIVE.includes(r.status)).length;

  /* ----- offer editor ----- */
  const setF = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setGroup = (gi, patch) => setF({ options: form.options.map((g, i) => (i === gi ? { ...g, ...patch } : g)) });
  const setChoice = (gi, ci, patch) => setGroup(gi, { choices: form.options[gi].choices.map((c, i) => (i === ci ? { ...c, ...patch } : c)) });

  function openForm(o) {
    setErr('');
    setForm(o ? {
      id: o.id, title: o.title, description: o.description, basePrice: o.base_price, leadTimeDays: o.lead_time_days,
      slotsTotal: o.slots_total || '', isOpen: o.is_open, options: JSON.parse(JSON.stringify(o.options || []))
    } : blankOffer());
  }

  async function submitOffer(e) {
    e.preventDefault();
    setBusy('form'); setErr('');
    try { await saveOffer(shop.id, form); setForm(null); await load(); }
    catch (ex) { setErr(ex.message || "Couldn't save."); }
    setBusy('');
  }

  async function removeOffer(o) {
    const n = activeCount(o);
    if (!confirm(n ? `Delete "${o.title}"? ${n} active request(s) will be deleted with it.` : `Delete "${o.title}"?`)) return;
    try { await deleteOffer(o.id); await load(); } catch (ex) { setErr(ex.message || "Couldn't delete."); }
  }

  async function toggleOpen(o) {
    try { await setOfferOpen(o.id, !o.is_open); await load(); } catch (ex) { setErr(ex.message || "Couldn't update."); }
  }

  /* ----- requests ----- */
  const draftOf = (r) => {
    const o = offerById[r.offer_id];
    const base = {
      quote: r.quoted_total != null ? r.quoted_total : r.est_total,
      eta: r.eta || (o ? addDaysStr(o.lead_time_days) : ''),
      note: r.seller_note || ''
    };
    return { ...base, ...(draft[r.id] || {}) };
  };
  const setD = (id, patch) => setDraft((d) => ({ ...d, [id]: { ...(d[id] || {}), ...patch } }));

  async function move(r, status) {
    const d = draftOf(r);
    setBusy(r.id); setErr('');
    try {
      const sendQuote = ['Accepted'].includes(status) || r.status === 'Requested' ? Number(d.quote) : null;
      await setRequestStatus(r.id, status, {
        quote: sendQuote != null && !isNaN(sendQuote) ? sendQuote : null,
        note: d.note || null,
        eta: d.eta || null
      });
      if (status === 'Completed') {
        const total = Number(r.quoted_total != null ? r.quoted_total : r.est_total);
        const offer = offerById[r.offer_id];
        mutate((dd) => {
          dd.sales.unshift({
            id: uid('sale'), date: new Date().toISOString(),
            items: [{ productId: 'custom_' + r.offer_id, name: (offer ? offer.title : 'Custom order') + ' (custom)', price: Math.round((total / r.qty) * 100) / 100, cost: 0, image: '', category: 'Custom', qty: r.qty }],
            total, status: 'Completed', paymentMethod: pay[r.id] || 'Cash', source: 'custom', orderId: r.id, buyerName: r.buyer_name
          });
        });
      }
      await load();
    } catch (ex) { setErr(ex.message || "Couldn't update that request."); }
    setBusy('');
  }

  async function saveQuote(r) {
    const d = draftOf(r);
    setBusy(r.id); setErr('');
    try { await updateQuote(r.id, { quote: Number(d.quote), note: d.note || null, eta: d.eta || null }); await load(); }
    catch (ex) { setErr(ex.message || "Couldn't save."); }
    setBusy('');
  }

  if (state === 'loading') return <div className="empty-box">Loading…</div>;
  if (state === 'error') return <div className="empty-box">Couldn't load custom orders. Did you run <code>supabase-custom-orders.sql</code> in Supabase? <button className="link-btn" onClick={load}>Try again</button></div>;

  return (
    <div>
      <div className="page-head">
        <div><h1>Custom orders</h1><p>Set up a custom order with the choices you offer. Buyers pick from them, you send a final price and a ready date.</p></div>
        <button className="btn btn-primary" onClick={() => openForm(null)}>+ New custom order</button>
      </div>
      {err && !form && <div className="form-error">{err}</div>}

      <div className="panel">
        <div className="panel-head"><div className="panel-title">Your custom order options</div></div>
        {offers.length === 0 && <div className="empty-box">Nothing yet. Create one, like "Custom keychain": pick a base, pick charms, add a name. It shows on your public profile.</div>}
        {offers.map((o) => (
          <div className="ins-row" key={o.id} style={{ alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <div className="order-name">{o.title} <span className={'order-badge ' + (o.is_open ? 'confirmed' : 'declined')}>{o.is_open ? 'Open' : 'Closed'}</span></div>
              <div className="order-meta">
                From {money(o.base_price, cur)} · ready in about {o.lead_time_days} day{o.lead_time_days === 1 ? '' : 's'}
                {o.slots_total ? ` · ${Math.max(0, o.slots_total - activeCount(o))} of ${o.slots_total} slots open` : ''}
              </div>
              <div className="order-meta">{(o.options || []).map((g) => g.label).join(' · ') || 'No choices'}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => toggleOpen(o)}>{o.is_open ? 'Close' : 'Open'}</button>
              <button className="icon-btn" title="Edit" onClick={() => openForm(o)}><Icon name="edit" size={15} /></button>
              <button className="icon-btn" title="Delete" onClick={() => removeOffer(o)}><Icon name="trash" size={15} /></button>
            </div>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel-head"><div className="panel-title">Requests</div></div>
        <div className="chips">
          {Object.keys(FILTERS).map((f) => <button key={f} type="button" className={'chip ' + (filter === f ? 'active' : '')} onClick={() => setFilter(f)}>{f}</button>)}
        </div>
        {shown.length === 0 && <div className="empty-box">No {filter === 'All' ? '' : filter.toLowerCase() + ' '}requests.</div>}
        {shown.map((r) => {
          const o = offerById[r.offer_id];
          const d = draftOf(r);
          const isActive = ACTIVE.includes(r.status);
          return (
            <div className="ins-row" key={r.id} style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div className="order-name"><span className="mono">{r.code}</span> · {r.buyer_name} · {o ? o.title : 'Custom order'} × {r.qty}</div>
                  {selectionLines(r.selections).map((line, i) => <div className="order-meta" key={i}>{line}</div>)}
                  {r.note && <div className="hint small">"{r.note}"</div>}
                  <div className="order-meta">{fmtDateTime(r.created_at)} · estimate {money(r.est_total, cur)}</div>
                </div>
                <span className={'order-badge ' + (r.status === 'Requested' ? 'pending' : ['Declined', 'Cancelled'].includes(r.status) ? 'declined' : 'confirmed')} style={{ alignSelf: 'flex-start' }}>{STATUS_LABEL[r.status]}</span>
              </div>
              {isActive && (
                <div style={{ width: '100%' }}>
                  <div className="form-row">
                    <div className="form-field"><label>Final price ({cur})</label><input type="number" min="0" step="0.01" value={d.quote} onChange={(e) => setD(r.id, { quote: e.target.value })} /></div>
                    <div className="form-field"><label>Ready by</label><input type="date" value={d.eta} onChange={(e) => setD(r.id, { eta: e.target.value })} /></div>
                  </div>
                  <div className="form-field"><label>Message to buyer (optional)</label><input maxLength={300} value={d.note} onChange={(e) => setD(r.id, { note: e.target.value })} placeholder="e.g. Sure! I'll send a photo when it's done." /></div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {r.status === 'Requested' && <>
                      <button className="btn btn-primary btn-sm" disabled={busy === r.id} onClick={() => move(r, 'Accepted')}>Accept &amp; send price</button>
                      <button className="btn btn-ghost btn-sm" disabled={busy === r.id} onClick={() => move(r, 'Declined')}>Decline</button>
                    </>}
                    {r.status === 'Accepted' && <button className="btn btn-primary btn-sm" disabled={busy === r.id} onClick={() => move(r, 'InProgress')}>Start work</button>}
                    {['Accepted', 'InProgress'].includes(r.status) && <button className="btn btn-ghost btn-sm" disabled={busy === r.id} onClick={() => move(r, 'Ready')}>Mark ready</button>}
                    {r.status === 'Ready' && <>
                      <select value={pay[r.id] || 'Cash'} onChange={(e) => setPay({ ...pay, [r.id]: e.target.value })} style={{ width: 'auto' }} aria-label="Payment method">
                        {PAYMENTS.map((m) => <option key={m}>{m}</option>)}
                      </select>
                      <button className="btn btn-primary btn-sm" disabled={busy === r.id} onClick={() => move(r, 'Completed')}>Paid &amp; handed over</button>
                    </>}
                    {r.status !== 'Requested' && <button className="link-btn" disabled={busy === r.id} onClick={() => saveQuote(r)}>Update price / date / message</button>}
                    {r.status !== 'Requested' && <button className="link-btn" disabled={busy === r.id} onClick={() => confirm('Cancel this request?') && move(r, 'Cancelled')}>Cancel</button>}
                  </div>
                </div>
              )}
              {!isActive && r.status !== 'Declined' && r.status !== 'Cancelled' && r.quoted_total != null && <div className="order-meta">Final price {money(r.quoted_total, cur)}</div>}
            </div>
          );
        })}
      </div>

      {form && (
        <Modal title={form.id ? 'Edit custom order' : 'New custom order'} onClose={() => setForm(null)}>
          <form onSubmit={submitOffer}>
            <div className="form-field"><label>Name</label><input required maxLength={80} value={form.title} onChange={(e) => setF({ title: e.target.value })} placeholder="e.g. Custom keychain" /></div>
            <div className="form-field"><label>Description</label><textarea rows={2} maxLength={400} value={form.description} onChange={(e) => setF({ description: e.target.value })} placeholder="What buyers get, materials, size…" /></div>
            <div className="form-row">
              <div className="form-field"><label>Starting price ({cur})</label><input type="number" min="0" step="0.01" value={form.basePrice} onChange={(e) => setF({ basePrice: e.target.value })} /></div>
              <div className="form-field"><label>Ready in (days)</label><input type="number" min="0" max="365" value={form.leadTimeDays} onChange={(e) => setF({ leadTimeDays: e.target.value })} /></div>
            </div>
            <div className="form-field"><label>Limited slots (optional)</label><input type="number" min="1" max="50" value={form.slotsTotal} onChange={(e) => setF({ slotsTotal: e.target.value })} placeholder="Leave empty for unlimited" /></div>

            <div className="side-section" style={{ padding: '8px 0 6px' }}>Choices buyers can make</div>
            {form.options.map((g, gi) => (
              <div className="panel" key={g.id} style={{ padding: 12, marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input style={{ flex: 1, minWidth: 120 }} placeholder="Label, e.g. Charms" maxLength={40} value={g.label} onChange={(e) => setGroup(gi, { label: e.target.value })} />
                  <select value={g.kind} onChange={(e) => setGroup(gi, { kind: e.target.value })} style={{ width: 'auto' }}>
                    {Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                  <button type="button" className="icon-btn" title="Remove this choice group" onClick={() => setF({ options: form.options.filter((_, i) => i !== gi) })}><Icon name="trash" size={15} /></button>
                </div>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, margin: '8px 0' }}>
                  <input type="checkbox" checked={!!g.required} onChange={(e) => setGroup(gi, { required: e.target.checked })} /> Required
                  {g.kind === 'multi' && <span style={{ marginLeft: 12 }}>Up to <input type="number" min="1" max="12" value={g.max || 2} onChange={(e) => setGroup(gi, { max: e.target.value })} style={{ width: 56 }} /> picks</span>}
                </label>
                {g.kind !== 'text' && (
                  <>
                    {g.choices.map((c, ci) => (
                      <div key={c.id} style={{ display: 'flex', gap: 8, margin: '6px 0' }}>
                        <input style={{ flex: 1 }} placeholder="Option" maxLength={40} value={c.label} onChange={(e) => setChoice(gi, ci, { label: e.target.value })} />
                        <input style={{ width: 90 }} type="number" min="0" step="0.01" placeholder="+ price" value={c.price} onChange={(e) => setChoice(gi, ci, { price: e.target.value })} aria-label="Extra price" />
                        <button type="button" className="icon-btn" title="Remove option" onClick={() => setGroup(gi, { choices: g.choices.filter((_, i) => i !== ci) })}><Icon name="trash" size={15} /></button>
                      </div>
                    ))}
                    {g.choices.length < 12 && <button type="button" className="link-btn" onClick={() => setGroup(gi, { choices: [...g.choices, { id: newId('c'), label: '', price: 0 }] })}>+ Add option</button>}
                  </>
                )}
              </div>
            ))}
            {form.options.length < 6 && <button type="button" className="link-btn" onClick={() => setF({ options: [...form.options, { id: newId('g'), label: '', kind: 'single', required: false, max: 2, choices: [{ id: newId('c'), label: '', price: 0 }] }] })}>+ Add a choice group</button>}

            <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0', fontWeight: 600 }}>
              <input type="checkbox" checked={form.isOpen} onChange={(e) => setF({ isOpen: e.target.checked })} /> Accepting requests
            </label>
            {err && <div className="form-error">{err}</div>}
            <button className="btn btn-primary btn-block" type="submit" disabled={busy === 'form'}>{busy === 'form' ? 'Saving…' : form.id ? 'Save changes' : 'Create'}</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
