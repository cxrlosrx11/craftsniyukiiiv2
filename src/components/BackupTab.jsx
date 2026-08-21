import React, { useState } from 'react';
import { useShop } from '../lib/ShopContext.jsx';

export default function BackupTab() {
  const { shop, data, mutate } = useShop();
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  function exportBackup() {
    const payload = { exportedAt: new Date().toISOString(), shop: shop.shopName, data };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${shop.username}-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onImportFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setErrorMsg(''); setSuccessMsg('');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const incoming = parsed.data || parsed;
        if (!incoming || typeof incoming !== 'object' || !Array.isArray(incoming.products)) {
          setErrorMsg('This file does not look like a valid backup.');
          return;
        }
        if (!confirm('This will REPLACE your current shop data with the contents of this backup. Continue?')) return;
        mutate((d) => {
          Object.assign(d, incoming);
        });
        setSuccessMsg('Backup restored.');
      } catch (err) {
        setErrorMsg('Could not read this file — is it a valid JSON backup?');
      }
    };
    reader.readAsText(file);
  }

  return (
    <div>
      <div className="page-head">
        <div><h1>Backup & restore</h1><p>Your Supabase plan has no automatic backups — keep your own copies here.</p></div>
      </div>

      <div className="panel">
        <div className="panel-head"><div className="panel-title">Export a backup</div></div>
        <p className="hint">Downloads a JSON file with all your products, sales, conventions, expenses, and feedback. Do this regularly.</p>
        <button className="btn btn-primary" onClick={exportBackup}>⬇ Download backup</button>
      </div>

      <div className="panel">
        <div className="panel-head"><div className="panel-title">Restore from a backup</div></div>
        <p className="hint">⚠️ This replaces all current data with the backup file's contents. This cannot be undone.</p>
        <input type="file" accept="application/json" onChange={onImportFile} />
        {errorMsg && <div className="form-error">{errorMsg}</div>}
        {successMsg && <div className="form-success">{successMsg}</div>}
      </div>
    </div>
  );
}
