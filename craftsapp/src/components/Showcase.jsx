import React, { useState } from 'react';
import { useShop } from '../lib/ShopContext.jsx';
import { money } from '../lib/utils.js';

export default function Showcase() {
  const { shop, data } = useShop();
  const cur = shop.currency || 'PHP';
  const [copied, setCopied] = useState(false);

  const slug = shop.showcaseSlug || shop.username;
  const link = `${window.location.origin}/shop/${slug}`;
  const liveProducts = data.products.filter((p) => !p.archived && p.stock > 0);

  function copyLink() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div>
      <div className="page-head">
        <div><h1>Showcase</h1><p>Share a public preview of your in-stock items.</p></div>
      </div>

      <div className="panel">
        <div className="panel-head"><div className="panel-title">Your showcase link</div></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input readOnly value={link} style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={copyLink}>{copied ? 'Copied!' : 'Copy'}</button>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>Only in-stock, non-archived items are shown to visitors.</p>
      </div>

      <div className="panel">
        <div className="panel-head"><div className="panel-title">Preview ({liveProducts.length} items)</div></div>
        {liveProducts.length === 0 ? (
          <div className="empty-box">Nothing in stock to show yet.</div>
        ) : (
          <div className="thumb-row">
            {liveProducts.map((p) => (
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
  );
}
