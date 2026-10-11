// Fixed palettes sellers can pick for their public page. Only these keys are accepted
// (the database checks them too), so nobody can inject arbitrary CSS.
export const THEMES = {
  rose:     { label: 'Rose',     accent: '#EC4899', dark: '#C22B75', soft: '#FCE0EC', softer: '#FFF0F6', border: '#FBDCE9' },
  lavender: { label: 'Lavender', accent: '#8B5CF6', dark: '#6D3FD1', soft: '#EBE3FC', softer: '#F6F2FF', border: '#E3D9FB' },
  mint:     { label: 'Mint',     accent: '#10A37F', dark: '#0B7A5F', soft: '#D5F3EA', softer: '#EEFAF6', border: '#CBEEE1' },
  sky:      { label: 'Sky',      accent: '#3B82F6', dark: '#2563C9', soft: '#DCE9FD', softer: '#EFF5FF', border: '#D3E2FB' },
  peach:    { label: 'Peach',    accent: '#F97316', dark: '#C55A0A', soft: '#FFE4D2', softer: '#FFF3EA', border: '#FFDCC4' },
  slate:    { label: 'Slate',    accent: '#475569', dark: '#334155', soft: '#E2E8F0', softer: '#F1F5F9', border: '#DDE3EA' }
};
export const THEME_KEYS = Object.keys(THEMES);

export function themeStyle(key) {
  const t = THEMES[key] || THEMES.rose;
  return { '--accent': t.accent, '--accent-dark': t.dark, '--accent-soft': t.soft, '--accent-softer': t.softer, '--border': t.border };
}

export const STATUSES = {
  open: 'Open for orders',
  commissions: 'Commissions open',
  away: 'On a break'
};
