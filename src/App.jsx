import React, { useEffect, useState } from 'react';
import Icon from './components/Icon.jsx';
import { useShop } from './lib/ShopContext.jsx';
import Auth from './components/Auth.jsx';
import Sidebar from './components/Sidebar.jsx';
import Overview from './components/Overview.jsx';
import Products from './components/Products.jsx';
import Conventions from './components/Conventions.jsx';
import Costs from './components/Costs.jsx';
import Reports from './components/Reports.jsx';
import Breakdown from './components/Breakdown.jsx';
import Showcase from './components/Showcase.jsx';
import Invite from './components/Invite.jsx';
import Feedback from './components/Feedback.jsx';
import ImportTab from './components/ImportTab.jsx';
import BackupTab from './components/BackupTab.jsx';
import Pos from './components/Pos.jsx';
import Storefront from './components/Storefront.jsx';
import Orders from './components/Orders.jsx';
import BuyerOrders from './components/BuyerOrders.jsx';
import { useRoute, navigate } from './lib/router.js';

export default function App() {
  const { booting, shop, buyer, loadError, retryLoad } = useShop();
  const [sellerTab, setSellerTab] = useState('overview');
  const [navOpen, setNavOpen] = useState(typeof window === 'undefined' || window.innerWidth > 920);
  const route = useRoute();

  // Once signed in, leave the login screen for the dashboard.
  useEffect(() => {
    if (booting || route.name !== 'login') return;
    if (shop) navigate('/dashboard');
    else if (buyer) navigate('/');
  }, [booting, shop, buyer, route.name]);

  if (booting) {
    return <div className="loading-screen">Loading Crafts ni Yukiii…</div>;
  }

  // Public pages: the shop is the landing page.
  if (route.name === 'orders') {
    if (buyer) return <BuyerOrders />;
    if (!shop) return <Auth />;
  }
  if (route.name === 'home') return <Storefront />;
  if (route.name === 'shop') return <Storefront slug={route.slug} />;
  if (route.name === 'login' && !shop && !buyer) return <Auth />;
  if (buyer) return <Storefront />; // buyers have no dashboard

  if (loadError) {
    return (
      <div className="loading-screen" style={{ flexDirection: 'column', gap: 14, textAlign: 'center', padding: 24 }}>
        <p style={{ maxWidth: 420 }}>We couldn't load your shop data just now.</p>
        <p style={{ maxWidth: 420, fontWeight: 400, fontSize: 14, color: 'var(--muted)' }}>
          To make sure nothing gets overwritten, editing is paused until this loads successfully.
          Please check your connection and try again.
        </p>
        <button className="btn btn-primary" onClick={retryLoad}>Try again</button>
      </div>
    );
  }

  if (!shop) {
    return <Auth />; // /dashboard while signed out
  }

  let content;
  switch (sellerTab) {
    case 'overview': content = <Overview goTo={setSellerTab} />; break;
    case 'products': content = <Products />; break;
    case 'conventions': content = <Conventions />; break;
    case 'costs': content = <Costs />; break;
    case 'reports': content = <Reports />; break;
    case 'breakdown': content = <Breakdown />; break;
    case 'showcase': content = <Showcase />; break;
    case 'invite': content = <Invite />; break;
    case 'feedback': content = <Feedback />; break;
    case 'import': content = <ImportTab goTo={setSellerTab} />; break;
    case 'backup': content = <BackupTab />; break;
    case 'pos': content = <Pos goTo={setSellerTab} />; break;
    case 'orders': content = <Orders />; break;
    default: content = <Overview goTo={setSellerTab} />;
  }

  const shellClass = 'shell ' + (navOpen ? 'nav-open' : 'nav-closed');

  return (
    <div id="app">
      {!navOpen && (
        <button className="nav-fab" title="Show menu" onClick={() => setNavOpen(true)}><Icon name="menu" size={20} /></button>
      )}
      <div className={shellClass}>
        <Sidebar sellerTab={sellerTab} setSellerTab={setSellerTab} navOpen={navOpen} setNavOpen={setNavOpen} />
        {navOpen && <div className="nav-backdrop" onClick={() => setNavOpen(false)} />}
        <main className="main">{content}</main>
      </div>
    </div>
  );
}
