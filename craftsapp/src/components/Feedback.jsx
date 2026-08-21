import React, { useState } from 'react';
import { useShop } from '../lib/ShopContext.jsx';
import { fmtDateTime, uid } from '../lib/utils.js';

export default function Feedback() {
  const { data, mutate } = useShop();
  const [showAdd, setShowAdd] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  function submit(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const author = (fd.get('author') || '').trim();
    const message = (fd.get('message') || '').trim();
    const rating = parseInt(fd.get('rating'), 10) || 5;
    if (!message) { setErrorMsg('Enter a message.'); return; }
    mutate((d) => {
      d.feedback.unshift({ id: uid('fb'), author: author || 'Anonymous', message, rating, date: new Date().toISOString() });
    });
    setShowAdd(false); setErrorMsg('');
  }

  function deleteFeedback(id) {
    if (!confirm('Delete this feedback entry?')) return;
    mutate((d) => { d.feedback = d.feedback.filter((f) => f.id !== id); });
  }

  return (
    <div>
      <div className="page-head">
        <div><h1>Feedback</h1><p>{data.feedback.length} entries logged.</p></div>
        <button className="btn btn-primary" onClick={() => setShowAdd((v) => !v)}>{showAdd ? 'Cancel' : '+ Add feedback'}</button>
      </div>

      {showAdd && (
        <div className="panel">
          <form onSubmit={submit}>
            <div className="form-row">
              <div className="form-field"><label>From</label><input name="author" placeholder="Buyer name (optional)" /></div>
              <div className="form-field">
                <label>Rating</label>
                <select name="rating" defaultValue="5">
                  {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{'⭐'.repeat(r)}</option>)}
                </select>
              </div>
            </div>
            <div className="form-field"><label>Message</label><textarea name="message" rows={3} required /></div>
            {errorMsg && <div className="form-error">{errorMsg}</div>}
            <button className="btn btn-primary btn-block" type="submit">Save feedback</button>
          </form>
        </div>
      )}

      {data.feedback.length === 0 ? (
        <div className="empty-box">No feedback logged yet.</div>
      ) : data.feedback.map((f) => (
        <div className="plist-item" key={f.id}>
          <div className="plist-top">
            <div className="plist-title-meta">
              <span className="plist-name">{'⭐'.repeat(f.rating)} {f.author}</span>
              <div className="plist-tags"><span className="plist-cat">{fmtDateTime(f.date)}</span></div>
            </div>
            <button className="icon-btn" onClick={() => deleteFeedback(f.id)}>🗑</button>
          </div>
          <p className="hint">{f.message}</p>
        </div>
      ))}
    </div>
  );
}
