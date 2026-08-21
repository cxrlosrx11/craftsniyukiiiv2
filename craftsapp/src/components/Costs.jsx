import React, { useMemo, useState } from 'react';
import { useShop } from '../lib/ShopContext.jsx';
import Modal from './Modal.jsx';
import { money, uid, toPHP, fromPHP } from '../lib/utils.js';
import { COST_TYPES } from '../lib/constants.js';

export default function Costs() {
  const { shop, data, mutate } = useShop();
  const cur = shop.currency || 'PHP';
  const [modal, setModal] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const allTypes = useMemo(
    () => Array.from(new Set([...COST_TYPES, ...(data.customCostTypes || [])])),
    [data.customCostTypes]
  );

  function openAdd() { setModal({ editId: null }); setErrorMsg(''); }
  function openEdit(id) { setModal({ editId: id }); setErrorMsg(''); }

  function submit(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    let type = fd.get('type') || 'Other business expenses';
    const customType = (fd.get('typeOther') || '').trim();
    if (type === '__custom__') {
      if (!customType) { setErrorMsg('Enter a name for the new expense type.'); return; }
      type = customType;
    }
    const label = (fd.get('label') || '').trim();
    const amount = parseFloat(fd.get('amount'));
    const date = fd.get('date') || new Date().toISOString().slice(0, 10);
    if (!label || isNaN(amount) || amount < 0) { setErrorMsg('Enter a valid label and amount.'); return; }
    mutate((d) => {
      if (type && !COST_TYPES.includes(type) && !d.customCostTypes.includes(type)) {
        d.customCostTypes.push(type);
      }
      const amountPHP = toPHP(amount, cur);
      if (modal.editId) {
        const c = d.costs.find((x) => x.id === modal.editId);
        if (c) Object.assign(c, { type, label, amount, currency: cur, amountPHP, date });
      } else {
        d.costs.push({ id: uid('cost'), type, label, amount, currency: cur, amountPHP, date });
      }
    });
    setModal(null); setErrorMsg('');
  }

  function deleteCost(id) {
    if (!confirm('Delete this expense?')) return;
    mutate((d) => { d.costs = d.costs.filter((c) => c.id !== id); });
  }

  const sorted = [...data.costs].sort((a, b) => new Date(b.date) - new Date(a.date));
  const totalPHP = data.costs.reduce((a, c) => a + (typeof c.amountPHP === 'number' ? c.amountPHP : toPHP(c.amount, c.currency || 'PHP')), 0);
  const edit = modal && modal.editId ? data.costs.find((c) => c.id === modal.editId) : null;

  return (
    <div>
      <div className="page-head">
        <div><h1>Expenses</h1><p>Total logged: {money(fromPHP(totalPHP, cur), cur)}</p></div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add expense</button>
      </div>

      {sorted.length === 0 ? (
        <div className="empty-box">No expenses logged yet.</div>
      ) : sorted.map((c) => (
        <div className="plist-item" key={c.id}>
          <div className="plist-top">
            <div className="plist-title-meta">
              <span className="plist-name">{c.label}</span>
              <div className="plist-tags">
                <span className="plist-cat">{c.type}</span>
                <span className="plist-ip">{c.date}</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="mono" style={{ fontWeight: 700 }}>{money(c.amount, c.currency || cur)}</span>
              <div className="plist-actions">
                <button className="icon-btn" onClick={() => openEdit(c.id)}>✎</button>
                <button className="icon-btn" onClick={() => deleteCost(c.id)}>🗑</button>
              </div>
            </div>
          </div>
        </div>
      ))}

      {modal && (
        <Modal title={modal.editId ? 'Edit expense' : 'Add expense'} onClose={() => setModal(null)}>
          <form onSubmit={submit}>
            <div className="form-field">
              <label>Type</label>
              <select name="type" defaultValue={edit ? edit.type : allTypes[0]}>
                {allTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                <option value="__custom__">+ New type…</option>
              </select>
            </div>
            <div className="form-field"><label>New type (if selected above)</label><input name="typeOther" /></div>
            <div className="form-field"><label>Label</label><input name="label" defaultValue={edit ? edit.label : ''} required /></div>
            <div className="form-row">
              <div className="form-field"><label>Amount ({cur})</label><input name="amount" type="number" step="0.01" min="0" defaultValue={edit ? edit.amount : ''} required /></div>
              <div className="form-field"><label>Date</label><input name="date" type="date" defaultValue={edit ? edit.date : new Date().toISOString().slice(0, 10)} /></div>
            </div>
            {errorMsg && <div className="form-error">{errorMsg}</div>}
            <button className="btn btn-primary btn-block" type="submit">{modal.editId ? 'Save changes' : 'Add expense'}</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
