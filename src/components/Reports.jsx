import React, { useMemo, useState } from 'react';
import { useShop } from '../lib/ShopContext.jsx';
import { money, fmtDateTime, toPHP, fromPHP } from '../lib/utils.js';

export default function Reports() {
  const { shop, data, mutate } = useShop();
  const cur = shop.currency || 'PHP';
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.sales;
    return data.sales.filter((s) =>
      s.items.some((it) => it.name.toLowerCase().includes(q)) ||
      (s.paymentMethod || '').toLowerCase().includes(q)
    );
  }, [data.sales, search]);

  const totals = useMemo(() => {
    const revenuePHP = data.sales.reduce((a, s) => a + toPHP(s.total, cur), 0);
    const unitsSold = data.sales.reduce((a, s) => a + s.items.reduce((b, it) => b + it.qty, 0), 0);
    return { revenuePHP, unitsSold, count: data.sales.length };
  }, [data.sales, cur]);

  function undoSale(id) {
    const sale = data.sales.find((s) => s.id === id);
    if (!sale) return;
    if (!confirm('Undo this sale? Stock will be restored and it will be removed from your records.')) return;
    mutate((d) => {
      sale.items.forEach((it) => {
        const p = d.products.find((x) => x.id === it.productId);
        if (p) p.stock += it.qty;
      });
      d.sales = d.sales.filter((s) => s.id !== id);
    });
  }

  return (
    <div>
      <div className="page-head">
        <div><h1>Reports</h1><p>{totals.count} sales · {totals.unitsSold} units · {money(fromPHP(totals.revenuePHP, cur), cur)} total revenue</p></div>
      </div>

      <div className="list-toolbar">
        <input className="list-search" placeholder="Search by product or payment method…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="empty-box">No sales recorded yet.</div>
      ) : filtered.map((s) => (
        <div className="plist-item" key={s.id}>
          <div className="plist-top">
            <div className="plist-title-meta">
              <span className="plist-name">{s.items.map((it) => `${it.name} ×${it.qty}`).join(', ')}</span>
              <div className="plist-tags">
                <span className="plist-cat">{fmtDateTime(s.date)}</span>
                {s.paymentMethod && <span className="plist-ip">{s.paymentMethod}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="mono" style={{ fontWeight: 700 }}>{money(s.total, cur)}</span>
              <button className="icon-btn" title="Undo sale" onClick={() => undoSale(s.id)}>↩</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
