import React, { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { sb } from '../lib/supabaseClient';
import { useShop } from '../lib/ShopContext.jsx';
import { saveBuyerContact } from '../lib/api.js';
import { navigate } from '../lib/router.js';
import { fmtDateTime, money } from '../lib/utils.js';

// The buyer's own home. Sellers never see this page and buyers never see the
// seller dashboard (see the route guards in App.jsx).
export default function BuyerDashboard() {
  const { buyer, setBuyer, logout } = useShop();
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('loading');
  const [phone, setPhone] = useState(buyer ? buyer.phone : '');
  const [address, setAddress] = useState(buyer ? buyer.address : '');
  const [saveMsg, setSaveMsg] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setStatus('loading');
    const res = await sb.from('orders').select('*').order('created_at', { ascending: false });
    if (res.error) { console.error(res.error); setStatus('error'); return; }
    setOrders(res.data || []);
    setStatus('ready');
  }
  useEffect(() => { load(); }, []);

  async function saveContact(e) {
    e.preventDefault();
    if (!buyer) return;
    setSaving(true); setSaveMsg('');
    const res = await saveBuyerContact(buyer.id, phone.trim(), address.trim());
    setSaving(false);
    if (res.error) { setSaveMsg("Couldn't save your details. Please try again."); return; }
    setBuyer({ ...buyer, phone: phone.trim(), address: address.trim() });
    setSaveMsg('Saved.');
  }

  if (!buyer) return null;
  const count = (s) => orders.filter((o) => o.status === s).length;
  const recent = orders.slice(0, 3);

  return (
    <div className="store">
      <header className="store-nav">
        <a className="store-brand" href="#/">
          <span className="brand-logo">CY</span>
          <span className="brand-text">Crafts ni Yukiii</span>
        </a>
        <div className="store-nav-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}><Icon name="shopbag" size={15} /> Shop</button>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/orders')}>My orders</button>
          <button className="btn btn-ghost btn-sm" onClick={async () => { await logout(); navigate('/'); }}>Log out</button>
        </div>
      </header>

      <div className="store-body" style={{ maxWidth: 720 }}>
        <div className="page-head">
          <div><h1>Hi, {(buyer.fullName || '').split(' ')[0] || 'there'}</h1><p>Your buyer account · {buyer.email}</p></div>
          <button className="btn btn-primary" onClick={() => navigate('/')}><Icon name="shopbag" size={16} /> Keep shopping</button>
        </div>

        <div className="stat-grid">
          <div className="stat-card"><div className="stat-label">Orders placed</div><div className="stat-value">{status === 'ready' ? orders.length : '–'}</div></div>
          <div className="stat-card"><div className="stat-label">Waiting for seller</div><div className="stat-value">{status === 'ready' ? count('Pending') : '–'}</div></div>
          <div className="stat-card"><div className="stat-label">Confirmed</div><div className="stat-value">{status === 'ready' ? count('Confirmed') : '–'}</div></div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Recent orders</div>
            <button className="view-all" onClick={() => navigate('/orders')}>View all</button>
          </div>
          {status === 'loading' && <div className="empty-box">Loading orders…</div>}
          {status === 'error' && <div className="empty-box">Couldn't load your orders. <button className="link-btn" onClick={load}>Try again</button></div>}
          {status === 'ready' && recent.length === 0 && <div className="empty-box">No orders yet. Go find something you like!</div>}
          {recent.map((o) => (
            <div className="ins-row" key={o.id}>
              <div>
                <div className="order-name">{o.shop_name}</div>
                <div className="order-meta">{fmtDateTime(o.created_at)} · {o.items.reduce((a, it) => a + it.qty, 0)} item(s)</div>
              </div>
              <div className="ins-side">
                <div className="mono">{money(o.total, o.currency)}</div>
                <span className={'order-badge ' + o.status.toLowerCase()}>{o.status}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="panel-head"><div className="panel-title">Delivery details</div></div>
          <form onSubmit={saveContact}>
            <div className="form-field"><label>Contact number</label><input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" /></div>
            <div className="form-field"><label>Delivery address</label><textarea rows={3} value={address} onChange={(e) => setAddress(e.target.value)} /></div>
            {saveMsg && <div className={saveMsg === 'Saved.' ? 'form-success' : 'form-error'}>{saveMsg}</div>}
            <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save details'}</button>
          </form>
          <p className="hint small">These are pre-filled at checkout.</p>
        </div>
      </div>
    </div>
  );
}
