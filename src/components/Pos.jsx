import React, { useMemo, useState } from 'react';
import { useShop } from '../lib/ShopContext.jsx';
import { money, uid } from '../lib/utils.js';

function bulkDiscountQty(cart) {
  return (cart || []).reduce((a, l) => a + (l.category === 'Pins' ? l.qty : 0), 0);
}
function bulkQtyDiscount(qty) {
  return Math.floor((qty || 0) / 3) * 5;
}
function cashFriendlyTotal(total, qty) {
  const whole = Math.round(total * 100) / 100;
  return Math.max(0, whole - bulkQtyDiscount(qty));
}
function logStock(data, productId, name, delta, resultingStock) {
  data.stockLog.unshift({ id: uid('log'), productId, name, delta, resultingStock, date: new Date().toISOString() });
}

export default function Pos() {
  const { shop, data, mutate } = useShop();
  const cur = shop.currency || 'PHP';

  const [mode, setMode] = useState('sell');
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [qsCart, setQsCart] = useState([]);
  const [rsCart, setRsCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentMenuOpen, setPaymentMenuOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const cart = mode === 'sell' ? qsCart : rsCart;
  const setCart = mode === 'sell' ? setQsCart : setRsCart;

  const cats = useMemo(() => Array.from(new Set(data.products.map((p) => p.category))), [data.products]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.products.filter((p) => {
      if (p.archived && mode === 'sell') return false;
      const matchesQ = !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
      const matchesCat = category === 'All' || p.category === category;
      return matchesQ && matchesCat;
    });
  }, [data.products, search, category, mode]);

  function addToCart(p) {
    setSuccessMsg('');
    const existing = cart.find((l) => l.productId === p.id);
    if (mode === 'sell') {
      if (p.archived) return;
      const already = existing ? existing.qty : 0;
      if (already >= p.stock) { setErrorMsg(`No more stock available for "${p.name}".`); return; }
      setErrorMsg('');
      if (existing) setCart(cart.map((l) => l.productId === p.id ? { ...l, qty: l.qty + 1 } : l));
      else setCart([...cart, { productId: p.id, name: p.name, price: p.price, cost: p.cost, image: p.image, category: p.category, qty: 1 }]);
    } else {
      setErrorMsg('');
      if (existing) setCart(cart.map((l) => l.productId === p.id ? { ...l, qty: l.qty + 1 } : l));
      else setCart([...cart, { productId: p.id, name: p.name, image: p.image, category: p.category, qty: 1 }]);
    }
  }

  function qtyChange(productId, delta) {
    const line = cart.find((l) => l.productId === productId);
    if (!line) return;
    const newQty = line.qty + delta;
    if (newQty < 1) { setCart(cart.filter((l) => l.productId !== productId)); return; }
    if (mode === 'sell') {
      const p = data.products.find((x) => x.id === productId);
      if (p && newQty > p.stock) { setErrorMsg(`Only ${p.stock} in stock for "${p.name}".`); return; }
    }
    setErrorMsg('');
    setCart(cart.map((l) => l.productId === productId ? { ...l, qty: newQty } : l));
  }

  function removeFromCart(productId) {
    setCart(cart.filter((l) => l.productId !== productId));
  }

  const rawTotal = qsCart.reduce((a, l) => a + l.price * l.qty, 0);
  const cartQty = bulkDiscountQty(qsCart);
  const qtyDiscount = bulkQtyDiscount(cartQty);
  const total = Math.max(0, cashFriendlyTotal(rawTotal, cartQty) - Math.max(0, parseFloat(discount) || 0));
  const restockCount = rsCart.reduce((a, l) => a + l.qty, 0);

  function checkout() {
    if (!qsCart.length) { setErrorMsg('Add at least one item first.'); return; }
    const sale = {
      id: uid('sale'), date: new Date().toISOString(), items: qsCart.slice(),
      total, status: 'Completed', paymentMethod
    };
    mutate((d) => {
      sale.items.forEach((it) => {
        const p = d.products.find((x) => x.id === it.productId);
        if (p) {
          p.stock = Math.max(0, p.stock - it.qty);
          logStock(d, p.id, p.name, -it.qty, p.stock);
        }
      });
      d.sales.unshift(sale);
    });
    setQsCart([]); setDiscount(0); setPaymentMethod('Cash'); setPaymentMenuOpen(false);
    setErrorMsg(''); setSuccessMsg('Sale recorded!');
  }

  function recordRestock() {
    if (!rsCart.length) { setErrorMsg('Add at least one item first.'); return; }
    mutate((d) => {
      rsCart.forEach((l) => {
        const p = d.products.find((x) => x.id === l.productId);
        if (p) {
          p.stock += l.qty;
          logStock(d, p.id, p.name, l.qty, p.stock);
        }
      });
    });
    setRsCart([]); setErrorMsg(''); setSuccessMsg('Stock updated!');
  }

  return (
    <div className="pos-shell">
      <div className="pos-topbar">
        <div>
          <h2>On-site sales</h2>
          <p className="pos-subtitle">Tap items to add to the cart; checking out records sales; switch to restock mode to log incoming stock.</p>
        </div>
        <span className="pos-mode-pill">{mode === 'sell' ? 'Sale mode' : 'Restock mode'}</span>
      </div>

      <div className="pos-toolbar">
        <div className="pos-toggle">
          <button type="button" className={mode === 'sell' ? 'active' : ''} onClick={() => { setMode('sell'); setErrorMsg(''); setSuccessMsg(''); }}>🛒 Sell</button>
          <button type="button" className={mode === 'restock' ? 'active' : ''} onClick={() => { setMode('restock'); setErrorMsg(''); setSuccessMsg(''); }}>📦 Restock</button>
        </div>
        <div className="pos-search-wrap">
          <span className="si">🔍</span>
          <input placeholder="Search by product name or category" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="chips">
        <button type="button" className={'chip ' + (category === 'All' ? 'active' : '')} onClick={() => setCategory('All')}>All items</button>
        {cats.map((c) => (
          <button key={c} type="button" className={'chip ' + (category === c ? 'active' : '')} onClick={() => setCategory(c)}>{c}</button>
        ))}
      </div>

      <div className="pos-body">
        <div>
          <div className="pos-count">{filtered.length} items</div>
          <div className="pos-grid">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                className="pos-card"
                style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 10, background: '#fff', textAlign: 'left' }}
                onClick={() => addToCart(p)}
              >
                <div style={{ height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, background: 'var(--accent-softer)', borderRadius: 8, marginBottom: 6, overflow: 'hidden' }}>
                  {p.image ? <img src={p.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (p.emoji || '🩷')}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>{p.name}</div>
                <div className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>{money(p.price, cur)} · {p.stock} left</div>
              </button>
            ))}
          </div>
        </div>

        <div className="pos-cart">
          <h3>{mode === 'sell' ? 'Selected items' : 'Restock list'}</h3>
          {cart.length === 0 ? (
            <div className="empty-box">Nothing added yet.</div>
          ) : cart.map((l) => (
            <div className="pos-cart-item" key={l.productId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</div>
                {mode === 'sell' && <div className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>{money(l.price, cur)}</div>}
              </div>
              <div className="pos-cart-item-qty">
                <button className="pos-qty-btn" onClick={() => qtyChange(l.productId, -1)}>−</button>
                <span className="pos-qty-val">{l.qty}</span>
                <button className="pos-qty-btn" onClick={() => qtyChange(l.productId, 1)}>+</button>
                <button className="pos-cart-remove" onClick={() => removeFromCart(l.productId)}>✕</button>
              </div>
            </div>
          ))}

          {mode === 'sell' ? (
            <div className="pos-summary">
              <div className="pos-summary-row"><span>Subtotal</span><span>{money(rawTotal, cur)}</span></div>
              {qtyDiscount > 0 && <div className="pos-summary-row"><span>Bulk discount (every 3 Pins)</span><span>-{money(qtyDiscount, cur)}</span></div>}
              <div className="pos-summary-row">
                <span>Order discount</span>
                <input className="pos-discount-input" type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </div>
              <div className="pos-summary-row total"><span>Amount due</span><span>{money(total, cur)}</span></div>
              <div className="pos-summary-row pos-payment-row">
                <span>Mode of payment</span>
                <div className="pos-payment-dropdown">
                  <button type="button" className="pos-payment-btn" onClick={() => setPaymentMenuOpen((v) => !v)}>
                    {paymentMethod} <span className="pos-payment-caret">▾</span>
                  </button>
                  {paymentMenuOpen && (
                    <div className="pos-payment-menu">
                      {['Cash', 'GCash', 'GoTyme', 'Maya'].map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={'pos-payment-menu-item ' + (paymentMethod === m ? 'active' : '')}
                          onClick={() => { setPaymentMethod(m); setPaymentMenuOpen(false); }}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {errorMsg && <div className="form-error">{errorMsg}</div>}
              {successMsg && <div className="form-success">{successMsg}</div>}
              <button type="button" className="btn btn-primary btn-block" disabled={!cart.length} onClick={checkout}>🛒 Checkout</button>
            </div>
          ) : (
            <div className="pos-summary">
              <div className="pos-restock-count-row"><span>Restock count</span><span className="v">{restockCount} pcs</span></div>
              {errorMsg && <div className="form-error">{errorMsg}</div>}
              {successMsg && <div className="form-success">{successMsg}</div>}
              <button type="button" className="btn btn-primary btn-block" disabled={!cart.length} onClick={recordRestock}>📦 Record restock</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
