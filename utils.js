import { CURRENCIES, FX_TO_PHP } from './constants';

export function uid(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function money(n, currency) {
  const v = Number(n || 0);
  const cur = currency || 'PHP';
  const meta = CURRENCIES[cur] || CURRENCIES.USD;
  const digits = cur === 'JPY' ? 0 : 2;
  return meta.symbol + v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function toPHP(amount, currency) {
  return Number(amount || 0) * (FX_TO_PHP[currency] || 1);
}

export function fromPHP(phpAmount, currency) {
  return phpAmount / (FX_TO_PHP[currency] || 1);
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function fmtDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function fmtDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }) +
    ', ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function resizeImageFile(file, maxDim) {
  return new Promise((resolve) => {
    if (!file || !file.type || file.type.indexOf('image/') !== 0) { resolve(null); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > h && w > maxDim) { h = Math.round(h * (maxDim / w)); w = maxDim; }
        else if (h > maxDim) { w = Math.round(w * (maxDim / h)); h = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        try { resolve(canvas.toDataURL('image/jpeg', 0.82)); }
        catch (e) { resolve(reader.result); }
      };
      img.onerror = () => resolve(null);
      img.src = reader.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

// Center-crops an image to a wide banner (3:1) and keeps it small enough to store with the profile.
export function coverFromFile(file, w = 1200, h = 400, maxChars = 240000) {
  return new Promise((resolve) => {
    if (!file || !file.type || file.type.indexOf('image/') !== 0) { resolve(null); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const target = w / h;
        let sw = img.width, sh = img.height, sx = 0, sy = 0;
        if (img.width / img.height > target) { sw = Math.round(img.height * target); sx = Math.round((img.width - sw) / 2); }
        else { sh = Math.round(img.width / target); sy = Math.round((img.height - sh) / 2); }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
        for (const q of [0.78, 0.62, 0.48]) {
          try {
            const url = canvas.toDataURL('image/jpeg', q);
            if (url.length <= maxChars) { resolve(url); return; }
          } catch (e) { resolve(null); return; }
        }
        resolve(null);
      };
      img.onerror = () => resolve(null);
      img.src = reader.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}
