import React, { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { sb } from '../lib/supabaseClient';
import { useShop } from '../lib/ShopContext.jsx';
import { navigate } from '../lib/router.js';

const NAV_SECTIONS = [
  {
    title: 'Shop',
    links: [
      { tab: 'overview', icon: 'home', label: 'Overview' },
      { tab: 'products', icon: 'package', label: 'Products' },
      { tab: 'pos', icon: 'cart', label: 'On-site sales' },
      { tab: 'orders', icon: 'orders', label: 'Online orders' },
      { tab: 'conventions', icon: 'convention', label: 'Conventions' },
      { tab: 'costs', icon: 'expenses', label: 'Expenses' }
    ]
  },
  {
    title: 'Insights',
    links: [
      { tab: 'reports', icon: 'reports', label: 'Reports' },
      { tab: 'breakdown', icon: 'breakdown', label: 'Breakdown' }
    ]
  },
  {
    title: 'More',
    links: [
      { tab: 'showcase', icon: 'store', label: 'Showcase' },
      { tab: 'invite', icon: 'invite', label: 'Invite buyers' },
      { tab: 'feedback', icon: 'feedback', label: 'Feedback' },
      { tab: 'import', icon: 'import', label: 'Import CSV' },
      { tab: 'backup', icon: 'backup', label: 'Backup & restore' }
    ]
  }
];

export default function Sidebar({ sellerTab, setSellerTab, navOpen, setNavOpen }) {
  const { shop, logout } = useShop();
  const [pending, setPending] = useState(0);
  useEffect(() => {
    let alive = true;
    async function check() {
      const res = await sb.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'Pending');
      if (alive && !res.error) setPending(res.count || 0);
    }
    check();
    const t = setInterval(check, 60000);
    return () => { alive = false; clearInterval(t); };
  }, [sellerTab]);
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
        <button className="nav-collapse-btn" onClick={() => setNavOpen(false)}><Icon name="close" size={16} /></button>
      </div>

      <button
        type="button"
        className="sell-btn"
        onClick={() => pick('pos')}
      >
        <Icon name="cart" size={18} /> Quick sale
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
              <span className="ic"><Icon name={link.icon} size={18} /></span> {link.label}
              {link.tab === 'orders' && pending > 0 && <span className="nav-badge">{pending}</span>}
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
      <button className="signout-btn" onClick={() => navigate('/')}><Icon name="shopbag" size={16} /> View shop</button>
      <button className="signout-btn" onClick={async () => { await logout(); navigate('/'); }}><Icon name="logout" size={16} /> Log out</button>
    </div>
  );
}
