import React, { useState } from 'react';
import { useShop } from '../lib/ShopContext.jsx';
import { uid } from '../lib/utils.js';
import { CATEGORIES } from '../lib/constants.js';

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (!lines.length) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((c) => c.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = cells[i] || ''; });
    return row;
  });
}

export default function ImportTab({ goTo }) {
  const { mutate } = useShop();
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  function onFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setErrorMsg(''); setSuccessMsg('');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseCSV(String(reader.result));
        if (!parsed.length) { setErrorMsg('No rows found in this file.'); return; }
        setRows(parsed);
      } catch (err) {
        setErrorMsg('Could not parse this CSV file.');
      }
    };
    reader.readAsText(file);
  }

  function doImport() {
    if (!rows.length) return;
    let imported = 0;
    mutate((d) => {
      rows.forEach((r) => {
        const name = r.name || r.product || '';
        const price = parseFloat(r.price);
        if (!name || isNaN(price)) return;
        const category = r.category || 'Other';
        if (category && !CATEGORIES.includes(category) && !d.customCategories.includes(category)) {
          d.customCategories.push(category);
        }
        d.products.push({
          id: uid('prod'), name, category, ip: r.ip || '', price,
          cost: parseFloat(r.cost) || 0, stock: parseInt(r.stock, 10) || 0,
          lowStockAt: parseInt(r.lowstockat || r.low_stock_at, 10) || 0,
          emoji: r.emoji || '', image: '', archived: false, notes: r.notes || ''
        });
        imported++;
      });
    });
    setSuccessMsg(`Imported ${imported} products.`);
    setRows([]); setFileName('');
  }

  return (
    <div>
      <div className="page-head">
        <div><h1>Import products</h1><p>Bulk-add products from a CSV file.</p></div>
      </div>

      <div className="panel">
        <div className="panel-head"><div className="panel-title">CSV format</div></div>
        <p className="hint">
          Columns: name, category, ip, price, cost, stock, lowStockAt, emoji, notes.
          Only "name" and "price" are required — the rest are optional.
        </p>
        <input type="file" accept=".csv,text/csv" onChange={onFile} />
        {fileName && <p className="hint">Selected: {fileName}</p>}
        {errorMsg && <div className="form-error">{errorMsg}</div>}
        {successMsg && <div className="form-success">{successMsg}</div>}
      </div>

      {rows.length > 0 && (
        <div className="panel">
          <div className="panel-head"><div className="panel-title">Preview ({rows.length} rows)</div></div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr>{Object.keys(rows[0]).map((h) => <th key={h} style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid var(--border)' }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(0, 20).map((r, i) => (
                  <tr key={i}>{Object.keys(rows[0]).map((h) => <td key={h} style={{ padding: 6, borderBottom: '1px solid var(--border)' }}>{r[h]}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 20 && <p className="hint">Showing first 20 of {rows.length} rows.</p>}
          <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={doImport}>Import {rows.length} products</button>
        </div>
      )}
    </div>
  );
}
