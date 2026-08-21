import React, { useState } from 'react';
import { useShop } from '../lib/ShopContext.jsx';
import Modal from './Modal.jsx';
import { uid } from '../lib/utils.js';

export default function Conventions() {
  const { data, mutate } = useShop();
  const [modal, setModal] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  function openAdd() { setModal({ editId: null }); setErrorMsg(''); }
  function openEdit(id) { setModal({ editId: id }); setErrorMsg(''); }

  function submit(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = (fd.get('name') || '').trim();
    const date = fd.get('date') || '';
    const location = (fd.get('location') || '').trim();
    const notes = (fd.get('notes') || '').trim();
    if (!name || !date) { setErrorMsg('Enter a name and date.'); return; }
    mutate((d) => {
      if (modal.editId) {
        const c = d.conventions.find((x) => x.id === modal.editId);
        if (c) Object.assign(c, { name, date, location, notes });
      } else {
        d.conventions.push({ id: uid('conv'), name, date, location, notes });
      }
    });
    setModal(null); setErrorMsg('');
  }

  function deleteConvention(id) {
    if (!confirm('Delete this convention entry?')) return;
    mutate((d) => { d.conventions = d.conventions.filter((c) => c.id !== id); });
  }

  const sorted = [...data.conventions].sort((a, b) => new Date(a.date) - new Date(b.date));
  const edit = modal && modal.editId ? data.conventions.find((c) => c.id === modal.editId) : null;

  return (
    <div>
      <div className="page-head">
        <div><h1>Conventions</h1><p>Track events you're selling at.</p></div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add convention</button>
      </div>

      {sorted.length === 0 ? (
        <div className="empty-box">No conventions logged yet.</div>
      ) : sorted.map((c) => (
        <div className="plist-item" key={c.id}>
          <div className="plist-top">
            <div className="plist-title-meta">
              <span className="plist-name">{c.name}</span>
              <div className="plist-tags">
                <span className="plist-cat">{c.date}</span>
                {c.location && <span className="plist-ip">{c.location}</span>}
              </div>
            </div>
            <div className="plist-actions">
              <button className="icon-btn" onClick={() => openEdit(c.id)}>✎</button>
              <button className="icon-btn" onClick={() => deleteConvention(c.id)}>🗑</button>
            </div>
          </div>
          {c.notes && <p className="hint">{c.notes}</p>}
        </div>
      ))}

      {modal && (
        <Modal title={modal.editId ? 'Edit convention' : 'Add convention'} onClose={() => setModal(null)}>
          <form onSubmit={submit}>
            <div className="form-field"><label>Name</label><input name="name" defaultValue={edit ? edit.name : ''} required /></div>
            <div className="form-field"><label>Date</label><input name="date" type="date" defaultValue={edit ? edit.date : ''} required /></div>
            <div className="form-field"><label>Location</label><input name="location" defaultValue={edit ? edit.location : ''} /></div>
            <div className="form-field"><label>Notes</label><textarea name="notes" rows={3} defaultValue={edit ? edit.notes : ''} /></div>
            {errorMsg && <div className="form-error">{errorMsg}</div>}
            <button className="btn btn-primary btn-block" type="submit">{modal.editId ? 'Save changes' : 'Add convention'}</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
