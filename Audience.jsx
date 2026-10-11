import React, { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { useShop } from '../lib/ShopContext.jsx';
import { fetchProfile } from '../lib/social.js';

// Seller dashboard: how many people follow the shop and which products are loved.
// Sellers only ever see counts, never who followed or liked.
export default function Audience() {
  const { shop, data } = useShop();
  const slug = shop.showcaseSlug || shop.username;
  const [p, setP] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchProfile(slug).then((r) => { if (alive) setP(r); }).catch((e) => { console.error(e); if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [slug]);

  if (failed) return null; // SQL not installed yet; stay quiet rather than show an error on the overview
  if (!p) return null;

  const top = Object.entries(p.likeCounts || {})
    .map(([id, count]) => ({ id, count, product: (data.products || []).find((x) => x.id === id) }))
    .filter((r) => r.product)
    .sort((a, b) => b.count - a.count).slice(0, 3);

  return (
    <div className="panel">
      <div className="panel-head"><div className="panel-title"><Icon name="heart" size={17} /> Your audience</div></div>
      <div className="profile-stats" style={{ margin: '0 0 10px' }}>
        <span><b>{p.followers}</b> {p.followers === 1 ? 'follower' : 'followers'}</span>
        <span><b>{p.totalLikes}</b> {p.totalLikes === 1 ? 'like' : 'likes'} on your products</span>
      </div>
      {top.length === 0 ? (
        <p className="hint small" style={{ margin: 0 }}>No product likes yet. Share your shop link so buyers can follow you and heart their favorites.</p>
      ) : top.map((r) => (
        <div className="ins-row" key={r.id}>
          <div className="order-name">{r.product.name}</div>
          <span className="mono">♥ {r.count}</span>
        </div>
      ))}
    </div>
  );
}
