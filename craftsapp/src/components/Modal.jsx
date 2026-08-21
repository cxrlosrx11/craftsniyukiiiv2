import React from 'react';

export default function Modal({ title, onClose, children, wide }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(42,22,32,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 16
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="modal"
        style={{
          background: '#fff', borderRadius: 16, padding: 24, width: wide ? 640 : 460,
          maxWidth: '100%', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(42,22,32,0.3)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
