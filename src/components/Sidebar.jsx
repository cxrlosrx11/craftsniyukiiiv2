import React from 'react';
import { useShop } from '../lib/ShopContext.jsx';

const NAV_SECTIONS = [
  {
    title: 'Shop',
    links: [
      { tab: 'overview', icon: '🏠', label: 'Overview' },
      { tab: 'products', icon: '📦', label: 'Products' },
      { tab: 'pos', icon: '🛒', label: 'On-site sales' },
      { tab: 'conventions', icon: '🎪', label: 'Conventions' },
      { tab: 'costs', icon: '💸', label: 'Expenses' }
    ]
  },
  {
    title: 'Insights',
    links: [
      { tab: 'reports', icon: '📊', label: 'Reports' },
      { tab: 'breakdown', icon: '🧾', label: 'Breakdown' }
    ]
  },
  {
    title: 'More',
    links: [
      { tab: 'showcase', icon: '🌟', label: 'Showcase' },
      { tab: 'invite', icon: '💌', label: 'Invite buyers' },
      { tab: 'feedback', icon: '💬', label: 'Feedback' },
      { tab: 'import', icon: '⬆️', label: 'Import CSV' },
      { tab: 'backup', icon: '🗄️', label: 'Backup & restore' }
    ]
  }
];

export default function Sidebar({ sellerTab, setSellerTab, navOpen, setNavOpen }) {
  const { shop, logout } = useShop();
  const initials = (shop.shopName || '?').trim().slice(0, 1).toUpperCase();

  function pick(tab) {
    setSellerTab(tab);
    if (window.innerWidth <= 920) setNavOpen(false);
  }

  return (
    <div className="sidebar">
      <div className="brand">
        <div className="brand-logo">CY</div>
        <div className="brand-text">Crafts ni Yukiii</div>
        <button className="nav-collapse-btn" onClick={() => setNavOpen(false)}>✕</button>
      </div>

      <button
        type="button"
        className="sell-btn"
        onClick={() => pick('pos')}
      >
        🛒 Quick sale
      </button>

      {NAV_SECTIONS.map((section) => (
        <div key={section.title}>
          <div className="side-section">{section.title}</div>
          {section.links.map((link) => (
            <button
              key={link.tab}
              type="button"
              className={'side-link ' + (sellerTab === link.tab ? 'active' : '')}
              onClick={() => pick(link.tab)}
            >
              <span className="ic">{link.icon}</span> {link.label}
            </button>
          ))}
        </div>
      ))}

      <div className="sidebar-spacer" />

      <div className="profile-row">
        <div className="avatar">{initials}</div>
        <div className="profile-meta">
          <div className="profile-name">{shop.shopName}</div>
          <div className="profile-sub">@{shop.username}</div>
        </div>
      </div>
      <button className="signout-btn" onClick={logout}>⎋ Log out</button>
    </div>
  );
}
