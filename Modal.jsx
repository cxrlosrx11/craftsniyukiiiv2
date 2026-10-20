import React, { useEffect, useId, useRef } from 'react';
import Icon from './Icon.jsx';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// Accessible dialog: closes on Esc and backdrop click, keeps keyboard focus inside,
// locks page scroll, and returns focus to whatever opened it. On phones it slides up as a sheet.
export default function Modal({ title, onClose, children, wide }) {
  const titleId = useId();
  const panelRef = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const panel = panelRef.current;
    const focusables = () => Array.from(panel.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null);
    const first = focusables().find((el) => !el.classList.contains('modal-close')) || focusables()[0];
    if (first) first.focus(); else panel.focus();

    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab') return;
      const f = focusables();
      if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (opener && opener.focus) opener.focus();
    };
    // eslint-disable-next-line
  }, []);

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panelRef} tabIndex={-1}>
        <div className="modal-head">
          <h3 id={titleId}>{title}</h3>
          <button type="button" className="icon-btn modal-close" onClick={onClose} aria-label="Close"><Icon name="close" size={16} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
