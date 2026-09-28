import React, { useState } from 'react';
import { useShop } from '../lib/ShopContext.jsx';

export default function Auth() {
  const { authView, setAuthView, authRole, setAuthRole, login, signup, signupBuyer } = useShop();
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [pwVisible, setPwVisible] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    setErrorMsg(''); setBusy(true);
    try {
      await login(fd.get('identifier'), fd.get('password'));
    } catch (err) {
      setErrorMsg((err && err.friendly) || 'No matching account. Check your details and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSignup(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    setErrorMsg(''); setSuccessMsg(''); setBusy(true);
    try {
      if (authRole === 'buyer') {
        await signupBuyer(fd.get('fullName'), fd.get('email'), fd.get('password'), fd.get('phone'));
      } else {
        await signup(fd.get('shopName'), fd.get('username'), fd.get('email'), fd.get('password'));
      }
    } catch (err) {
      if (err && err.isNotice) {
        setSuccessMsg(err.friendly);
        setAuthView('login');
      } else {
        setErrorMsg((err && err.friendly) || 'Something went wrong creating your shop. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  function passwordField(name) {
    return (
      <div style={{ position: 'relative' }}>
        <input name={name} type={pwVisible ? 'text' : 'password'} required minLength={6} />
        <button
          type="button"
          className="link-btn"
          style={{ position: 'absolute', right: 8, top: 8, fontSize: 12 }}
          onClick={() => setPwVisible((v) => !v)}
        >
          {pwVisible ? 'Hide' : 'Show'}
        </button>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <a className="link-btn auth-back" href="#/">← Back to shop</a>
        <div className="auth-brand">
          <div className="auth-logo">CY</div>
          <div className="auth-brand-text">Crafts ni Yukiii</div>
        </div>
        <div className="tab-switch">
          <button
            type="button"
            className={'tab ' + (authView === 'login' ? 'active' : '')}
            onClick={() => { setAuthView('login'); setErrorMsg(''); setSuccessMsg(''); }}
          >
            Log in
          </button>
          <button
            type="button"
            className={'tab ' + (authView === 'signup' ? 'active' : '')}
            onClick={() => { setAuthView('signup'); setErrorMsg(''); setSuccessMsg(''); }}
          >
            Sign up
          </button>
        </div>

        {authView === 'login' ? (
          <form onSubmit={handleLogin}>
            <div className="form-field">
              <label>Username or email</label>
              <input name="identifier" required />
              <span className="hint small">Buyers log in with their email. Sellers can use a username or email.</span>
            </div>
            <div className="form-field">
              <label>Password</label>
              {passwordField('password')}
            </div>
            {errorMsg && <div className="form-error">{errorMsg}</div>}
            {successMsg && <div className="form-success">{successMsg}</div>}
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              {busy ? 'Logging in…' : 'Log in'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignup} key={authRole}>
            <div className="chips" style={{ marginBottom: 14 }}>
              <button type="button" className={'chip ' + (authRole === 'buyer' ? 'active' : '')} onClick={() => { setAuthRole('buyer'); setErrorMsg(''); }}>🛍️ I want to buy</button>
              <button type="button" className={'chip ' + (authRole === 'seller' ? 'active' : '')} onClick={() => { setAuthRole('seller'); setErrorMsg(''); }}>🏪 I want to sell</button>
            </div>
            {authRole === 'buyer' ? (
              <>
                <div className="form-field">
                  <label>Full name</label>
                  <input name="fullName" required />
                </div>
                <div className="form-field">
                  <label>Contact number</label>
                  <input name="phone" type="tel" required />
                </div>
              </>
            ) : (
              <>
                <div className="form-field">
                  <label>Shop name</label>
                  <input name="shopName" required />
                </div>
                <div className="form-field">
                  <label>Username</label>
                  <input name="username" required />
                </div>
              </>
            )}
            <div className="form-field">
              <label>Email</label>
              <input name="email" type="email" required />
            </div>
            <div className="form-field">
              <label>Password</label>
              {passwordField('password')}
              <span className="hint small">At least 6 characters.</span>
            </div>
            {errorMsg && <div className="form-error">{errorMsg}</div>}
            {successMsg && <div className="form-success">{successMsg}</div>}
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              {busy ? 'Creating account…' : (authRole === 'buyer' ? 'Create buyer account' : 'Create my shop')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
