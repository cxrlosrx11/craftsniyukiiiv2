import React, { useMemo, useState } from 'react';
import { useShop } from '../lib/ShopContext.jsx';
import { money, fmtDateTime, toPHP, fromPHP } from '../lib/utils.js';
import { CURRENCIES } from '../lib/constants.js';

export default function Overview({ goTo }) {
  const { shop, data, updateShopProfile } = useShop();
  const [ovIp, setOvIp] = useState('All');
  const cur = shop.currency || 'PHP';

  const stats = useMemo(() => {
    const revenuePHP = data.sales.reduce((a, s) => a + toPHP(s.total, cur), 0);
    const costPHP = data.costs.reduce((a, e) => a + (typeof e.amountPHP === 'number' ? e.amountPHP : toPHP(e.amount, e.currency || 'PHP')), 0);
    const cogsPHP = data.sales.reduce((a, s) => a + s.items.reduce((b, it) => b + (it.cost || 0) * it.qty, 0), 0) * (cur === 'PHP' ? 1 : 1);
    const profitPHP = revenuePHP - costPHP - cogsPHP;
    const lowStock = data.products.filter((p) => !p.archived && p.stock > 0 && p.stock <= p.lowStockAt).length;
    const outOfStock = data.products.filter((p) => !p.archived && p.stock <= 0).length;
    return { revenuePHP, costPHP, cogsPHP, profitPHP, lowStock, outOfStock };
  }, [data, cur]);

  const recentSales = data.sales.slice(0, 5);

  const ips = ['All', ...Array.from(new Set(data.products.map((p) => p.ip).filter(Boolean)))];
  const products = ovIp === 'All' ? data.products : data.products.filter((p) => p.ip === ovIp);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Welcome back, {shop.shopName}</h1>
          <p>Here's how your shop is doing.</p>
        </div>
        <div className="currency-box">
          <label>Currency</label>
          <select value={cur} onChange={(e) => updateShopProfile({ currency: e.target.value })}>
            {Object.keys(CURRENCIES).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="ov-grid">
        <div className="ov-main">
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">Total revenue</div>
              <div className="stat-value">{money(fromPHP(stats.revenuePHP, cur), cur)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Net profit</div>
              <div className="stat-value">{money(fromPHP(stats.profitPHP, cur), cur)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Low stock items</div>
              <div className="stat-value">{stats.lowStock}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Out of stock</div>
              <div className="stat-value">{stats.outOfStock}</div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">Quick actions</div>
            </div>
            <div className="quick-actions">
              <button className="quick-btn sale" onClick={() => goTo('pos')}>
                <span className="qi">🛒</span> Record a sale
              </button>
              <button className="quick-btn restock" onClick={() => goTo('pos')}>
                <span className="qi">📦</span> Restock items
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">Products</div>
              <div className="filter-select-box">
                <label>IP</label>
                <select value={ovIp} onChange={(e) => setOvIp(e.target.value)}>
                  {ips.map((ip) => <option key={ip} value={ip}>{ip}</option>)}
                </select>
              </div>
            </div>
            {products.length === 0 ? (
              <div className="empty-box">No products yet. Add some from the Products tab.</div>
            ) : (
              <div className="thumb-row">
                {products.slice(0, 12).map((p) => (
                  <div className="thumb-card" key={p.id}>
                    <div className="thumb-media">
                      {p.image ? <img src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (p.emoji || '🩷')}
                    </div>
                    <div className="thumb-body">
                      <div className="thumb-name">{p.name}</div>
                      <div className="thumb-price mono">{money(p.price, cur)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="ov-side">
          <div className="side-panel">
            <div className="side-panel-head">
              <h3>🧾 Recent sales</h3>
              <button className="view-all" onClick={() => goTo('reports')}>View all</button>
            </div>
            {recentSales.length === 0 ? (
              <div className="empty-box">No sales recorded yet.</div>
            ) : recentSales.map((s) => (
              <div className="order-row" key={s.id}>
                <div>
                  <div className="order-name">
                    <span className="order-status-dot completed" />
                    {s.items.map((it) => it.name).join(', ').slice(0, 30)}
                  </div>
                  <div className="order-meta">{fmtDateTime(s.date)}</div>
                </div>
                <div className="order-amount">{money(s.total, cur)}</div>
              </div>
            ))}
          </div>

          <div className="side-panel prep-panel">
            <div className="side-panel-head"><h3>🎪 Next convention</h3></div>
            {data.conventions.length === 0 ? (
              <p>No upcoming conventions logged yet. Add one from the Conventions tab to start tracking prep.</p>
            ) : (
              <div>
                {data.conventions.slice(0, 1).map((c) => (
                  <div key={c.id}>
                    <div className="order-name">{c.name}</div>
                    <div className="order-meta">{c.date} · {c.location}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
