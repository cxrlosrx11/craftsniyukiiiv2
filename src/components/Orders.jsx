import React, { useEffect, useState } from 'react';
import { sb } from '../lib/supabaseClient';
import { useShop } from '../lib/ShopContext.jsx';
import { fmtDateTime, money, uid } from '../lib/utils.js';

export default function Orders() {
  const { shop, data, mutate } = useShop();
  const cur = shop.currency || 'PHP';
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('loading');
  const [filter, setFilter] = useState('Pending');
  const [busyId, setBusyId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  async function load() {
    setStatus('loading');
    const res = await sb.from('orders').select('*').order('created_at', { ascending: false });
    if (res.error) { console.error(res.error); setStatus('error'); return; }
    setOrders(res.data || []);
    setStatus('ready');
  }
  useEffect(() => { load(); }, []);

  // Confirming records a normal sale (same shape as On-site sales) and deducts stock.
  async function confirmOrder(o) {
    setErrorMsg('');
    for (const it of o.items) {
      const p = data.products.find((x) => x.id === it.productId);
      if (!p) { setErrorMsg(`"${it.name}" no longer exists in your products. Decline this order or restore the item.`); return; }
      if (p.stock < it.qty) { setErrorMsg(`Not enough stock for "${it.name}" (${p.stock} left, ${it.qty} ordered). Restock or decline.`); return; }
    }
    setBusyId(o.id);
    // Mark confirmed first, only if it is still pending, so it can never be recorded twice.
    const res = await sb.from('orders')
      .update({ status: 'Confirmed', updated_at: new Date().toISOString() })
      .eq('id', o.id).eq('status', 'Pending').select('id');
    if (res.error || !res.data || res.data.length === 0) {
      setBusyId('');
      setErrorMsg('This order was already handled or could not be updated. Refreshing…');
      load();
      return;
    }
    mutate((d) => {
      const lines = o.items.map((it) => {
        const p = d.products.find((x) => x.id === it.productId);
        return { productId: it.productId, name: it.name, price: it.price, cost: p ? p.cost : 0, image: p ? p.image : '', category: it.category, qty: it.qty };
      });
      lines.forEach((l) => {
        const p = d.products.find((x) => x.id === l.productId);
        if (p) {
          p.stock = Math.max(0, p.stock - l.qty);
          d.stockLog.unshift({ id: uid('log'), productId: p.id, name: p.name, delta: -l.qty, resultingStock: p.stock, date: new Date().toISOString() });
        }
      });
      d.sales.unshift({
        id: uid('sale'), date: new Date().toISOString(), items: lines, total: Number(o.total),
        status: 'Completed', paymentMethod: o.payment_method, source: 'online', orderId: o.id, buyerName: o.buyer_name
      });
    });
    setBusyId('');
    load();
  }

  async function declineOrder(o) {
    if (!confirm('Decline this order? The buyer will see it as declined.')) return;
    setBusyId(o.id);
    await sb.from('orders').update({ status: 'Declined', updated_at: new Date().toISOString() }).eq('id', o.id).eq('status', 'Pending');
    setBusyId('');
    load();
  }

  const shown = orders.filter((o) => filter === 'All' || o.status === filter);
  const pending = orders.filter((o) => o.status === 'Pending').length;

  return (
    <div>
      <div className="page-head">
        <div><h1>Online orders</h1><p>{pending} waiting for you. Confirm an order to record the sale and deduct stock.</p></div>
        <button className="btn btn-ghost" onClick={load}>↻ Refresh</button>
      </div>
      <div className="chips">
        {['Pending', 'Confirmed', 'Declined', 'Cancelled', 'All'].map((f) => (
          <button key={f} className={'chip ' + (filter === f ? 'active' : '')} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>
      {errorMsg && <div className="form-error">{errorMsg}</div>}
      {status === 'loading' && <div className="empty-box">Loading orders…</div>}
      {status === 'error' && <div className="empty-box">Couldn't load orders. Did you run <code>supabase-buyers-orders.sql</code>? <button className="link-btn" onClick={load}>Try again</button></div>}
      {status === 'ready' && shown.length === 0 && <div className="empty-box">No {filter === 'All' ? '' : filter.toLowerCase() + ' '}orders.</div>}
      {shown.map((o) => (
        <div className="panel" key={o.id}>
          <div className="panel-head">
            <div className="panel-title">{o.buyer_name}</div>
            <span className={'order-badge ' + o.status.toLowerCase()}>{o.status}</span>
          </div>
          <div className="hint small">{fmtDateTime(o.created_at)} · 📞 {o.buyer_phone} · Pay via {o.payment_method}</div>
          <div className="hint small">📍 {o.buyer_address}</div>
          {o.note && <div className="hint small">📝 {o.note}</div>}
          <ul className="order-items">
            {o.items.map((it, i) => <li key={i}>{it.name} × {it.qty} <span className="mono">{money(it.price * it.qty, cur)}</span></li>)}
          </ul>
          <div className="cart-sub"><span>Total</span><b className="mono">{money(o.total, cur)}</b></div>
          {o.status === 'Pending' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn btn-primary btn-sm" disabled={busyId === o.id} onClick={() => confirmOrder(o)}>✓ Confirm &amp; record sale</button>
              <button className="btn btn-ghost btn-sm" disabled={busyId === o.id} onClick={() => declineOrder(o)}>Decline</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
