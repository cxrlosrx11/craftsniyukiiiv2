import React, { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { money } from '../lib/utils.js';
import { similarProducts } from '../lib/ml.js';

// "You may also like" — ranks other in-stock products by category, fandom/IP,
// price level and seller. Uses TensorFlow.js (loaded on demand).
export default function SimilarProducts({ target, items, onPick }) {
  const [picks, setPicks] = useState([]);
  useEffect(() => {
    let alive = true;
    setPicks([]);
    similarProducts(target, items, 4)
      .then((r) => { if (alive) setPicks(r); })
      .catch((e) => console.error(e));
    return () => { alive = false; };
  }, [target, items]);

  if (!picks.length) return null;
  return (
    <div style={{ marginTop: 18 }}>
      <div className="side-section" style={{ marginBottom: 8 }}>You may also like</div>
      <div className="thumb-row">
        {picks.map((p) => (
          <button type="button" className="thumb-card" key={p.shopSlug + p.id} onClick={() => onPick(p)} style={{ textAlign: 'left' }}>
            <div className="thumb-media">
              {p.image ? <img src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="image" size={22} />}
            </div>
            <div className="thumb-body">
              <div className="thumb-name">{p.name}</div>
              <div className="thumb-price mono">{money(p.price, p.currency)}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
