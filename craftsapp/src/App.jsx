import React, { useState } from 'react';
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

export default function App() {
  const { booting, shop, loadError, retryLoad } = useShop();
  const [sellerTab, setSellerTab] = useState('overview');
  const [navOpen, setNavOpen] = useState(typeof window === 'undefined' || window.innerWidth > 920);

  if (booting) {
    return <div className="loading-screen">Loading Crafts ni Yukiii…</div>;
  }

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
    return <Auth />;
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
    default: content = <Overview goTo={setSellerTab} />;
  }

  const shellClass = 'shell ' + (navOpen ? 'nav-open' : 'nav-closed');

  return (
    <div id="app">
      {!navOpen && (
        <button className="nav-fab" title="Show menu" onClick={() => setNavOpen(true)}>☰</button>
      )}
      <div className={shellClass}>
        <Sidebar sellerTab={sellerTab} setSellerTab={setSellerTab} navOpen={navOpen} setNavOpen={setNavOpen} />
        {navOpen && <div className="nav-backdrop" onClick={() => setNavOpen(false)} />}
        <main className="main">{content}</main>
      </div>
    </div>
  );
}
