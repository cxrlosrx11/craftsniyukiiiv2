import React, { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { subscribe } from '../lib/ui.js';

export default function UiHost() {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const confirmRef = useRef(null);

  useEffect(() => subscribe((e) => {
    if (e.kind === 'toast') {
      setToasts((t) => [...t.slice(-3), e]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== e.id)), e.type === 'error' ? 6000 : 3500);
    } else if (e.kind === 'confirm') {
      setDialog(e);
    }
  }), []);

  useEffect(() => { if (dialog && confirmRef.current) confirmRef.current.focus(); }, [dialog]);

  function close(value) {
    if (dialog) dialog.resolve(value);
    setDialog(null);
  }

  useEffect(() => {
    if (!dialog) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(false); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line
  }, [dialog]);

  return (
    <>
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={'toast ' + t.type} role={t.type === 'error' ? 'alert' : 'status'}>
            <Icon name={t.type === 'error' ? 'close' : t.type === 'success' ? 'success' : 'sparkles'} size={16} />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
      {dialog && (
        <div className="modal-overlay confirm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) close(false); }}>
          <div className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
            <h3 id="confirm-title">{dialog.title || 'Are you sure?'}</h3>
            <p className="confirm-text">{dialog.message}</p>
            <div className="confirm-actions">
              <button className="btn btn-ghost" onClick={() => close(false)}>{dialog.cancelText || 'Cancel'}</button>
              <button ref={confirmRef} className={'btn ' + (dialog.danger ? 'btn-danger' : 'btn-primary')} onClick={() => close(true)}>{dialog.confirmText || 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
