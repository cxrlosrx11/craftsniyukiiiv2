import React, { useEffect, useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import Modal from './Modal.jsx';
import { useShop } from '../lib/ShopContext.jsx';
import { money, uid, fmtDateTime } from '../lib/utils.js';
import {
  listEvents, saveEvent, deleteEvent, setReserveEnabled, listReservations, setReservationStatus,
  fmtRange, itemsText, todayStr
} from '../lib/pickups.js';

const PAYMENTS = ['Cash', 'GCash', 'GoTyme', 'Maya'];
const blank = () => ({ id: null, name: '', venue: '', booth: '', startsOn: '', endsOn: '', reserveEnabled: true, note: '' });

export default function ConventionMode() {
  const { shop, data, mutate } = useShop();
  const cur = shop.currency || 'PHP';
  const [events, setEvents] = useState([]);
  const [resv, setResv] = useState([]);
  const [state, setState] = useState('loading');
  const [form, setForm] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [pay, setPay] = useState({});

  async function load() {
    try {
      const [e, r] = await Promise.all([listEvents(shop.id), listReservations(shop.id)]);
      setEvents(e); setResv(r); setState('ready');
    } catch (e) { console.error(e); setState('error'); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const today = todayStr();
  const upcoming = events.filter((e) => e.ends_on >= today);
  const past = events.filter((e) => e.ends_on < today).reverse();
  const stockOf = useMemo(() => Object.fromEntries((data.products || []).map((p) => [p.id, p.stock])), [data.products]);

  async function submitEvent(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.startsOn || !form.endsOn) { setErr('Enter a name and dates.'); return; }
    if (form.endsOn < form.startsOn) { setErr('The end date is before the start date.'); return; }
    setBusy('form'); setErr('');
    try { await saveEvent(shop.id, form); setForm(null); await load(); }
    catch (ex) { setErr(ex.message || "Couldn't save the event."); }
    setBusy('');
  }

  async function removeEvent(ev) {
    const n = resv.filter((r) => r.event_id === ev.id && ['Reserved', 'Ready'].includes(r.status)).length;
    if (!confirm(n ? `Delete "${ev.name}"? ${n} active reservation(s) will be deleted with it.` : `Delete "${ev.name}"?`)) return;
    try { await deleteEvent(ev.id); await load(); } catch (ex) { setErr(ex.message || "Couldn't delete."); }
  }

  async function toggleReserve(ev) {
    try { await setReserveEnabled(ev.id, !ev.reserve_enabled); await load(); } catch (ex) { setErr(ex.message || "Couldn't update."); }
  }

  async function act(r, status) {
    setBusy(r.id); setErr('');
    try {
      await setReservationStatus(r.id, status);
      if (status === 'PickedUp') {
        // Record it as a normal sale and take the pieces out of stock.
        const method = pay[r.id] || 'Cash';
        mutate((d) => {
          const items = r.items.map((it) => {
            const p = d.products.find((x) => x.id === it.productId);
            return { productId: it.productId, name: it.name, price: it.price, cost: p ? p.cost : 0, image: p ? p.image : '', category: p ? p.category : '', qty: it.qty };
          });
          items.forEach((it) => {
            const p = d.products.find((x) => x.id === it.productId);
            if (p) {
              p.stock = Math.max(0, p.stock - it.qty);
              d.stockLog.unshift({ id: uid('log'), productId: p.id, name: p.name, delta: -it.qty, resultingStock: p.stock, date: new Date().toISOString() });
            }
          });
          d.sales.unshift({
            id: uid('sale'), date: new Date().toISOString(), items, total: Number(r.total), status: 'Completed',
            paymentMethod: method, source: 'pickup', orderId: r.id, buyerName: r.buyer_name
          });
        });
      }
      await load();
    } catch (ex) { setErr(ex.message || "Couldn't update that reservation."); }
    setBusy('');
  }

  function openForm(ev) {
    setErr('');
    setForm(ev ? { id: ev.id, name: ev.name, venue: ev.venue, booth: ev.booth, startsOn: ev.starts_on, endsOn: ev.ends_on, reserveEnabled: ev.reserve_enabled, note: ev.note } : blank());
  }
  const setF = (patch) => setForm((f) => ({ ...f, ...patch }));
  function copyFrom(id) {
    const c = (data.conventions || []).find((x) => x.id === id);
    if (c) setF({ name: c.name, startsOn: c.date, endsOn: c.date, venue: c.location || '' });
  }

  const renderEvent = (ev, isPast) => {
    const mine = resv.filter((r) => r.event_id === ev.id);
    const active = mine.filter((r) => ['Reserved', 'Ready'].includes(r.status));
    const closed = mine.filter((r) => !['Reserved', 'Ready'].includes(r.status));
    const need = {};
    active.forEach((r) => r.items.forEach((it) => {
      need[it.productId] = need[it.productId] || { name: it.name, qty: 0 };
      need[it.productId].qty += it.qty;
    }));
    const needRows = Object.entries(need);
    return (
      <div className="panel" key={ev.id}>
        <div className="panel-head">
          <div>
            <div className="panel-title">{ev.name}</div>
            <div className="order-meta">{fmtRange(ev.starts_on, ev.ends_on)}{ev.venue ? ` · ${ev.venue}` : ''}{ev.booth ? ` · Booth ${ev.booth}` : ''}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {!isPast && (
              <button className="btn btn-ghost btn-sm" onClick={() => toggleReserve(ev)}>
                {ev.reserve_enabled ? 'Reservations open · Close' : 'Reservations closed · Open'}
              </button>
            )}
            <button className="icon-btn" title="Edit" onClick={() => openForm(ev)}><Icon name="edit" size={15} /></button>
            <button className="icon-btn" title="Delete" onClick={() => removeEvent(ev)}><Icon name="trash" size={15} /></button>
          </div>
        </div>

        {needRows.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div className="side-section" style={{ padding: '0 0 6px' }}>Pick-list: bring these</div>
            {needRows.map(([pid, n]) => (
              <div className="ins-row" key={pid}>
                <div className="order-name">{n.name}</div>
                <div className="ins-side">
                  <span className="mono">{n.qty} reserved</span>
                  {stockOf[pid] !== undefined && stockOf[pid] < n.qty && <div className="order-meta" style={{ color: '#9a2b2b' }}>only {stockOf[pid]} in stock</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {active.length === 0 && closed.length === 0 && <div className="empty-box">No reservations yet.{ev.reserve_enabled ? '' : ' Reservations are closed.'}</div>}
        {active.map((r) => (
          <div className="ins-row" key={r.id} style={{ alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <div className="order-name"><span className="mono">{r.code}</span> · {r.buyer_name}</div>
              <div className="order-meta">{itemsText(r.items)} · {money(r.total, cur)}</div>
              {r.note && <div className="hint small">"{r.note}"</div>}
              <div className="order-meta">{fmtDateTime(r.created_at)}</div>
            </div>
            <div className="ins-side" style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
              <span className={'order-badge ' + (r.status === 'Ready' ? 'confirmed' : 'pending')}>{r.status}</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {r.status === 'Reserved' && <button className="btn btn-ghost btn-sm" disabled={busy === r.id} onClick={() => act(r, 'Ready')}>Mark ready</button>}
                <select value={pay[r.id] || 'Cash'} onChange={(e) => setPay({ ...pay, [r.id]: e.target.value })} style={{ width: 'auto' }} aria-label="Payment method">
                  {PAYMENTS.map((m) => <option key={m}>{m}</option>)}
                </select>
                <button className="btn btn-primary btn-sm" disabled={busy === r.id} onClick={() => act(r, 'PickedUp')}>Picked up</button>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="link-btn" disabled={busy === r.id} onClick={() => act(r, 'NoShow')}>No-show</button>
                <button className="link-btn" disabled={busy === r.id} onClick={() => act(r, 'Cancelled')}>Cancel</button>
              </div>
            </div>
          </div>
        ))}
        {closed.length > 0 && (
          <details style={{ marginTop: 8 }}>
            <summary className="hint small" style={{ cursor: 'pointer' }}>{closed.length} finished</summary>
            {closed.map((r) => (
              <div className="ins-row" key={r.id}>
                <div className="order-meta"><span className="mono">{r.code}</span> · {r.buyer_name} · {itemsText(r.items)}</div>
                <span className={'order-badge ' + (r.status === 'PickedUp' ? 'confirmed' : 'declined')}>{r.status === 'PickedUp' ? 'Picked up' : r.status === 'NoShow' ? 'No-show' : 'Cancelled'}</span>
              </div>
            ))}
          </details>
        )}
      </div>
    );
  };

  if (state === 'loading') return <div className="empty-box">Loading…</div>;
  if (state === 'error') return <div className="empty-box">Couldn't load Convention Mode. Did you run <code>supabase-convention-mode.sql</code> in Supabase? <button className="link-btn" onClick={load}>Try again</button></div>;

  return (
    <div>
      <div className="page-head">
        <div><h1>Convention Mode</h1><p>Tell buyers where you'll be. They reserve online, you get a pick-list, and they pay at your booth.</p></div>
        <button className="btn btn-primary" onClick={() => openForm(null)}>+ Add event</button>
      </div>
      {err && !form && <div className="form-error">{err}</div>}

      <p className="hint small">Reserved pieces are held back from on-site sales, so you never sell something that's promised to someone. Marking a reservation "Picked up" records the sale and updates your stock.</p>

      {upcoming.length === 0 && <div className="empty-box">No upcoming events. Add one and it appears on your public profile as "Find me at".</div>}
      {upcoming.map((ev) => renderEvent(ev, false))}
      {past.length > 0 && (
        <details style={{ marginTop: 14 }}>
          <summary className="side-section" style={{ cursor: 'pointer' }}>Past events ({past.length})</summary>
          {past.map((ev) => renderEvent(ev, true))}
        </details>
      )}

      {form && (
        <Modal title={form.id ? 'Edit event' : 'Add event'} onClose={() => setForm(null)}>
          <form onSubmit={submitEvent}>
            {!form.id && (data.conventions || []).length > 0 && (
              <div className="form-field"><label>Copy from a convention you logged</label>
                <select defaultValue="" onChange={(e) => copyFrom(e.target.value)}>
                  <option value="">Start from scratch</option>
                  {data.conventions.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.date})</option>)}
                </select>
              </div>
            )}
            <div className="form-field"><label>Event name</label><input value={form.name} maxLength={80} required onChange={(e) => setF({ name: e.target.value })} /></div>
            <div className="form-row">
              <div className="form-field"><label>Starts</label><input type="date" value={form.startsOn} required onChange={(e) => setF({ startsOn: e.target.value, endsOn: form.endsOn && form.endsOn >= e.target.value ? form.endsOn : e.target.value })} /></div>
              <div className="form-field"><label>Ends</label><input type="date" value={form.endsOn} min={form.startsOn} required onChange={(e) => setF({ endsOn: e.target.value })} /></div>
            </div>
            <div className="form-row">
              <div className="form-field"><label>Venue</label><input value={form.venue} maxLength={80} onChange={(e) => setF({ venue: e.target.value })} /></div>
              <div className="form-field"><label>Booth</label><input value={form.booth} maxLength={30} onChange={(e) => setF({ booth: e.target.value })} placeholder="e.g. B12" /></div>
            </div>
            <div className="form-field"><label>Note for buyers (optional)</label><input value={form.note} maxLength={200} onChange={(e) => setF({ note: e.target.value })} placeholder="e.g. Reserve by Friday. Pick up at the booth, pay in cash or GCash." /></div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, fontWeight: 600 }}>
              <input type="checkbox" checked={form.reserveEnabled} onChange={(e) => setF({ reserveEnabled: e.target.checked })} /> Let buyers reserve items for pickup
            </label>
            {err && <div className="form-error">{err}</div>}
            <button className="btn btn-primary btn-block" type="submit" disabled={busy === 'form'}>{busy === 'form' ? 'Saving…' : form.id ? 'Save changes' : 'Add event'}</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
