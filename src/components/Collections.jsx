import React, { useEffect, useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import Modal from './Modal.jsx';
import { useShop } from '../lib/ShopContext.jsx';
import { listCollections, saveCollection, setPublished, deleteCollection, collectionStats } from '../lib/collections.js';

const blank = () => ({ id: null, title: '', description: '', perk: '', productIds: [], isPublished: true });

export default function Collections() {
  const { data } = useShop();
  const [cols, setCols] = useState([]);
  const [stats, setStats] = useState({});
  const [state, setState] = useState('loading');
  const [form, setForm] = useState(null);
  const [search, setSearch] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const { shop } = useShop();

  const products = useMemo(() => (data.products || []).filter((p) => !p.archived), [data.products]);
  const byId = useMemo(() => Object.fromEntries((data.products || []).map((p) => [p.id, p])), [data.products]);

  async function load() {
    try {
      const [c, s] = await Promise.all([listCollections(shop.id), collectionStats()]);
      setCols(c); setStats(Object.fromEntries(s.map((x) => [x.id, x]))); setState('ready');
    } catch (e) { console.error(e); setState('error'); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  function openForm(c) {
    setErr(''); setSearch('');
    setForm(c ? { id: c.id, title: c.title, description: c.description, perk: c.perk, productIds: [...c.product_ids], isPublished: c.is_published } : blank());
  }
  const setF = (patch) => setForm((f) => ({ ...f, ...patch }));
  const toggleProduct = (id) => setF({ productIds: form.productIds.includes(id) ? form.productIds.filter((x) => x !== id) : form.productIds.length < 24 ? [...form.productIds, id] : form.productIds });

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await saveCollection(shop.id, form); setForm(null); await load(); }
    catch (ex) { setErr(ex.message || "Couldn't save."); }
    setBusy(false);
  }
  async function remove(c) {
    if (!confirm(`Delete the set "${c.title}"? Buyers' progress on it is removed too.`)) return;
    try { await deleteCollection(c.id); await load(); } catch (ex) { setErr(ex.message || "Couldn't delete."); }
  }
  async function toggle(c) {
    try { await setPublished(c.id, !c.is_published); await load(); } catch (ex) { setErr(ex.message || "Couldn't update."); }
  }

  if (state === 'loading') return <div className="empty-box">Loading…</div>;
  if (state === 'error') return <div className="empty-box">Couldn't load sets. Did you run <code>supabase-collections.sql</code> in Supabase? <button className="link-btn" onClick={load}>Try again</button></div>;

  const shownProducts = products.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="page-head">
        <div><h1>Collections</h1><p>Group your series (pins, charms, stickers) into a set. Buyers get a checklist to collect them all, and you see which pieces collectors are still missing.</p></div>
        <button className="btn btn-primary" onClick={() => openForm(null)}>+ New set</button>
      </div>
      {err && !form && <div className="form-error">{err}</div>}
      {cols.length === 0 && <div className="empty-box">No sets yet. Create one like "Sky Pins Series 1" with 4–8 pieces, and add a little reward for completing it.</div>}

      {cols.map((c) => {
        const st = stats[c.id] || { collectors: 0, completers: 0, pieces: {} };
        const rows = c.product_ids.map((id) => ({ id, product: byId[id], owned: st.pieces[id] || 0 }))
          .map((r) => ({ ...r, missing: Math.max(0, st.collectors - r.owned) }));
        const worst = [...rows].sort((a, b) => b.missing - a.missing)[0];
        return (
          <div className="panel" key={c.id}>
            <div className="panel-head">
              <div>
                <div className="panel-title">{c.title} <span className={'order-badge ' + (c.is_published ? 'confirmed' : 'declined')}>{c.is_published ? 'Public' : 'Hidden'}</span></div>
                <div className="order-meta">{c.product_ids.length} pieces · {st.collectors} collector{st.collectors === 1 ? '' : 's'} · {st.completers} completed it</div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => toggle(c)}>{c.is_published ? 'Hide' : 'Publish'}</button>
                <button className="icon-btn" title="Edit" onClick={() => openForm(c)}><Icon name="edit" size={15} /></button>
                <button className="icon-btn" title="Delete" onClick={() => remove(c)}><Icon name="trash" size={15} /></button>
              </div>
            </div>
            {st.collectors > 0 && worst && worst.missing > 0 && (
              <p className="hint" style={{ marginTop: 0 }}>
                Most collectors are still missing <b>{worst.product ? worst.product.name : 'a retired piece'}</b> ({worst.missing} of {st.collectors}).
                {worst.product && worst.product.stock <= 0 ? ' It is sold out. A restock would help them finish the set.' : ''}
              </p>
            )}
            {rows.map((r) => (
              <div className="ins-row" key={r.id}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="order-name">{r.product ? r.product.name : 'Retired piece'}{r.product && r.product.stock <= 0 ? <span className="order-meta"> · sold out</span> : ''}</div>
                  {st.collectors > 0 && <div className="goal-track" style={{ margin: '4px 0 0' }}><div className="goal-fill" style={{ width: Math.round((r.owned / st.collectors) * 100) + '%' }} /></div>}
                </div>
                <div className="ins-side order-meta">{st.collectors > 0 ? `${r.owned} of ${st.collectors} own it` : ''}</div>
              </div>
            ))}
            {st.collectors === 0 && <p className="hint small" style={{ marginBottom: 0 }}>No collectors yet. Buyers appear here once they buy a piece or tick one off. You only ever see counts, never who.</p>}
          </div>
        );
      })}

      {form && (
        <Modal title={form.id ? 'Edit set' : 'New set'} onClose={() => setForm(null)}>
          <form onSubmit={submit}>
            <div className="form-field"><label>Set name</label><input required maxLength={60} value={form.title} onChange={(e) => setF({ title: e.target.value })} placeholder="e.g. Sky Pins Series 1" /></div>
            <div className="form-field"><label>Description (optional)</label><input maxLength={200} value={form.description} onChange={(e) => setF({ description: e.target.value })} placeholder="e.g. Collect all 5 sky-themed pins" /></div>
            <div className="form-field"><label>Reward for completing it (optional)</label><input maxLength={120} value={form.perk} onChange={(e) => setF({ perk: e.target.value })} placeholder="e.g. Show this at my booth for a free sticker" /></div>
            <label style={{ fontWeight: 700, fontSize: 13 }}>Pieces in this set ({form.productIds.length} of 24, at least 2)</label>
            <input style={{ margin: '6px 0 8px' }} placeholder="Search your products…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 12, padding: '4px 10px' }}>
              {shownProducts.length === 0 && <div className="empty-box">No products match.</div>}
              {shownProducts.map((p) => (
                <label key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', fontSize: 14 }}>
                  <input type="checkbox" checked={form.productIds.includes(p.id)} onChange={() => toggleProduct(p.id)} />
                  <span style={{ flex: 1 }}>{p.name}</span>
                  <span className="order-meta">{p.stock} in stock</span>
                </label>
              ))}
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0', fontWeight: 600 }}>
              <input type="checkbox" checked={form.isPublished} onChange={(e) => setF({ isPublished: e.target.checked })} /> Show this set on my public page
            </label>
            {err && <div className="form-error">{err}</div>}
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? 'Saving…' : form.id ? 'Save changes' : 'Create set'}</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
