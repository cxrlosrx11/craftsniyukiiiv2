import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { sb } from './supabaseClient';
import { loadShopProfile, loadShopData, saveShopData, saveShopProfile } from './api';
import { defaultShopData } from './constants';
import { uid } from './utils';

const ShopContext = createContext(null);

export function ShopProvider({ children }) {
  const [booting, setBooting] = useState(true);
  const [authView, setAuthView] = useState('login'); // 'login' | 'signup'
  const [shop, setShop] = useState(null);
  const [data, setData] = useState(defaultShopData());
  // dataLoaded gates saveShopData — it can only ever be true right after a
  // confirmed successful load. See lib/api.js for why this matters.
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const dataRef = useRef(data);
  dataRef.current = data;

  const bootstrap = useCallback(async () => {
    setLoadError(false);
    try {
      const { data: sess } = await sb.auth.getSession();
      const session = sess && sess.session;
      if (!session) { setBooting(false); return; }
      const shopProfile = await loadShopProfile(session.user.id);
      if (!shopProfile) { setBooting(false); return; }
      setShop(shopProfile);
      try {
        const d = await loadShopData(shopProfile.id);
        setData(d);
        setDataLoaded(true);
      } catch (err) {
        console.error('Failed to load shop data on session restore:', err);
        setData(defaultShopData());
        setDataLoaded(false);
        setLoadError(true);
      }
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => { bootstrap(); }, [bootstrap]);

  useEffect(() => {
    const { data: sub } = sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setShop(null);
        setData(defaultShopData());
        setDataLoaded(false);
      }
    });
    return () => sub && sub.subscription && sub.subscription.unsubscribe();
  }, []);

  // Apply a synchronous mutator function to a deep-cloned copy of the data,
  // commit it to state, and kick off a debounced save — mirroring the
  // original app's "mutate state.data directly, then call saveShopData()".
  const mutate = useCallback((mutator) => {
    const next = structuredClone(dataRef.current);
    mutator(next);
    setData(next);
    if (shop) saveShopData(shop.id, next, dataLoaded);
    return next;
  }, [shop, dataLoaded]);

  const login = useCallback(async (identifier, password) => {
    const idf = (identifier || '').trim().toLowerCase();
    if (!idf || !password) throw { friendly: 'Enter your username/email and password.' };
    let email = idf;
    if (idf.indexOf('@') === -1) {
      const res = await sb.rpc('email_for_username', { uname: idf });
      email = res.data;
    }
    if (!email) throw { friendly: 'No matching account. Check your details and try again.' };
    const signInRes = await sb.auth.signInWithPassword({ email, password });
    if (signInRes.error) throw { friendly: 'No matching account. Check your details and try again.' };
    const shopProfile = await loadShopProfile(signInRes.data.user.id);
    if (!shopProfile) throw { friendly: 'Signed in, but no shop profile was found for this account.' };
    setShop(shopProfile);
    let d;
    try {
      d = await loadShopData(shopProfile.id);
    } catch (err) {
      console.error('Failed to load shop data on login:', err);
      throw { friendly: "Logged in, but we couldn't load your shop data. Please wait a moment and try logging in again." };
    }
    setData(d);
    setDataLoaded(true);
    setLoadError(false);
  }, []);

  const signup = useCallback(async (shopName, username, email, password) => {
    if (!shopName || !username || !email || !password) {
      throw { friendly: 'Fill in every field to create your shop.' };
    }
    const signUpRes = await sb.auth.signUp({ email, password });
    if (signUpRes.error) throw { friendly: signUpRes.error.message || 'Could not create your account.' };
    const userId = signUpRes.data.user && signUpRes.data.user.id;
    if (!userId) {
      throw { isNotice: true, friendly: 'Check your email to confirm your account, then log in.' };
    }
    const insertRes = await sb.from('shops').insert({
      id: userId, shop_name: shopName, username: username.trim().toLowerCase(),
      email, currency: 'PHP'
    }).select().maybeSingle();
    if (insertRes.error) throw { friendly: insertRes.error.message || 'Could not create your shop profile.' };
    await sb.from('shop_data').insert({ shop_id: userId, data: defaultShopData() });
    const shopProfile = insertRes.data ? {
      id: insertRes.data.id, shopName: insertRes.data.shop_name, username: insertRes.data.username,
      email: insertRes.data.email, currency: insertRes.data.currency, showcaseSlug: insertRes.data.showcase_slug,
      createdAt: insertRes.data.created_at
    } : null;
    setShop(shopProfile);
    setData(defaultShopData());
    setDataLoaded(true);
  }, []);

  const logout = useCallback(async () => {
    await sb.auth.signOut();
    setShop(null);
    setData(defaultShopData());
    setDataLoaded(false);
  }, []);

  const retryLoad = useCallback(async () => {
    if (!shop) return;
    setLoadError(false);
    try {
      const d = await loadShopData(shop.id);
      setData(d);
      setDataLoaded(true);
    } catch (err) {
      console.error('Retry failed to load shop data:', err);
      setDataLoaded(false);
      setLoadError(true);
    }
  }, [shop]);

  const updateShopProfile = useCallback((patch) => {
    setShop((prev) => {
      const next = { ...prev, ...patch };
      saveShopProfile(next);
      return next;
    });
  }, []);

  const value = {
    booting, authView, setAuthView, shop, data, dataLoaded, loadError,
    mutate, login, signup, logout, retryLoad, updateShopProfile, uid
  };

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error('useShop must be used inside ShopProvider');
  return ctx;
}
