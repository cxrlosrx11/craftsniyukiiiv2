import React, { useMemo, useState } from 'react';
import { useShop } from '../lib/ShopContext.jsx';
import Modal from './Modal.jsx';
import { money, uid, resizeImageFile } from '../lib/utils.js';
import { CATEGORIES } from '../lib/constants.js';

function logStock(data, productId, name, delta, resultingStock) {
  data.stockLog.unshift({ id: uid('log'), productId, name, delta, resultingStock, date: new Date().toISOString() });
}

export default function Products() {
  const { shop, data, mutate } = useShop();
  const cur = shop.currency || 'PHP';

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [ip, setIp] = useState('All');
  const [stockFilter, setStockFilter] = useState('All');
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState([]);
  const [modal, setModal] = useState(null); // {type:'product'|'batch'|'bundle', editId?}
  const [errorMsg, setErrorMsg] = useState('');

  const allCategories = useMemo(
    () => Array.from(new Set([...CATEGORIES, ...(data.customCategories || [])])),
    [data.customCategories]
  );
  const allIps = useMemo(
    () => Array.from(new Set(data.products.map((p) => p.ip).filter(Boolean))),
    [data.products]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.products.filter((p) => {
      const matchesQ = !q || p.name.toLowerCase().includes(q) || (p.notes || '').toLowerCase().includes(q);
      const matchesCat = category === 'All' || p.category === category;
      const matchesIp = ip === 'All' || p.ip === ip;
      const matchesStock = stockFilter === 'All' ||
        (stockFilter === 'out' && p.stock <= 0) ||
        (stockFilter === 'low' && p.stock > 0 && p.stock <= p.lowStockAt) ||
        (stockFilter === 'instock' && p.stock > p.lowStockAt);
      const matchesArchived = showArchived || !p.archived;
      return matchesQ && matchesCat && matchesIp && matchesStock && matchesArchived;
    });
  }, [data.products, search, category, ip, stockFilter, showArchived]);

  function toggleSelect(id) {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }
  function selectAllOnPage() {
    setSelected((prev) => Array.from(new Set([...prev, ...filtered.map((p) => p.id)])));
  }
  function clearSelection() { setSelected([]); }

  function openAdd() { setModal({ type: 'product', editId: null }); setErrorMsg(''); }
  function openEdit(id) { setModal({ type: 'product', editId: id }); setErrorMsg(''); }

  function deleteProduct(id) {
    const p = data.products.find((x) => x.id === id);
    if (!p) return;
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    mutate((d) => {
      d.products = d.products.filter((x) => x.id !== id);
    });
    setSelected((prev) => prev.filter((x) => x !== id));
  }

  function toggleArchive(id) {
    mutate((d) => {
      const p = d.products.find((x) => x.id === id);
      if (p) p.archived = !p.archived;
    });
  }

  function submitProduct(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    let categoryVal = fd.get('category') || 'Other';
    let customCat = (fd.get('categoryOther') || '').trim();
    if (categoryVal === '__custom__') {
      if (!customCat) { setErrorMsg('Enter a name for the new category.'); return; }
      categoryVal = customCat;
    }
    let ipVal = (fd.get('ip') || '').trim();
    const price = parseFloat(fd.get('price'));
    const cost = parseFloat(fd.get('cost')) || 0;
    const stock = parseInt(fd.get('stock'), 10) || 0;
    let lowStockAt = parseInt(fd.get('lowStockAt'), 10);
    if (isNaN(lowStockAt)) lowStockAt = 0;
    const emoji = (fd.get('emoji') || '').trim();
    const name = (fd.get('name') || '').trim();
    const notes = (fd.get('notes') || '').trim();
    if (!name || isNaN(price) || price < 0) { setErrorMsg('Enter a valid name and price.'); return; }

    const editId = modal.editId;
    const newImage = modal.imageDraft; // null = no change

    mutate((d) => {
      if (categoryVal && !CATEGORIES.includes(categoryVal) && !d.customCategories.includes(categoryVal)) {
        d.customCategories.push(categoryVal);
      }
      if (editId) {
        const p = d.products.find((x) => x.id === editId);
        if (p) {
          const nextImage = newImage !== null && newImage !== undefined ? newImage : p.image;
          Object.assign(p, { name, category: categoryVal, ip: ipVal, price, cost, stock, lowStockAt, emoji, notes, image: nextImage });
        }
      } else {
        const newId = uid('prod');
        d.products.push({
          id: newId, name, category: categoryVal, ip: ipVal, price, cost, stock, lowStockAt,
          emoji, image: newImage || '', archived: false, notes
        });
        if (stock > 0) logStock(d, newId, name, stock, stock);
      }
    });
    setModal(null);
    setErrorMsg('');
  }

  async function onImagePick(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const dataUrl = await resizeImageFile(file, 640);
    setModal((m) => ({ ...m, imageDraft: dataUrl || '' }));
  }

  function submitBatchEdit(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const cat = fd.get('category');
    const ipVal = fd.get('ip');
    const priceMode = fd.get('priceMode');
    const priceValue = parseFloat(fd.get('priceValue'));
    mutate((d) => {
      selected.forEach((id) => {
        const p = d.products.find((x) => x.id === id);
        if (!p) return;
        if (cat && cat !== '__keep__') p.category = cat;
        if (ipVal && ipVal.trim() !== '__keep__') p.ip = ipVal.trim();
        if (priceMode && !isNaN(priceValue)) {
          if (priceMode === 'set') p.price = priceValue;
          else if (priceMode === 'increase') p.price = Math.round((p.price + p.price * (priceValue / 100)) * 100) / 100;
          else if (priceMode === 'decrease') p.price = Math.max(0, Math.round((p.price - p.price * (priceValue / 100)) * 100) / 100);
        }
      });
    });
    setModal(null); clearSelection();
  }

  function submitBundle(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = (fd.get('name') || '').trim();
    const catVal = fd.get('category') || 'Sets';
    const ipVal = (fd.get('ip') || '').trim();
    const price = parseFloat(fd.get('price'));
    if (!name) { setErrorMsg('Enter a bundle name.'); return; }
    if (isNaN(price) || price < 0) { setErrorMsg('Enter a valid bundle price.'); return; }
    mutate((d) => {
      const comps = selected.map((id) => d.products.find((x) => x.id === id)).filter(Boolean);
      const cost = comps.reduce((a, c) => a + c.cost, 0);
      const stock = comps.length ? Math.min(...comps.map((c) => c.stock)) : 0;
      const newId = uid('prod');
      d.products.push({
        id: newId, name, category: catVal, ip: ipVal, price, cost, stock,
        lowStockAt: 0, emoji: '📦', image: '', archived: false, notes: '', bundleOf: selected.slice()
      });
      if (stock > 0) logStock(d, newId, name, stock, stock);
    });
    setModal(null); clearSelection(); setErrorMsg('');
  }

  const editProduct = modal && modal.type === 'product' && modal.editId
    ? data.products.find((p) => p.id === modal.editId) : null;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Products</h1>
          <p>{data.products.length} total, {filtered.length} shown</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => setModal({ type: 'bundle' })} disabled={!selected.length}>
            📦 Bundle selected
          </button>
          <button className="btn btn-ghost" onClick={() => setModal({ type: 'batch' })} disabled={!selected.length}>
            ✎ Batch edit
          </button>
          <button className="btn btn-primary" onClick={openAdd}>+ Add product</button>
        </div>
      </div>

      <div className="list-toolbar">
        <input className="list-search" placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className={'list-chip ' + (showArchived ? 'active' : '')} onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? 'Hiding archived: off' : 'Show archived'}
        </button>
      </div>

      <div className="cat-filter-row">
        <span className="cat-filter-label">Category</span>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="All">All</option>
          {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="cat-filter-label">IP</span>
        <select value={ip} onChange={(e) => setIp(e.target.value)}>
          <option value="All">All</option>
          {allIps.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <span className="cat-filter-label">Stock</span>
        <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}>
          <option value="All">All</option>
          <option value="instock">In stock</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </select>
        {selected.length > 0 && (
          <button className="cat-filter-clear" onClick={clearSelection}>✕ Clear {selected.length} selected</button>
        )}
        {selected.length === 0 && filtered.length > 0 && (
          <button className="cat-filter-clear" onClick={selectAllOnPage}>Select all shown</button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-box">No products match these filters.</div>
      ) : filtered.map((p) => (
        <div className={'plist-item ' + (p.archived ? 'archived' : '')} key={p.id}>
          <div className="plist-top">
            <div className="plist-title">
              <div className="plist-checkwrap">
                <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggleSelect(p.id)} />
              </div>
              <div className="plist-title-meta">
                <span className="plist-name">{p.emoji || '🩷'} {p.name}</span>
                <div className="plist-tags">
                  <span className="plist-cat">{p.category}</span>
                  {p.ip && <span className="plist-ip">{p.ip}</span>}
                  {p.archived && <span className="plist-cat plist-badge archived-badge">Archived</span>}
                </div>
              </div>
            </div>
            <div className="plist-actions">
              <button className="icon-btn" title="Edit" onClick={() => openEdit(p.id)}>✎</button>
              <button className="icon-btn" title={p.archived ? 'Unarchive' : 'Archive'} onClick={() => toggleArchive(p.id)}>🗄</button>
              <button className="icon-btn" title="Delete" onClick={() => deleteProduct(p.id)}>🗑</button>
            </div>
          </div>
          <div className="plist-stats">
            <div className="plist-stat-box">
              <span className="plist-stat-icon">💲</span>
              <div><span className="plist-stat-label">Price</span><span className="plist-stat-value">{money(p.price, cur)}</span></div>
            </div>
            <div className="plist-stat-box">
              <span className="plist-stat-icon">📦</span>
              <div><span className="plist-stat-label">Cost</span><span className="plist-stat-value">{money(p.cost, cur)}</span></div>
            </div>
            <div className="plist-stat-box">
              <span className="plist-stat-icon">🗃</span>
              <div>
                <span className="plist-stat-label">Stock</span>
                <span className={'plist-stat-value ' + (p.stock <= 0 ? 'danger' : (p.stock <= p.lowStockAt ? 'warn' : ''))}>{p.stock}</span>
              </div>
            </div>
            <div className="plist-stat-box">
              <span className="plist-stat-icon">🔔</span>
              <div><span className="plist-stat-label">Low at</span><span className="plist-stat-value">{p.lowStockAt}</span></div>
            </div>
          </div>
        </div>
      ))}

      {modal && modal.type === 'product' && (
        <Modal title={modal.editId ? 'Edit product' : 'Add product'} onClose={() => setModal(null)}>
          <form onSubmit={submitProduct} data-form="product">
            <div className="form-field">
              <label>Name</label>
              <input name="name" defaultValue={editProduct ? editProduct.name : ''} required />
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>Category</label>
                <select name="category" defaultValue={editProduct ? editProduct.category : allCategories[0]}>
                  {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                  <option value="__custom__">+ New category…</option>
                </select>
              </div>
              <div className="form-field">
                <label>New category (if selected above)</label>
                <input name="categoryOther" />
              </div>
            </div>
            <div className="form-field">
              <label>IP / series (optional)</label>
              <input name="ip" defaultValue={editProduct ? editProduct.ip : ''} />
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>Price ({cur})</label>
                <input name="price" type="number" step="0.01" min="0" defaultValue={editProduct ? editProduct.price : ''} required />
              </div>
              <div className="form-field">
                <label>Production cost ({cur})</label>
                <input name="cost" type="number" step="0.01" min="0" defaultValue={editProduct ? editProduct.cost : ''} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>Stock</label>
                <input name="stock" type="number" min="0" defaultValue={editProduct ? editProduct.stock : 0} />
              </div>
              <div className="form-field">
                <label>Low-stock alert at</label>
                <input name="lowStockAt" type="number" min="0" defaultValue={editProduct ? editProduct.lowStockAt : 0} />
              </div>
            </div>
            <div className="form-field">
              <label>Emoji (shown if no photo)</label>
              <input name="emoji" defaultValue={editProduct ? editProduct.emoji : ''} placeholder="🩷" />
            </div>
            <div className="form-field">
              <label>Photo</label>
              <input type="file" accept="image/*" onChange={onImagePick} />
              {(modal.imageDraft || (editProduct && editProduct.image)) && (
                <img
                  src={modal.imageDraft || editProduct.image}
                  alt=""
                  style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 10, marginTop: 8 }}
                />
              )}
            </div>
            <div className="form-field">
              <label>Notes</label>
              <textarea name="notes" rows={2} defaultValue={editProduct ? editProduct.notes : ''} />
            </div>
            {errorMsg && <div className="form-error">{errorMsg}</div>}
            <button className="btn btn-primary btn-block" type="submit">
              {modal.editId ? 'Save changes' : 'Add product'}
            </button>
          </form>
        </Modal>
      )}

      {modal && modal.type === 'batch' && (
        <Modal title={`Batch edit ${selected.length} products`} onClose={() => setModal(null)}>
          <form onSubmit={submitBatchEdit}>
            <div className="form-field">
              <label>Category</label>
              <select name="category" defaultValue="__keep__">
                <option value="__keep__">Keep existing</option>
                {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>IP / series</label>
              <input name="ip" placeholder="Leave as __keep__ to skip" defaultValue="__keep__" />
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>Price adjustment</label>
                <select name="priceMode" defaultValue="">
                  <option value="">No change</option>
                  <option value="set">Set to</option>
                  <option value="increase">Increase by %</option>
                  <option value="decrease">Decrease by %</option>
                </select>
              </div>
              <div className="form-field">
                <label>Value</label>
                <input name="priceValue" type="number" step="0.01" />
              </div>
            </div>
            <button className="btn btn-primary btn-block" type="submit">Apply to {selected.length} products</button>
          </form>
        </Modal>
      )}

      {modal && modal.type === 'bundle' && (
        <Modal title={`Bundle ${selected.length} products`} onClose={() => setModal(null)}>
          <form onSubmit={submitBundle}>
            <div className="form-field">
              <label>Bundle name</label>
              <input name="name" required />
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>Category</label>
                <select name="category" defaultValue="Sets">
                  {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>IP / series</label>
                <input name="ip" />
              </div>
            </div>
            <div className="form-field">
              <label>Bundle price ({cur})</label>
              <input name="price" type="number" step="0.01" min="0" required />
            </div>
            {errorMsg && <div className="form-error">{errorMsg}</div>}
            <button className="btn btn-primary btn-block" type="submit">Create bundle</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
