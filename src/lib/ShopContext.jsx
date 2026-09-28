import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { sb } from './supabaseClient';
import { loadShopProfile, loadShopData, saveShopData, saveShopProfile, ensureBuyerProfile } from './api';
import { defaultShopData } from './constants';
import { uid } from './utils';

const ShopContext = createContext(null);

export function ShopProvider({ children }) {
  const [booting, setBooting] = useState(true);
  const [authView, setAuthView] = useState('login'); // 'login' | 'signup'
  const [authRole, setAuthRole] = useState('buyer'); // sign-up type: 'buyer' | 'seller'
  const [shop, setShop] = useState(null);
  const [buyer, setBuyer] = useState(null);
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
      if (!shopProfile) {
        const b = await ensureBuyerProfile(session.user);
        if (b) setBuyer(b);
        setBooting(false);
        return;
      }
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
        setBuyer(null);
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
    if (!shopProfile) {
      const b = await ensureBuyerProfile(signInRes.data.user);
      if (b) { setBuyer(b); return { role: 'buyer' }; }
      throw { friendly: 'Signed in, but no account profile was found for this login.' };
    }
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
    return { role: 'seller' };
  }, []);

  const signupBuyer = useCallback(async (fullName, email, password, phone) => {
    if (!fullName || !email || !password || !phone) {
      throw { friendly: 'Fill in every field to create your buyer account.' };
    }
    const res = await sb.auth.signUp({
      email, password,
      options: { data: { role: 'buyer', full_name: fullName.trim(), phone: phone.trim() } }
    });
    if (res.error) throw { friendly: res.error.message || 'Could not create your account.' };
    // Supabase hides "already registered" behind a fake user with no identities.
    if (res.data.user && Array.isArray(res.data.user.identities) && res.data.user.identities.length === 0) {
      throw { friendly: 'That email is already registered (buyer and seller accounts cannot share one email). Log in instead, or use a different email.' };
    }
    if (!res.data.user || !res.data.session) {
      throw { isNotice: true, friendly: 'Check your email to confirm your account, then log in.' };
    }
    const b = await ensureBuyerProfile(res.data.user);
    if (!b) throw { friendly: 'Your account was created, but the buyer profile could not be saved. Try logging in.' };
    setBuyer(b);
  }, []);

  const signup = useCallback(async (shopName, username, email, password) => {
    if (!shopName || !username || !email || !password) {
      throw { friendly: 'Fill in every field to create your shop.' };
    }
    const signUpRes = await sb.auth.signUp({ email, password });
    if (signUpRes.error) throw { friendly: signUpRes.error.message || 'Could not create your account.' };
    if (signUpRes.data.user && Array.isArray(signUpRes.data.user.identities) && signUpRes.data.user.identities.length === 0) {
      throw { friendly: 'That email is already registered (buyer and seller accounts cannot share one email). Log in instead, or use a different email.' };
    }
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
    setBuyer(null);
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
    booting, authView, setAuthView, authRole, setAuthRole, shop, buyer, setBuyer, signupBuyer, data, dataLoaded, loadError,
    mutate, login, signup, logout, retryLoad, updateShopProfile, uid
  };

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error('useShop must be used inside ShopProvider');
  return ctx;
}
