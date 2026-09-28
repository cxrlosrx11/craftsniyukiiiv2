import React, { useEffect, useState } from 'react';
import { sb } from '../lib/supabaseClient';
import { useShop } from '../lib/ShopContext.jsx';
import { navigate } from '../lib/router.js';
import { fmtDateTime, money } from '../lib/utils.js';

export default function BuyerOrders() {
  const { buyer, logout } = useShop();
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('loading');
  const [busyId, setBusyId] = useState('');

  async function load() {
    setStatus('loading');
    const res = await sb.from('orders').select('*').order('created_at', { ascending: false });
    if (res.error) { console.error(res.error); setStatus('error'); return; }
    setOrders(res.data || []);
    setStatus('ready');
  }
  useEffect(() => { load(); }, []);

  async function cancel(id) {
    if (!confirm('Cancel this order?')) return;
    setBusyId(id);
    await sb.rpc('cancel_order', { order_id: id });
    setBusyId('');
    load();
  }

  return (
    <div className="store">
      <header className="store-nav">
        <a className="store-brand" href="#/">
          <span className="brand-logo">CY</span>
          <span className="brand-text">Crafts ni Yukiii</span>
        </a>
        <div className="store-nav-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Back to shop</button>
          <button className="btn btn-ghost btn-sm" onClick={async () => { await logout(); navigate('/'); }}>Log out</button>
        </div>
      </header>
      <div className="store-body" style={{ maxWidth: 720 }}>
        <div className="page-head"><div><h1>My orders</h1><p>{buyer ? buyer.fullName : ''}</p></div></div>
        {status === 'loading' && <div className="empty-box">Loading orders…</div>}
        {status === 'error' && <div className="empty-box">Couldn't load your orders. <button className="link-btn" onClick={load}>Try again</button></div>}
        {status === 'ready' && orders.length === 0 && <div className="empty-box">No orders yet — go find something you like!</div>}
        {orders.map((o) => (
          <div className="panel" key={o.id}>
            <div className="panel-head">
              <div className="panel-title">{o.shop_name}</div>
              <span className={'order-badge ' + o.status.toLowerCase()}>{o.status}</span>
            </div>
            <div className="hint small">{fmtDateTime(o.created_at)} · Pay via {o.payment_method}</div>
            <ul className="order-items">
              {o.items.map((it, i) => <li key={i}>{it.name} × {it.qty} <span className="mono">{money(it.price * it.qty, o.currency)}</span></li>)}
            </ul>
            <div className="cart-sub"><span>Total</span><b className="mono">{money(o.total, o.currency)}</b></div>
            {o.status === 'Pending' && (
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} disabled={busyId === o.id} onClick={() => cancel(o.id)}>Cancel order</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
