import React, { useState } from 'react';
import Icon from './Icon.jsx';
import { useShop } from '../lib/ShopContext.jsx';
import { shopLink } from '../lib/router.js';
import { toast } from '../lib/ui.js';

const DISMISS_KEY = 'cy_getting_started_dismissed';

// A short checklist for new shops. Disappears once the basics are done (or when dismissed).
export default function GettingStarted({ goTo }) {
  const { shop, data } = useShop();
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch (e) { return false; } });
  const hasProducts = (data.products || []).length > 0;
  const hasSales = (data.sales || []).length > 0;
  if (hidden || (hasProducts && hasSales)) return null;

  const slug = shop.showcaseSlug || shop.username;
  const steps = [
    { done: hasProducts, icon: 'package', title: 'Add your first product', text: 'Photos, price and stock. It takes a minute.', action: 'Add product', go: () => goTo('products') },
    { done: hasSales, icon: 'cart', title: 'Record your first sale', text: 'Use On-site sales at a booth, or confirm an online order.', action: 'Open On-site sales', go: () => goTo('pos') },
    { done: false, icon: 'users', title: 'Make your page yours', text: 'Add a photo, a tagline and pick your page color.', action: 'Edit profile', go: () => goTo('support') },
    { done: false, icon: 'invite', title: 'Share your shop link', text: 'Post it on Instagram or send it to friends.', action: 'Copy link', go: () => { navigator.clipboard.writeText(shopLink(slug)).then(() => toast('Shop link copied', 'success'), () => toast('Could not copy the link', 'error')); } }
  ];
  const done = steps.filter((s) => s.done).length;

  return (
    <div className="panel getting-started">
      <div className="panel-head">
        <div>
          <div className="panel-title"><Icon name="sparkles" size={17} /> Get started</div>
          <div className="order-meta">{done} of {steps.length} done</div>
        </div>
        <button type="button" className="link-btn" onClick={() => { try { localStorage.setItem(DISMISS_KEY, '1'); } catch (e) { /* ignore */ } setHidden(true); }}>Dismiss</button>
      </div>
      <div className="goal-track" style={{ margin: '0 0 8px' }}><div className="goal-fill" style={{ width: Math.round((done / steps.length) * 100) + '%' }} /></div>
      {steps.map((s) => (
        <div className={'gs-step' + (s.done ? ' done' : '')} key={s.title}>
          <span className="gs-check">{s.done ? <Icon name="success" size={22} /> : <Icon name={s.icon} size={18} />}</span>
          <div className="gs-text"><b>{s.title}</b><span>{s.text}</span></div>
          {!s.done && <button type="button" className="btn btn-ghost btn-sm" onClick={s.go}>{s.action}</button>}
        </div>
      ))}
    </div>
  );
}
