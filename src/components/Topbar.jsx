import React from 'react';
import Icon from './Icon.jsx';
import { LogoMark } from './Logo.jsx';

// Phone/tablet header for the seller dashboard (hidden on desktop, where the sidebar is always visible).
export default function Topbar({ title, onMenu, onQuickSale }) {
  return (
    <header className="topbar">
      <button type="button" className="topbar-btn" onClick={onMenu} aria-label="Open menu"><Icon name="menu" size={20} /></button>
      <LogoMark size={28} />
      <div className="topbar-title">{title}</div>
      <button type="button" className="topbar-sale" onClick={onQuickSale}><Icon name="cart" size={16} /> Sale</button>
    </header>
  );
}
