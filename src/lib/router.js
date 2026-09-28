import { useEffect, useState } from 'react';

// Hash routing works on GitHub Pages (no server-side rewrites needed).
//   #/               -> shop (landing page)
//   #/shop/<slug>    -> one seller's shop
//   #/login          -> sign in / sign up
//   #/dashboard      -> seller dashboard (requires login)
export function parseHash() {
  const h = (window.location.hash || '').replace(/^#/, '') || '/';
  const parts = h.split('/').filter(Boolean);
  if (parts[0] === 'shop' && parts[1]) return { name: 'shop', slug: decodeURIComponent(parts[1]) };
  if (parts[0] === 'login') return { name: 'login' };
  if (parts[0] === 'dashboard') return { name: 'dashboard' };
  return { name: 'home' };
}

export function navigate(path) {
  window.location.hash = path;
}

export function shopLink(slug) {
  return `${window.location.origin}${window.location.pathname}#/shop/${encodeURIComponent(slug)}`;
}

export function useRoute() {
  const [route, setRoute] = useState(parseHash());
  useEffect(() => {
    const onChange = () => { setRoute(parseHash()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
