import React, { useEffect, useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import { sb } from '../lib/supabaseClient';
import { useShop } from '../lib/ShopContext.jsx';
import { useCart } from '../lib/cart.js';
import { saveBuyerContact } from '../lib/api.js';
import { navigate } from '../lib/router.js';
import { money } from '../lib/utils.js';
import Modal from './Modal.jsx';

const PAYMENT_METHODS = ['Cash', 'GCash', 'GoTyme', 'Maya'];
const AFTER_LOGIN_KEY = 'cy_after_login';

export default function Storefront({ slug }) {
  const { shop, buyer, setBuyer, logout, setAuthView, setAuthRole } = useShop();
  const cart = useCart();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [seller, setSeller] = useState('All');
  const [open, setOpen] = useState(null);
  const [qty, setQty] = useState(1);
  const [cartStep, setCartStep] = useState(null); // null | 'cart' | 'gate' | 'checkout' | 'done'
  const [form, setForm] = useState({ phone: '', address: '', payment: 'Cash', note: '' });
  const [placing, setPlacing] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [placed, setPlaced] = useState([]); // [{shopName, total, currency}]

  async function load() {
    setStatus('loading');
    const res = await sb.rpc('public_storefront', { shop_slug: slug || null });
    if (res.error) { console.error(res.error); setStatus('error'); return; }
    setItems(res.data || []);
    setStatus('ready');
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [slug]);

  // Returning from sign-up / sign-in in the middle of checkout: go straight back to it.
  useEffect(() => {
    if (!buyer) return;
    setForm((f) => ({ ...f, phone: f.phone || buyer.phone, address: f.address || buyer.address }));
    let flag = null;
    try { flag = localStorage.getItem(AFTER_LOGIN_KEY); localStorage.removeItem(AFTER_LOGIN_KEY); } catch (e) { /* ignore */ }
    if (flag === 'checkout' && cart.count > 0) setCartStep('checkout');
    // eslint-disable-next-line
  }, [buyer]);

  const categories = useMemo(() => ['All', ...Array.from(new Set(items.map((i) => i.category).filter(Boolean)))], [items]);
  const sellers = useMemo(() => {
    const m = new Map();
    items.forEach((i) => m.set(i.shopSlug, i.shopName));
    return Array.from(m, ([s, name]) => ({ slug: s, name }));
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) =>
      (category === 'All' || i.category === category) &&
      (seller === 'All' || i.shopSlug === seller) &&
      (!q || (i.name || '').toLowerCase().includes(q) || (i.ip || '').toLowerCase().includes(q))
    );
  }, [items, search, category, seller]);

  const groups = useMemo(() => {
    const m = new Map();
    cart.lines.forEach((l) => {
      if (!m.has(l.shopSlug)) m.set(l.shopSlug, { shopSlug: l.shopSlug, shopName: l.shopName, currency: l.currency, lines: [] });
      m.get(l.shopSlug).lines.push(l);
    });
    return Array.from(m.values()).map((g) => ({ ...g, subtotal: g.lines.reduce((a, l) => a + l.price * l.qty, 0) }));
  }, [cart.lines]);

  const heading = slug && items[0] ? items[0].shopName : 'Crafts ni Yukiii';

  function openProduct(p) { setQty(1); setOpen(p); }
  function addToCart() {
    cart.add(open, qty);
    setOpen(null);
    setCartStep('cart');
  }

  function startCheckout() {
    setCheckoutError('');
    if (buyer) { setCartStep('checkout'); return; }
    setCartStep('gate'); // must create a buyer account first
  }
  function goAuth(view) {
    try { localStorage.setItem(AFTER_LOGIN_KEY, 'checkout'); } catch (e) { /* ignore */ }
    setAuthRole('buyer');
    setAuthView(view);
    setCartStep(null);
    navigate('/login');
  }

  async function placeOrders(e) {
    e.preventDefault();
    if (!form.phone.trim() || !form.address.trim()) { setCheckoutError('Enter your contact number and delivery address.'); return; }
    setPlacing(true); setCheckoutError('');
    const done = [];
    for (const g of groups) {
      const res = await sb.rpc('place_order', {
        shop_slug: g.shopSlug,
        order_items: g.lines.map((l) => ({ productId: l.productId, qty: l.qty })),
        contact_phone: form.phone, delivery_address: form.address,
        order_note: form.note, payment: form.payment
      });
      if (res.error) {
        setCheckoutError(`${g.shopName}: ${res.error.message}`);
        setPlacing(false);
        if (done.length) setPlaced(done);
        return;
      }
      cart.clearShop(g.shopSlug);
      done.push({ shopName: g.shopName, total: g.subtotal, currency: g.currency });
    }
    if (buyer && (form.phone !== buyer.phone || form.address !== buyer.address)) {
      saveBuyerContact(buyer.id, form.phone.trim(), form.address.trim());
      setBuyer({ ...buyer, phone: form.phone.trim(), address: form.address.trim() });
    }
    setPlaced(done);
    setPlacing(false);
    setCartStep('done');
    load(); // refresh stock shown on the shop
  }

  const firstName = buyer ? (buyer.fullName || '').split(' ')[0] : '';

  return (
    <div className="store">
      <header className="store-nav">
        <a className="store-brand" href="#/">
          <span className="brand-logo">CY</span>
          <span className="brand-text">Crafts ni Yukiii</span>
        </a>
        <div className="store-nav-actions">
          {!shop && (
            <button className="btn btn-ghost btn-sm" onClick={() => setCartStep('cart')}>
              <Icon name="cart" size={16} /> Cart{cart.count > 0 ? ` (${cart.count})` : ''}
            </button>
          )}
          {shop && <button className="btn btn-primary btn-sm" onClick={() => navigate('/dashboard')}>Dashboard</button>}
          {buyer && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/orders')}>My orders</button>
              <button className="btn btn-ghost btn-sm" title={buyer.email} onClick={async () => { await logout(); }}>Hi, {firstName} · Log out</button>
            </>
          )}
          {!shop && !buyer && (
            <button className="btn btn-primary btn-sm" onClick={() => { setAuthView('login'); navigate('/login'); }}>Sign in</button>
          )}
        </div>
      </header>

      <section className="store-hero">
        <h1>{slug ? heading : 'Shop handmade crafts'}</h1>
        <p>{slug ? 'Browse what is in stock right now.' : 'Pins, prints, charms and more — fresh from our small-shop sellers.'}</p>
        {slug && <a className="link-btn" href="#/"><Icon name="back" size={13} /> All shops</a>}
      </section>

      <div className="store-body">
        <div className="store-filters">
          <input className="list-search" placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {!slug && sellers.length > 1 && (
            <select value={seller} onChange={(e) => setSeller(e.target.value)}>
              <option value="All">All shops</option>
              {sellers.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
            </select>
          )}
        </div>
        <div className="chips">
          {categories.map((c) => (
            <button key={c} className={'chip ' + (category === c ? 'active' : '')} onClick={() => setCategory(c)}>{c}</button>
          ))}
        </div>

        {status === 'loading' && <div className="empty-box">Loading products…</div>}
        {status === 'error' && (
          <div className="empty-box">
            Couldn't load the shop right now.{' '}
            <button className="link-btn" onClick={load}>Try again</button>
          </div>
        )}
        {status === 'ready' && filtered.length === 0 && (
          <div className="empty-box">{items.length ? 'No products match your search.' : 'Nothing in stock yet — check back soon!'}</div>
        )}

        <div className="store-grid">
          {filtered.map((p) => (
            <button key={p.shopSlug + p.id} className="store-card" onClick={() => openProduct(p)}>
              <div className="store-media">
                {p.image ? <img src={p.image} alt={p.name} loading="lazy" /> : <Icon name="image" size={40} />}
                {p.stock <= 3 && <span className="store-badge">Only {p.stock} left</span>}
              </div>
              <div className="store-info">
                <div className="store-name">{p.name}</div>
                {!slug && <div className="store-seller">{p.shopName}</div>}
                <div className="store-price mono">{money(p.price, p.currency)}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {open && (
        <Modal title={open.name} onClose={() => setOpen(null)}>
          <div className="store-detail-media">
            {open.image ? <img src={open.image} alt={open.name} /> : <Icon name="image" size={64} />}
          </div>
          <div className="store-price mono" style={{ fontSize: 22, margin: '12px 0 4px' }}>{money(open.price, open.currency)}</div>
          <p className="hint" style={{ margin: '0 0 14px' }}>
            {[open.category, open.ip].filter(Boolean).join(' · ')}<br />
            Sold by <a href={`#/shop/${encodeURIComponent(open.shopSlug)}`} onClick={() => setOpen(null)}><b>{open.shopName}</b></a>
            {' · '}{open.stock} in stock
          </p>
          {shop ? (
            <p className="hint">You're signed in as a seller. Log out and use a buyer account to place orders.</p>
          ) : (
            <div className="qty-row">
              <div className="qty-stepper">
                <button type="button" className="icon-btn" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
                <span className="mono">{qty}</span>
                <button type="button" className="icon-btn" onClick={() => setQty(Math.min(open.stock, qty + 1))}>+</button>
              </div>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={addToCart}>
                Add to cart · {money(open.price * qty, open.currency)}
              </button>
            </div>
          )}
        </Modal>
      )}

      {cartStep === 'cart' && (
        <Modal title="Your cart" onClose={() => setCartStep(null)}>
          {groups.length === 0 ? (
            <div className="empty-box">Your cart is empty.</div>
          ) : (
            <>
              {groups.map((g) => (
                <div key={g.shopSlug} className="cart-group">
                  <div className="cart-shop">{g.shopName}</div>
                  {g.lines.map((l) => (
                    <div className="cart-line" key={l.productId}>
                      <div className="cart-thumb"><Icon name="image" size={18} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="store-name">{l.name}</div>
                        <div className="store-price mono">{money(l.price, g.currency)}</div>
                      </div>
                      <div className="qty-stepper">
                        <button type="button" className="icon-btn" onClick={() => cart.setQty(l.shopSlug, l.productId, l.qty - 1)}>−</button>
                        <span className="mono">{l.qty}</span>
                        <button type="button" className="icon-btn" disabled={l.qty >= l.stock} onClick={() => cart.setQty(l.shopSlug, l.productId, l.qty + 1)}>+</button>
                      </div>
                    </div>
                  ))}
                  <div className="cart-sub"><span>Subtotal</span><b className="mono">{money(g.subtotal, g.currency)}</b></div>
                </div>
              ))}
              {groups.length > 1 && <p className="hint small">Items from different shops are sent as separate orders.</p>}
              {shop ? (
                <p className="hint">You're signed in as a seller. Log out and use a buyer account to place orders.</p>
              ) : (
                <button className="btn btn-primary btn-block" style={{ marginTop: 10 }} onClick={startCheckout}>Proceed to checkout</button>
              )}
            </>
          )}
        </Modal>
      )}

      {cartStep === 'gate' && (
        <Modal title="Create a buyer account to continue" onClose={() => setCartStep('cart')}>
          <p className="hint" style={{ marginTop: 0 }}>
            To place an order you need a free buyer account, so sellers know who to contact and you can track your orders. Your cart will be waiting when you come back.
          </p>
          <button className="btn btn-primary btn-block" onClick={() => goAuth('signup')}>Create buyer account</button>
          <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => goAuth('login')}>I already have an account</button>
        </Modal>
      )}

      {cartStep === 'checkout' && (
        <Modal title="Checkout" onClose={() => setCartStep('cart')}>
          <form onSubmit={placeOrders}>
            <div className="form-field">
              <label>Contact number</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Delivery address</label>
              <textarea rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Preferred payment</label>
              <select value={form.payment} onChange={(e) => setForm({ ...form, payment: e.target.value })}>
                {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
              </select>
              <span className="hint small">You'll arrange the payment with the seller after they confirm.</span>
            </div>
            <div className="form-field">
              <label>Note to seller (optional)</label>
              <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
            <div className="cart-sub" style={{ marginBottom: 12 }}>
              <span>Total</span>
              <b className="mono">{groups.map((g) => money(g.subtotal, g.currency)).join(' + ')}</b>
            </div>
            {checkoutError && <div className="form-error">{checkoutError}</div>}
            <button className="btn btn-primary btn-block" type="submit" disabled={placing || !groups.length}>
              {placing ? 'Placing order…' : 'Place order'}
            </button>
          </form>
        </Modal>
      )}

      {cartStep === 'done' && (
        <Modal title={<span><Icon name="success" size={20} className="ok-icon" /> Order placed</span>} onClose={() => setCartStep(null)}>
          {placed.map((o, i) => (
            <p key={i} style={{ margin: '0 0 8px' }}>
              <b>{o.shopName}</b> received your order · <span className="mono">{money(o.total, o.currency)}</span>
            </p>
          ))}
          <p className="hint">The seller will confirm it and contact you about payment and delivery. You can follow its status under My orders.</p>
          <button className="btn btn-primary btn-block" onClick={() => { setCartStep(null); navigate('/orders'); }}>View my orders</button>
        </Modal>
      )}

      <footer className="store-footer">
        © Crafts ni Yukiii
        {!shop && !buyer && <> · <button className="link-btn" onClick={() => { setAuthView('login'); navigate('/login'); }}>Sign in</button></>}
      </footer>
    </div>
  );
}
