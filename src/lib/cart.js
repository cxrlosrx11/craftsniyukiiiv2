import { useCallback, useEffect, useState } from 'react';

const KEY = 'cy_cart_v1';

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
}

// Cart lives in the browser so it survives the trip to the sign-up screen.
export function useCart() {
  const [lines, setLines] = useState(read);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch (e) { /* storage unavailable */ }
  }, [lines]);

  const add = useCallback((p, qty = 1) => {
    setLines((prev) => {
      const ex = prev.find((l) => l.shopSlug === p.shopSlug && l.productId === p.id);
      if (ex) {
        return prev.map((l) => (l === ex ? { ...l, stock: p.stock, price: p.price, qty: Math.min(p.stock, l.qty + qty) } : l));
      }
      return [...prev, {
        shopSlug: p.shopSlug, shopName: p.shopName, currency: p.currency,
        productId: p.id, name: p.name, price: p.price, stock: p.stock,
        emoji: p.emoji || '', category: p.category || '', qty: Math.min(p.stock, qty)
      }];
    });
  }, []);

  const setQty = useCallback((shopSlug, productId, qty) => {
    setLines((prev) => prev
      .map((l) => (l.shopSlug === shopSlug && l.productId === productId ? { ...l, qty: Math.min(l.stock, qty) } : l))
      .filter((l) => l.qty > 0));
  }, []);

  const clearShop = useCallback((shopSlug) => setLines((prev) => prev.filter((l) => l.shopSlug !== shopSlug)), []);

  const count = lines.reduce((a, l) => a + l.qty, 0);
  return { lines, add, setQty, clearShop, count };
}
