import React, { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import Logo from './Logo.jsx';
import { sb } from '../lib/supabaseClient';
import { useShop } from '../lib/ShopContext.jsx';
import { navigate } from '../lib/router.js';

export const HOME_LINK = { tab: 'overview', icon: 'home', label: 'Overview' };

export const NAV_GROUPS = [
  {
    id: 'sell', title: 'Sell',
    links: [
      { tab: 'products', icon: 'package', label: 'Products' },
      { tab: 'pos', icon: 'cart', label: 'On-site sales' },
      { tab: 'orders', icon: 'orders', label: 'Online orders' },
      { tab: 'custom', icon: 'brush', label: 'Custom orders' }
    ]
  },
  {
    id: 'events', title: 'Events',
    links: [
      { tab: 'conventions', icon: 'calendar', label: 'Convention log' },
      { tab: 'pickups', icon: 'convention', label: 'Convention Mode' }
    ]
  },
  {
    id: 'grow', title: 'Grow',
    links: [
      { tab: 'support', icon: 'users', label: 'Profile & support' },
      { tab: 'collections', icon: 'album', label: 'Collections' },
      { tab: 'wrapped', icon: 'award', label: 'Wrapped' },
      { tab: 'showcase', icon: 'store', label: 'Showcase' },
      { tab: 'invite', icon: 'invite', label: 'Invite buyers' },
      { tab: 'feedback', icon: 'feedback', label: 'Feedback' }
    ]
  },
  {
    id: 'money', title: 'Money & insights',
    links: [
      { tab: 'reports', icon: 'reports', label: 'Reports' },
      { tab: 'breakdown', icon: 'breakdown', label: 'Breakdown' },
      { tab: 'costs', icon: 'expenses', label: 'Expenses' },
      { tab: 'insights', icon: 'sparkles', label: 'Smart insights' }
    ]
  },
  {
    id: 'data', title: 'Data',
    links: [
      { tab: 'import', icon: 'import', label: 'Import CSV' },
      { tab: 'backup', icon: 'backup', label: 'Backup & restore' }
    ]
  }
];

export function tabLabel(tab) {
  if (tab === HOME_LINK.tab) return HOME_LINK.label;
  for (const g of NAV_GROUPS) {
    const l = g.links.find((x) => x.tab === tab);
    if (l) return l.label;
  }
  return 'Dashboard';
}

const GROUPS_KEY = 'cy_nav_groups';
const groupOf = (tab) => NAV_GROUPS.find((g) => g.links.some((l) => l.tab === tab));

export default function Sidebar({ sellerTab, setSellerTab, navOpen, setNavOpen }) {
  const { shop, logout } = useShop();
  const [counts, setCounts] = useState({ orders: 0, support: 0, pickups: 0, custom: 0 });
  const [open, setOpen] = useState(() => {
    const base = { sell: true, events: true, grow: true, money: true, data: false };
    try { return { ...base, ...JSON.parse(localStorage.getItem(GROUPS_KEY) || '{}') }; } catch (e) { return base; }
  });

  useEffect(() => {
    let alive = true;
    async function check() {
      const head = (table, filters) => {
        let q = sb.from(table).select('id', { count: 'exact', head: true });
        Object.entries(filters).forEach(([k, v]) => { q = q.eq(k, v); });
        return q;
      };
      const [o, t, r, c] = await Promise.all([
        head('orders', { status: 'Pending' }),
        head('tips', { shop_id: shop.id, status: 'Pending' }),
        head('reservations', { shop_id: shop.id, status: 'Reserved' }),
        head('custom_requests', { shop_id: shop.id, status: 'Requested' })
      ]);
      if (!alive) return;
      setCounts({ orders: o.error ? 0 : o.count || 0, support: t.error ? 0 : t.count || 0, pickups: r.error ? 0 : r.count || 0, custom: c.error ? 0 : c.count || 0 });
    }
    check();
    const timer = setInterval(check, 60000);
    return () => { alive = false; clearInterval(timer); };
  }, [sellerTab, shop.id]);

  // Always reveal the group of the page you are on.
  useEffect(() => {
    const g = groupOf(sellerTab);
    if (g && !open[g.id]) setOpen((o) => ({ ...o, [g.id]: true }));
    // eslint-disable-next-line
  }, [sellerTab]);

  function toggle(id) {
    setOpen((o) => {
      const next = { ...o, [id]: !o[id] };
      try { localStorage.setItem(GROUPS_KEY, JSON.stringify(next)); } catch (e) { /* ignore */ }
      return next;
    });
  }

  function pick(tab) {
    setSellerTab(tab);
    if (window.innerWidth <= 920) setNavOpen(false);
  }

  const initials = (shop.shopName || '?').trim().slice(0, 1).toUpperCase();
  const badge = (tab) => (counts[tab] > 0 ? <span className="nav-badge" aria-label={`${counts[tab]} waiting`}>{counts[tab]}</span> : null);

  return (
    <aside className="sidebar" aria-label="Main navigation">
      <div className="brand">
        <Logo size={34} />
        <button type="button" className="nav-collapse-btn" onClick={() => setNavOpen(false)} aria-label="Close menu"><Icon name="close" size={18} /></button>
      </div>

      <button type="button" className="sell-btn" onClick={() => pick('pos')}>
        <Icon name="cart" size={18} /> Quick sale
      </button>

      <nav>
        <button type="button" className={'side-link ' + (sellerTab === HOME_LINK.tab ? 'active' : '')} onClick={() => pick(HOME_LINK.tab)} aria-current={sellerTab === HOME_LINK.tab ? 'page' : undefined}>
          <span className="ic"><Icon name={HOME_LINK.icon} size={18} /></span> {HOME_LINK.label}
        </button>

        {NAV_GROUPS.map((g) => {
          const isOpen = !!open[g.id];
          const waiting = g.links.reduce((a, l) => a + (counts[l.tab] || 0), 0);
          return (
            <div key={g.id} className="side-block">
              <button type="button" className="side-group" aria-expanded={isOpen} onClick={() => toggle(g.id)}>
                {g.title}
                {!isOpen && waiting > 0 && <span className="nav-badge">{waiting}</span>}
                <Icon name="down" size={14} className="chev" />
              </button>
              {isOpen && g.links.map((link) => (
                <button
                  key={link.tab}
                  type="button"
                  className={'side-link ' + (sellerTab === link.tab ? 'active' : '')}
                  onClick={() => pick(link.tab)}
                  aria-current={sellerTab === link.tab ? 'page' : undefined}
                >
                  <span className="ic"><Icon name={link.icon} size={18} /></span> {link.label}
                  {badge(link.tab)}
                </button>
              ))}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-spacer" />

      <div className="profile-row">
        <div className="avatar" aria-hidden="true">{initials}</div>
        <div className="profile-meta">
          <div className="profile-name">{shop.shopName}</div>
          <div className="profile-sub">@{shop.username}</div>
        </div>
      </div>
      <div className="side-foot-actions">
        <button type="button" className="signout-btn" onClick={() => navigate('/')}><Icon name="shopbag" size={15} /> View shop</button>
        <button type="button" className="signout-btn" onClick={async () => { await logout(); navigate('/'); }}><Icon name="logout" size={15} /> Log out</button>
      </div>
    </aside>
  );
}
