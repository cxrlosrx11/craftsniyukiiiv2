import React, { useState } from 'react';
import { useShop } from '../lib/ShopContext.jsx';

export default function Invite() {
  const { shop } = useShop();
  const [copied, setCopied] = useState(false);
  const slug = shop.showcaseSlug || shop.username;
  const link = `${window.location.origin}/shop/${slug}`;
  const message = `Hi! Check out my shop "${shop.shopName}" here: ${link}`;

  function copyMessage() {
    navigator.clipboard.writeText(message).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div>
      <div className="page-head">
        <div><h1>Invite buyers</h1><p>Share your shop with buyers directly.</p></div>
      </div>
      <div className="panel">
        <div className="panel-head"><div className="panel-title">Ready-to-send message</div></div>
        <textarea readOnly rows={3} value={message} style={{ width: '100%' }} />
        <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={copyMessage}>
          {copied ? 'Copied!' : 'Copy message'}
        </button>
      </div>
    </div>
  );
}
