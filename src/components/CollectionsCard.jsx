import React, { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { useShop } from '../lib/ShopContext.jsx';
import { navigate } from '../lib/router.js';
import { money } from '../lib/utils.js';
import { fetchPublicCollections, toggleOwned, syncOwned, detectOwnedFromPurchases } from '../lib/collections.js';

const RETURN_KEY = 'cy_return_to';

// "Collect the set" on a seller's public page.
export default function CollectionsCard({ slug, items, isSeller, onAddPieces }) {
  const { buyer, setAuthRole, setAuthView } = useShop();
  const [cols, setCols] = useState(null);
  const [msg, setMsg] = useState('');
  const synced = useRef(false);
  const buyerId = buyer ? buyer.id : null;

  const load = useCallback(() => fetchPublicCollections(slug).then(setCols).catch((e) => console.error(e)), [slug]);
  useEffect(() => { synced.current = false; setCols(null); setMsg(''); load(); }, [slug, buyerId, load]);

  // Pieces found in the buyer's own orders are ticked automatically (once per visit).
  useEffect(() => {
    if (!buyerId || !cols || synced.current) return;
    synced.current = true;
    (async () => {
      try {
        const found = await detectOwnedFromPurchases();
        const inSets = new Set(cols.flatMap((c) => c.pieces.map((p) => p.id)));
        const have = new Set(cols.flatMap((c) => c.owned.filter((o) => o.source === 'auto').map((o) => o.id)));
        const fresh = Array.from(found).filter((id) => inSets.has(id) && !have.has(id));
        if (fresh.length) { await syncOwned(slug, fresh); await load(); }
      } catch (e) { console.error(e); }
    })();
  }, [buyerId, cols, slug, load]);

  function goLogin() {
    try { localStorage.setItem(RETURN_KEY, '/shop/' + encodeURIComponent(slug)); } catch (e) { /* ignore */ }
    setAuthRole('buyer'); setAuthView('login'); navigate('/login');
  }

  async function tick(pid) {
    try { await toggleOwned(slug, pid); await load(); } catch (e) { alert(e.message || 'Could not update.'); }
  }

  if (!cols || cols.length === 0) return null;
  return (
    <div style={{ marginBottom: 18 }}>
      {cols.map((c) => {
        const ownedMap = Object.fromEntries(c.owned.map((o) => [o.id, o.source]));
        const have = c.pieces.filter((p) => ownedMap[p.id]).length;
        const total = c.pieces.length;
        const complete = have === total && total > 0;
        const missing = c.pieces.filter((p) => !ownedMap[p.id]);
        const buyable = missing.map((p) => items.find((i) => i.id === p.id && i.stock > 0)).filter(Boolean);
        const cur = (items[0] && items[0].currency) || 'PHP';
        const cost = buyable.reduce((a, p) => a + p.price, 0);
        return (
          <div className="panel" key={c.id}>
            <div className="panel-head">
              <div>
                <div className="panel-title"><Icon name="album" size={17} /> {c.title}</div>
                {c.description && <div className="hint small">{c.description}</div>}
              </div>
              <span className="order-meta">{c.collectors} collector{c.collectors === 1 ? '' : 's'} · {c.completers} completed</span>
            </div>
            {buyer && (
              <>
                <div className="order-name">{have} of {total} collected</div>
                <div className="goal-track"><div className="goal-fill" style={{ width: Math.round((have / total) * 100) + '%' }} /></div>
              </>
            )}
            {complete && (
              <div className="support-banner" style={{ margin: '10px 0' }}>
                <Icon name="sparkles" size={16} /> Set complete! {c.perk ? c.perk : 'You collected them all.'}
              </div>
            )}
            {!buyer && !isSeller && (
              <p className="hint small" style={{ margin: '4px 0 8px' }}>Log in to track which pieces you own. <button className="link-btn" onClick={goLogin}>Log in</button></p>
            )}
            {!complete && c.perk && <p className="hint small" style={{ margin: '4px 0 8px' }}>Reward for completing it: {c.perk}</p>}
            {c.pieces.map((p) => {
              const src = ownedMap[p.id];
              return (
                <div className="ins-row" key={p.id}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                    <span style={{ color: src ? 'var(--accent)' : 'var(--muted)', display: 'inline-flex' }}>
                      {src ? <Icon name="success" size={20} /> : <span style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--border)', display: 'inline-block' }} />}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="order-name">{p.name}</div>
                      <div className="order-meta">{p.price != null ? money(p.price, cur) : ''}{!p.inStock ? ' · sold out' : ''}{src === 'auto' ? ' · from your orders' : ''}</div>
                    </div>
                  </div>
                  <div className="ins-side">
                    {buyer && src !== 'auto' && (
                      <button className="link-btn" onClick={() => tick(p.id)}>{src ? 'Undo' : 'I have this'}</button>
                    )}
                  </div>
                </div>
              );
            })}
            {buyer && !complete && (
              <div style={{ marginTop: 10 }}>
                <button className="btn btn-primary btn-sm" disabled={buyable.length === 0}
                  onClick={() => { onAddPieces(buyable); setMsg(`Added ${buyable.length} piece${buyable.length === 1 ? '' : 's'} to your cart.`); }}>
                  {buyable.length ? `Add ${buyable.length} missing piece${buyable.length === 1 ? '' : 's'} to cart · ${money(cost, cur)}` : 'Missing pieces are sold out'}
                </button>
                {msg && <span className="hint small" style={{ marginLeft: 10 }}>{msg}</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
