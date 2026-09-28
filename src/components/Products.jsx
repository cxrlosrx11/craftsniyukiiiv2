import React, { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { useShop } from '../lib/ShopContext.jsx';
import Modal from './Modal.jsx';
import { money, uid, resizeImageFile } from '../lib/utils.js';
import { CATEGORIES } from '../lib/constants.js';

function logStock(data, productId, name, delta, resultingStock) {
  data.stockLog.unshift({ id: uid('log'), productId, name, delta, resultingStock, date: new Date().toISOString() });
}

function emptyBulkRow() {
  return { id: uid('row'), name: '', sku: '', price: '', cost: '', stock: '', lowStockAt: '', emoji: '', image: null };
}

function ImageCropper({ src, onCancel, onSave }) {
  const VS = 260; // square viewport size in px
  const [natural, setNatural] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const dragRef = useRef(null);

  function clampPos(p, dW, dH) {
    const minX = Math.min(0, VS - dW), maxX = 0;
    const minY = Math.min(0, VS - dH), maxY = 0;
    return { x: Math.min(maxX, Math.max(minX, p.x)), y: Math.min(maxY, Math.max(minY, p.y)) };
  }

  function handleImgLoad(e) {
    const w = e.target.naturalWidth, h = e.target.naturalHeight;
    const cover = Math.max(VS / w, VS / h);
    setNatural({ w, h });
    setZoom(1);
    setPos({ x: (VS - w * cover) / 2, y: (VS - h * cover) / 2 });
  }

  const coverScale = natural ? Math.max(VS / natural.w, VS / natural.h) : 1;
  const scale = coverScale * zoom;
  const dW = natural ? natural.w * scale : VS;
  const dH = natural ? natural.h * scale : VS;

  useEffect(() => {
    if (!natural) return;
    setPos((p) => clampPos(p, dW, dH));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, natural]);

  function onPointerDown(e) {
    e.preventDefault();
    if (containerRef.current) containerRef.current.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPos: pos };
  }
  function onPointerMove(e) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos(clampPos({ x: dragRef.current.startPos.x + dx, y: dragRef.current.startPos.y + dy }, dW, dH));
  }
  function onPointerUp(e) {
    dragRef.current = null;
    try { if (containerRef.current) containerRef.current.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
  }

  function handleSave() {
    if (!imgRef.current || !natural) return;
    const outputSize = 640;
    const canvas = document.createElement('canvas');
    canvas.width = outputSize; canvas.height = outputSize;
    const ctx = canvas.getContext('2d');
    const sx = (0 - pos.x) / scale;
    const sy = (0 - pos.y) / scale;
    const sSize = VS / scale;
    ctx.drawImage(imgRef.current, sx, sy, sSize, sSize, 0, 0, outputSize, outputSize);
    onSave(canvas.toDataURL('image/jpeg', 0.85));
  }

  return (
    <div>
      <div
        ref={containerRef}
        style={{
          width: VS, height: VS, borderRadius: 12, overflow: 'hidden', position: 'relative',
          background: 'var(--accent-softer)', margin: '0 auto', cursor: 'grab', touchAction: 'none'
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          ref={imgRef}
          src={src}
          alt=""
          onLoad={handleImgLoad}
          draggable={false}
          style={{ position: 'absolute', left: pos.x, top: pos.y, width: dW, height: dH, maxWidth: 'none', userSelect: 'none', pointerEvents: 'none' }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <Icon name="search" size={14} />
        <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} style={{ flex: 1 }} />
        <Icon name="search" size={18} />
      </div>
      <p className="hint small" style={{ textAlign: 'center', marginTop: 6 }}>Drag the photo to reposition it, use the slider to zoom.</p>
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <div style={{ flex: 1 }} />
        <button type="button" className="btn btn-primary" onClick={handleSave}>Save crop</button>
      </div>
    </div>
  );
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

  function openAddChooser() { setModal({ type: 'addMethod' }); setErrorMsg(''); }
  function openAdd() { setModal({ type: 'product', editId: null }); setErrorMsg(''); }
  function openEdit(id) { setModal({ type: 'product', editId: id }); setErrorMsg(''); }

  function openBulkAdd() {
    const hasCats = allCategories.length > 0;
    setModal({
      type: 'bulkAdd',
      step: 1,
      category: hasCats ? allCategories[0] : '',
      newCategory: '',
      showNewCategory: !hasCats,
      rows: [emptyBulkRow()],
      error: ''
    });
  }
  function bulkNext() {
    setModal((m) => {
      if (m.step === 1) {
        if (m.showNewCategory && !m.newCategory.trim()) return { ...m, error: 'Enter a category name.' };
        if (!m.showNewCategory && !m.category) return { ...m, error: 'Choose a category.' };
      }
      if (m.step === 2) {
        const invalid = m.rows.some((r) => !r.name.trim());
        if (invalid || m.rows.length === 0) return { ...m, error: 'Every product needs a name.' };
      }
      return { ...m, step: Math.min(3, m.step + 1), error: '' };
    });
  }
  function bulkBack() { setModal((m) => ({ ...m, step: Math.max(1, m.step - 1), error: '' })); }
  function bulkAddRow() { setModal((m) => ({ ...m, rows: [...m.rows, emptyBulkRow()] })); }
  function bulkRemoveRow(rowId) {
    setModal((m) => ({ ...m, rows: m.rows.length > 1 ? m.rows.filter((r) => r.id !== rowId) : m.rows }));
  }
  function bulkUpdateRow(rowId, field, value) {
    setModal((m) => ({ ...m, rows: m.rows.map((r) => r.id === rowId ? { ...r, [field]: value } : r) }));
  }
  function bulkMoveRow(index, dir) {
    setModal((m) => {
      const rows = m.rows.slice();
      const to = index + dir;
      if (to < 0 || to >= rows.length) return m;
      const [moved] = rows.splice(index, 1);
      rows.splice(to, 0, moved);
      return { ...m, rows };
    });
  }
  async function bulkSetRowImage(rowId, file) {
    const dataUrl = await resizeImageFile(file, 1200);
    setModal((m) => ({ ...m, cropRowId: rowId, cropSrc: dataUrl || '' }));
  }
  function bulkOpenRecrop(rowId, currentImage) {
    if (!currentImage) return;
    setModal((m) => ({ ...m, cropRowId: rowId, cropSrc: currentImage }));
  }
  function confirmBulkCrop(croppedDataUrl) {
    setModal((m) => ({
      ...m, cropRowId: null, cropSrc: null,
      rows: m.rows.map((r) => r.id === m.cropRowId ? { ...r, image: croppedDataUrl } : r)
    }));
  }
  function cancelBulkCrop() {
    setModal((m) => ({ ...m, cropRowId: null, cropSrc: null }));
  }
  function bulkRemoveRowImage(rowId) {
    setModal((m) => ({ ...m, rows: m.rows.map((r) => r.id === rowId ? { ...r, image: null } : r) }));
  }
  function bulkSubmit() {
    const m = modal;
    let finalCategory = m.showNewCategory ? m.newCategory.trim() : m.category;
    if (!finalCategory) finalCategory = 'Other';
    const validRows = m.rows.filter((r) => r.name.trim());
    mutate((d) => {
      if (finalCategory && !CATEGORIES.includes(finalCategory) && !d.customCategories.includes(finalCategory)) {
        d.customCategories.push(finalCategory);
      }
      validRows.forEach((r) => {
        const newId = uid('prod');
        const stock = parseInt(r.stock, 10) || 0;
        const lowStockAt = parseInt(r.lowStockAt, 10) || 0;
        d.products.push({
          id: newId, name: r.name.trim(), category: finalCategory, ip: '',
          price: parseFloat(r.price) || 0, cost: parseFloat(r.cost) || 0,
          stock, lowStockAt, emoji: r.emoji.trim(), image: r.image || '', archived: false, notes: ''
        });
        if (stock > 0) logStock(d, newId, r.name.trim(), stock, stock);
      });
    });
    setModal(null);
  }

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
    const dataUrl = await resizeImageFile(file, 1200);
    setModal((m) => ({ ...m, cropSrc: dataUrl || '' }));
  }
  function openPhotoRecrop() {
    setModal((m) => {
      const src = m.imageDraft || (editProduct && editProduct.image);
      return src ? { ...m, cropSrc: src } : m;
    });
  }
  function confirmProductCrop(croppedDataUrl) {
    setModal((m) => ({ ...m, cropSrc: null, imageDraft: croppedDataUrl }));
  }
  function cancelProductCrop() {
    setModal((m) => ({ ...m, cropSrc: null }));
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
            <Icon name="gift" size={15} /> Bundle selected
          </button>
          <button className="btn btn-ghost" onClick={() => setModal({ type: 'batch' })} disabled={!selected.length}>
            <Icon name="edit" size={15} /> Batch edit
          </button>
          <button className="btn btn-primary" onClick={openAddChooser}>+ Add product</button>
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
          <button className="cat-filter-clear" onClick={clearSelection}><Icon name="close" size={13} /> Clear {selected.length} selected</button>
        )}
        {selected.length === 0 && filtered.length > 0 && (
          <button className="cat-filter-clear" onClick={selectAllOnPage}>Select all shown</button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-box">No products match these filters.</div>
      ) : (
        <div className="plist-grid">
          {filtered.map((p) => (
            <div className={'plist-card ' + (p.archived ? 'archived ' : '') + (selected.includes(p.id) ? 'selected' : '')} key={p.id}>
              <div className="plist-card-media">
                <div className="plist-card-checkwrap">
                  <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggleSelect(p.id)} />
                </div>
                {p.image ? <img src={p.image} alt={p.name} /> : (p.emoji || <Icon name="image" size={22} />)}
                {p.archived && <span className="plist-badge archived-badge" style={{ position: 'absolute', top: 9, right: 9 }}>Archived</span>}
              </div>
              <div className="plist-card-body">
                <span className="plist-card-name">{p.name}</span>
                <div className="mono" style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
                  {money(p.price, cur)} · <span style={{ color: p.stock <= 0 ? 'var(--red)' : (p.stock <= p.lowStockAt ? 'var(--amber)' : 'var(--muted)') }}>
                    {p.stock <= 0 ? 'Out of stock' : `${p.stock} left`}
                  </span>
                </div>
                <div className="plist-card-actions">
                  <button className="btn btn-ghost" title="Edit" onClick={() => openEdit(p.id)}><Icon name="edit" size={15} /> Edit</button>
                  <button className="btn btn-ghost" title={p.archived ? 'Unarchive' : 'Archive'} onClick={() => toggleArchive(p.id)}><Icon name="archive" size={16} /></button>
                  <button className="btn btn-ghost" title="Delete" onClick={() => deleteProduct(p.id)}><Icon name="trash" size={16} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && modal.type === 'addMethod' && (
        <Modal title="Add products" onClose={() => setModal(null)}>
          <div className="method-lead">
            <div className="kicker">Get started</div>
            <h2>How would you like to add products?</h2>
            <p>Add one product with full detail, or add a whole batch at once.</p>
          </div>
          <div className="method-grid">
            <button type="button" className="method-card" style={{ cursor: 'pointer', width: '100%', font: 'inherit' }} onClick={openAdd}>
              <div className="method-icon"><Icon name="add" size={24} /></div>
              <h3>Single product</h3>
              <p>Fill in one product's full details — name, category, price, stock, and photo.</p>
              <span className="method-arrow"><Icon name="forward" size={20} /></span>
            </button>
            <button type="button" className="method-card dark" style={{ cursor: 'pointer', width: '100%', font: 'inherit' }} onClick={openBulkAdd}>
              <div className="method-icon"><Icon name="layers" size={24} /></div>
              <h3>Bulk add</h3>
              <p>Add many products at once with a shared category, then review before saving.</p>
              <span className="method-arrow"><Icon name="forward" size={20} /></span>
            </button>
          </div>
        </Modal>
      )}

      {modal && modal.type === 'product' && (
        <Modal title={modal.cropSrc ? 'Position your photo' : (modal.editId ? 'Edit product' : 'Add product')} onClose={() => setModal(null)}>
          {modal.cropSrc ? (
            <ImageCropper src={modal.cropSrc} onCancel={cancelProductCrop} onSave={confirmProductCrop} />
          ) : (
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
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginTop: 8 }}>
                  <img
                    src={modal.imageDraft || editProduct.image}
                    alt=""
                    style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 10 }}
                  />
                  <button type="button" className="btn btn-ghost" onClick={openPhotoRecrop}><Icon name="edit" size={14} /> Move / crop photo</button>
                </div>
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
          )}
        </Modal>
      )}

      {modal && modal.type === 'bulkAdd' && (
        <Modal title={modal.cropSrc ? 'Position your photo' : 'Bulk add products'} wide onClose={() => setModal(null)}>
          {!modal.cropSrc && (
          <div className="wizard-steps">
            {[1, 2, 3].map((n, idx) => (
              <React.Fragment key={n}>
                <div className={'wizard-step-dot ' + (modal.step === n ? 'active' : (modal.step > n ? 'done' : ''))}>
                  {modal.step > n ? <Icon name="check" size={14} /> : n}
                </div>
                {idx < 2 && <div className="wizard-step-line" />}
              </React.Fragment>
            ))}
          </div>
          )}
          {!modal.cropSrc && (
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div className="wizard-kicker">Step {modal.step} of 3</div>
            <div className="wizard-title" style={{ fontSize: 19, marginBottom: 4 }}>
              {modal.step === 1 ? 'Choose a category' : modal.step === 2 ? 'Add your products' : 'Review & confirm'}
            </div>
            <p className="wizard-sub" style={{ marginBottom: 0 }}>
              {modal.step === 1 ? 'Every product in this batch will share one category.'
                : modal.step === 2 ? 'Add one row per product — photo, price, and stock included.'
                : 'Double-check everything before adding these products.'}
            </p>
          </div>
          )}

          {modal.error && <div className="form-error">{modal.error}</div>}

          {modal.step === 1 && (
            <div>
              <div className="form-field">
                <label>Category</label>
                <select
                  value={modal.category}
                  disabled={modal.showNewCategory}
                  onChange={(e) => setModal({ ...modal, category: e.target.value })}
                >
                  {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <button
                  type="button"
                  className="link-btn"
                  style={{ marginTop: 4, textAlign: 'left' }}
                  onClick={() => setModal({
                    ...modal,
                    showNewCategory: !modal.showNewCategory,
                    category: !modal.showNewCategory ? '' : (allCategories[0] || '')
                  })}
                >
                  {modal.showNewCategory ? <><Icon name="back" size={13} /> Choose existing category</> : '+ Add new category'}
                </button>
              </div>
              {modal.showNewCategory && (
                <div className="form-field">
                  <label>New category name</label>
                  <input
                    type="text"
                    placeholder="e.g. Magnets"
                    value={modal.newCategory}
                    onChange={(e) => setModal({ ...modal, newCategory: e.target.value })}
                  />
                </div>
              )}
            </div>
          )}

          {modal.step === 2 && (
            modal.cropSrc ? (
              <ImageCropper src={modal.cropSrc} onCancel={cancelBulkCrop} onSave={confirmBulkCrop} />
            ) : (
            <div>
              {modal.rows.map((r, i) => (
                <div className="bulk-item-card" key={r.id}>
                  <div className="bulk-item-media">
                    <div className="bim-box">
                      {r.image ? <img src={r.image} alt="" /> : (r.emoji || <span style={{ fontSize: 10, color: 'var(--muted)' }}>No photo</span>)}
                    </div>
                    <label className="btn btn-ghost bulk-item-replace" style={{ cursor: 'pointer', display: 'block', textAlign: 'center' }}>
                      <Icon name="camera" size={14} /> {r.image ? 'Replace' : 'Upload'}
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) bulkSetRowImage(r.id, f); }}
                      />
                    </label>
                    {r.image && (
                      <button type="button" className="btn btn-ghost bulk-item-replace" onClick={() => bulkOpenRecrop(r.id, r.image)}>
                        <Icon name="edit" size={14} /> Move / crop
                      </button>
                    )}
                    {r.image && (
                      <button type="button" className="btn btn-ghost bulk-item-remove" onClick={() => bulkRemoveRowImage(r.id)}>
                        Remove photo
                      </button>
                    )}
                  </div>
                  <div className="bulk-item-fields">
                    <div className="ff-full">
                      <label>Product name</label>
                      <input type="text" placeholder="Product name" value={r.name} onChange={(e) => bulkUpdateRow(r.id, 'name', e.target.value)} />
                    </div>
                    <div>
                      <label>SKU (optional)</label>
                      <input type="text" value={r.sku} onChange={(e) => bulkUpdateRow(r.id, 'sku', e.target.value)} />
                    </div>
                    <div>
                      <label>Emoji (if no photo)</label>
                      <input type="text" placeholder="🩷" value={r.emoji} onChange={(e) => bulkUpdateRow(r.id, 'emoji', e.target.value)} />
                    </div>
                    <div>
                      <label>Price ({cur})</label>
                      <input type="number" min="0" step="0.01" value={r.price} onChange={(e) => bulkUpdateRow(r.id, 'price', e.target.value)} />
                    </div>
                    <div>
                      <label>Cost ({cur})</label>
                      <input type="number" min="0" step="0.01" value={r.cost} onChange={(e) => bulkUpdateRow(r.id, 'cost', e.target.value)} />
                    </div>
                    <div>
                      <label>Stock qty</label>
                      <input type="number" min="0" step="1" value={r.stock} onChange={(e) => bulkUpdateRow(r.id, 'stock', e.target.value)} />
                    </div>
                    <div>
                      <label>Low-stock alert at</label>
                      <input type="number" min="0" step="1" value={r.lowStockAt} onChange={(e) => bulkUpdateRow(r.id, 'lowStockAt', e.target.value)} />
                    </div>
                    <div className="ff-full" style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                      <button type="button" className="icon-btn" title="Move up" disabled={i === 0} onClick={() => bulkMoveRow(i, -1)}><Icon name="up" size={15} /></button>
                      <button type="button" className="icon-btn" title="Move down" disabled={i === modal.rows.length - 1} onClick={() => bulkMoveRow(i, 1)}><Icon name="down" size={15} /></button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ color: 'var(--red)' }}
                        disabled={modal.rows.length <= 1}
                        onClick={() => bulkRemoveRow(r.id)}
                      >
                        <Icon name="trash" size={14} /> Remove row
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={bulkAddRow}
                style={{ width: '100%', border: '1px dashed var(--accent)', background: 'var(--accent-softer)', color: 'var(--accent-dark)', borderRadius: 12, padding: 12, fontWeight: 800, fontSize: 13.5 }}
              >
                ＋ Add another product
              </button>
            </div>
            )
          )}

          {modal.step === 3 && (() => {
            const finalCategory = modal.showNewCategory ? (modal.newCategory.trim() || '(new category)') : modal.category;
            const valid = modal.rows.filter((r) => r.name.trim());
            return (
              <div>
                <p className="hint" style={{ marginBottom: 10 }}>Category: <b>{finalCategory}</b></p>
                <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                  {valid.map((r, i) => (
                    <div
                      key={r.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', fontSize: 13,
                        borderBottom: i < valid.length - 1 ? '1px solid var(--border)' : 'none'
                      }}
                    >
                      {r.image
                        ? <img src={r.image} alt="" style={{ width: 32, height: 32, borderRadius: 7, objectFit: 'cover', flex: 'none' }} />
                        : <div style={{ width: 32, height: 32, borderRadius: 7, background: 'var(--accent-softer)', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{r.emoji || <Icon name="image" size={14} />}</div>}
                      <div style={{ fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                      <div className="mono" style={{ color: 'var(--muted)', fontSize: 12 }}>{money(parseFloat(r.price) || 0, cur)} · stock {parseInt(r.stock, 10) || 0}</div>
                    </div>
                  ))}
                </div>
                <p className="hint small" style={{ marginTop: 10 }}>{valid.length} product{valid.length === 1 ? '' : 's'} will be added.</p>
              </div>
            );
          })()}

          {!modal.cropSrc && (
          <div className="modal-actions">
            {modal.step > 1
              ? <button type="button" className="btn btn-ghost" onClick={bulkBack}><Icon name="back" size={14} /> Back</button>
              : <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>}
            <div style={{ flex: 1 }} />
            {modal.step < 3
              ? <button type="button" className="btn btn-primary" onClick={bulkNext}>Next <Icon name="forward" size={14} /></button>
              : <button type="button" className="btn btn-primary" onClick={bulkSubmit}>Add {modal.rows.filter((r) => r.name.trim()).length} products</button>}
          </div>
          )}
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
