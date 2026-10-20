// Tiny global UI helpers: toasts and a styled confirm dialog (instead of the browser's alert/confirm).
const listeners = new Set();
const emit = (e) => listeners.forEach((l) => l(e));

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// type: 'info' | 'success' | 'error'
export function toast(message, type = 'info') {
  emit({ kind: 'toast', id: Math.random().toString(36).slice(2), message: String(message || ''), type });
}

// await confirmDialog('Delete this?', { confirmText: 'Delete', danger: true }) -> true / false
export function confirmDialog(message, opts = {}) {
  return new Promise((resolve) => emit({ kind: 'confirm', message, resolve, ...opts }));
}
