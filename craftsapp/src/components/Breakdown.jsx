import React, { useMemo } from 'react';
import { useShop } from '../lib/ShopContext.jsx';
import { money, toPHP, fromPHP } from '../lib/utils.js';

export default function Breakdown() {
  const { shop, data } = useShop();
  const cur = shop.currency || 'PHP';

  const byCategory = useMemo(() => {
    const map = {};
    data.sales.forEach((s) => {
      s.items.forEach((it) => {
        const p = data.products.find((x) => x.id === it.productId);
        const cat = (p && p.category) || it.category || 'Other';
        if (!map[cat]) map[cat] = { revenue: 0, units: 0 };
        map[cat].revenue += toPHP(it.price * it.qty, cur);
        map[cat].units += it.qty;
      });
    });
    return Object.entries(map).sort((a, b) => b[1].revenue - a[1].revenue);
  }, [data.sales, data.products, cur]);

  const byCostType = useMemo(() => {
    const map = {};
    data.costs.forEach((c) => {
      const amt = typeof c.amountPHP === 'number' ? c.amountPHP : toPHP(c.amount, c.currency || 'PHP');
      map[c.type] = (map[c.type] || 0) + amt;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [data.costs]);

  const maxCatRevenue = Math.max(1, ...byCategory.map(([, v]) => v.revenue));
  const maxCost = Math.max(1, ...byCostType.map(([, v]) => v));

  return (
    <div>
      <div className="page-head">
        <div><h1>Breakdown</h1><p>Revenue by category and expenses by type.</p></div>
      </div>

      <div className="panel">
        <div className="panel-head"><div className="panel-title">Revenue by category</div></div>
        {byCategory.length === 0 ? <div className="empty-box">No sales yet.</div> : byCategory.map(([cat, v]) => (
          <div key={cat} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span style={{ fontWeight: 700 }}>{cat}</span>
              <span className="mono">{money(fromPHP(v.revenue, cur), cur)} · {v.units} units</span>
            </div>
            <div style={{ height: 8, borderRadius: 6, background: 'var(--accent-softer)' }}>
              <div style={{ height: '100%', borderRadius: 6, width: `${(v.revenue / maxCatRevenue) * 100}%`, background: 'var(--accent)' }} />
            </div>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel-head"><div className="panel-title">Expenses by type</div></div>
        {byCostType.length === 0 ? <div className="empty-box">No expenses logged yet.</div> : byCostType.map(([type, v]) => (
          <div key={type} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span style={{ fontWeight: 700 }}>{type}</span>
              <span className="mono">{money(fromPHP(v, cur), cur)}</span>
            </div>
            <div style={{ height: 8, borderRadius: 6, background: 'var(--accent-softer)' }}>
              <div style={{ height: '100%', borderRadius: 6, width: `${(v / maxCost) * 100}%`, background: '#e08a9d' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
