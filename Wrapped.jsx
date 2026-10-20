import React, { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { useShop } from '../lib/ShopContext.jsx';
import { shopLink } from '../lib/router.js';
import { money } from '../lib/utils.js';
import { loadSupport } from '../lib/support.js';
import { fetchProfile } from '../lib/social.js';
import { listEvents } from '../lib/pickups.js';
import { computeWrapped, periodRange, drawWrapped } from '../lib/wrapped.js';

function loadImg(src) {
  return new Promise((resolve) => {
    if (!src || !String(src).startsWith('data:image/')) { resolve(null); return; }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export default function Wrapped() {
  const { shop, data } = useShop();
  const cur = shop.currency || 'PHP';
  const slug = shop.showcaseSlug || shop.username;
  const canvasRef = useRef(null);
  const [period, setPeriod] = useState('last30');
  const [format, setFormat] = useState('story');
  const [showRevenue, setShowRevenue] = useState(false);
  const [look, setLook] = useState({ themeKey: 'rose', avatar: '' });
  const [followers, setFollowers] = useState(null);
  const [events, setEvents] = useState([]);
  const [ready, setReady] = useState(false);
  const [stats, setStats] = useState(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    loadSupport(shop.id).then((s) => setLook({ themeKey: s.theme || 'rose', avatar: s.avatar || '' })).catch(() => {});
    fetchProfile(slug).then((p) => p && setFollowers(p.followers)).catch(() => {});
    listEvents(shop.id).then(setEvents).catch(() => {});
    // eslint-disable-next-line
  }, []);

  const options = useMemo(() => {
    const base = [['last30', 'Last 30 days'], ['month', 'This month'], ['year', 'This year'], ['all', 'All time']];
    const conv = (data.conventions || []).filter((c) => c.date).map((c) => [`conv:${c.id}`, `${c.name} (${c.date})`]);
    const ev = events.map((e) => [`event:${e.id}`, `${e.name} (Convention Mode)`]);
    return [...base, ...conv, ...ev];
  }, [data.conventions, events]);

  const range = useMemo(() => {
    if (period.startsWith('conv:')) {
      const c = (data.conventions || []).find((x) => `conv:${x.id}` === period);
      if (c) return periodRange('day', { day: c.date, name: c.name });
    }
    if (period.startsWith('event:')) {
      const e = events.find((x) => `event:${x.id}` === period);
      if (e) return periodRange('range', { from: e.starts_on, to: e.ends_on, name: e.name });
    }
    return periodRange(['last30', 'month', 'year', 'all'].includes(period) ? period : 'last30');
  }, [period, data.conventions, events]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const st = computeWrapped(data, range.from, range.to);
      const avatarImg = await loadImg(look.avatar);
      const images = {};
      for (const p of st.topProducts) {
        const prod = (data.products || []).find((x) => x.id === p.id);
        const img = prod ? await loadImg(prod.image) : null;
        if (img) images[p.id] = img;
      }
      if (cancelled || !canvasRef.current) return;
      drawWrapped(canvasRef.current, st, {
        format, themeKey: look.themeKey, shopName: shop.shopName, username: shop.username, avatarImg, images,
        periodLabel: range.label, showRevenue, money: (v) => money(v, cur),
        link: shopLink(slug).replace(/^https?:\/\//, ''), followers
      });
      setStats(st); setReady(true);
    })();
    return () => { cancelled = true; };
  }, [data.sales, data.products, range, format, showRevenue, look, followers, shop.shopName, shop.username, cur, slug]);

  function blobOf(cb) {
    const c = canvasRef.current;
    if (!c) return;
    try { c.toBlob(cb, 'image/png'); } catch (e) { setNote("Couldn't create the image in this browser."); }
  }
  function download() {
    blobOf((blob) => {
      if (!blob) { setNote("Couldn't create the image."); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${slug}-wrapped-${format}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
  }
  const canShare = typeof navigator !== 'undefined' && !!navigator.share && !!navigator.canShare;
  function share() {
    blobOf(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `${slug}-wrapped.png`, { type: 'image/png' });
      try {
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: `${shop.shopName} Wrapped`, text: `My ${range.label.toLowerCase()} Wrapped on Crafts ni Yukiii` });
        } else setNote('Sharing images is not supported here. Use Download instead.');
      } catch (e) { /* the person closed the share sheet */ }
    });
  }

  return (
    <div>
      <div className="page-head">
        <div><h1>Wrapped</h1><p>A shareable summary of your sales to post on social media. It shows only what you choose.</p></div>
      </div>
      <div className="wrapped-layout">
        <div className="panel wrapped-controls">
          <div className="form-field"><label>Period</label>
            <select value={period} onChange={(e) => setPeriod(e.target.value)}>
              {options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div className="form-field"><label>Size</label>
            <div className="chips" style={{ margin: 0 }}>
              <button type="button" className={'chip ' + (format === 'story' ? 'active' : '')} onClick={() => setFormat('story')}>Story (9:16)</button>
              <button type="button" className={'chip ' + (format === 'square' ? 'active' : '')} onClick={() => setFormat('square')}>Square (1:1)</button>
            </div>
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600, marginBottom: 14 }}>
            <input type="checkbox" checked={showRevenue} onChange={(e) => setShowRevenue(e.target.checked)} /> Show how much I earned
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" disabled={!ready || !(stats && stats.hasSales)} onClick={download}><Icon name="download" size={16} /> Download image</button>
            {canShare && <button className="btn btn-ghost" disabled={!ready || !(stats && stats.hasSales)} onClick={share}>Share…</button>}
          </div>
          {stats && !stats.hasSales && <p className="hint small">No sales in this period yet. Pick a longer period, or record some sales first.</p>}
          {note && <p className="form-error">{note}</p>}
          <p className="hint small">The picture uses your page color and profile photo from the Profile &amp; support tab. Your shop link is at the bottom, so people who see it can find you.</p>
        </div>
        <div className="wrapped-preview">
          <canvas ref={canvasRef} className="wrapped-canvas" style={{ maxWidth: format === 'story' ? 320 : 460 }} aria-label="Preview of your Wrapped image" />
        </div>
      </div>
    </div>
  );
}
