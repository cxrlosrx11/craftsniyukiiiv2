import React, { useState } from 'react';
import { useShop } from '../lib/ShopContext.jsx';

export default function Auth() {
  const { authView, setAuthView, login, signup } = useShop();
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
      await signup(fd.get('shopName'), fd.get('username'), fd.get('email'), fd.get('password'));
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
          <form onSubmit={handleSignup}>
            <div className="form-field">
              <label>Shop name</label>
              <input name="shopName" required />
            </div>
            <div className="form-field">
              <label>Username</label>
              <input name="username" required />
            </div>
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
              {busy ? 'Creating shop…' : 'Create my shop'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
