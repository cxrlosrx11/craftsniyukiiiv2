import React, { useEffect, useMemo, useState } from 'react';
import { sb } from '../lib/supabaseClient';
import { useShop } from '../lib/ShopContext.jsx';
import { navigate } from '../lib/router.js';
import { money } from '../lib/utils.js';
import { CATEGORY_EMOJI } from '../lib/constants.js';
import Modal from './Modal.jsx';

export default function Storefront({ slug }) {
  const { shop } = useShop();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [seller, setSeller] = useState('All');
  const [open, setOpen] = useState(null);

  async function load() {
    setStatus('loading');
    const res = await sb.rpc('public_storefront', { shop_slug: slug || null });
    if (res.error) { console.error(res.error); setStatus('error'); return; }
    setItems(res.data || []);
    setStatus('ready');
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [slug]);

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

  const heading = slug && items[0] ? items[0].shopName : 'Crafts ni Yukiii';

  return (
    <div className="store">
      <header className="store-nav">
        <a className="store-brand" href="#/">
          <span className="brand-logo">CY</span>
          <span className="brand-text">Crafts ni Yukiii</span>
        </a>
        <div className="store-nav-actions">
          {shop ? (
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/dashboard')}>Dashboard</button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/login')}>Sign in</button>
          )}
        </div>
      </header>

      <section className="store-hero">
        <h1>{slug ? heading : 'Shop handmade crafts 🌸'}</h1>
        <p>{slug ? 'Browse what is in stock right now.' : 'Pins, prints, charms and more — fresh from our small-shop sellers.'}</p>
        {slug && <a className="link-btn" href="#/">← All shops</a>}
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
            <button key={p.shopSlug + p.id} className="store-card" onClick={() => setOpen(p)}>
              <div className="store-media">
                {p.image ? <img src={p.image} alt={p.name} loading="lazy" /> : <span>{p.emoji || CATEGORY_EMOJI[p.category] || '🩷'}</span>}
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
            {open.image ? <img src={open.image} alt={open.name} /> : <span>{open.emoji || CATEGORY_EMOJI[open.category] || '🩷'}</span>}
          </div>
          <div className="store-price mono" style={{ fontSize: 22, margin: '12px 0 4px' }}>{money(open.price, open.currency)}</div>
          <p className="hint" style={{ margin: 0 }}>
            {[open.category, open.ip].filter(Boolean).join(' · ')}<br />
            Sold by <a href={`#/shop/${encodeURIComponent(open.shopSlug)}`} onClick={() => setOpen(null)}><b>{open.shopName}</b></a>
            {' · '}{open.stock} in stock
          </p>
        </Modal>
      )}

      <footer className="store-footer">
        © Crafts ni Yukiii · {shop ? 'Signed in' : <button className="link-btn" onClick={() => navigate('/login')}>Seller sign in</button>}
      </footer>
    </div>
  );
}
