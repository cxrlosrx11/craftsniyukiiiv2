export const CATEGORIES = ['Pins', 'Prints', 'Charms', 'Stickers', 'Standees', 'Sets', 'Apparel', 'Other'];

export const CATEGORY_EMOJI = {
  Pins: '📌', Prints: '🖼️', Charms: '🌸', Stickers: '✨',
  Standees: '🌟', Sets: '🎁', Apparel: '👜', Other: '🩷'
};

export const CURRENCIES = {
  PHP: { symbol: '₱', label: 'Philippine Peso' },
  USD: { symbol: '$', label: 'US Dollar' },
  EUR: { symbol: '€', label: 'Euro' },
  GBP: { symbol: '£', label: 'British Pound' },
  JPY: { symbol: '¥', label: 'Japanese Yen' },
  CAD: { symbol: 'CA$', label: 'Canadian Dollar' },
  AUD: { symbol: 'AU$', label: 'Australian Dollar' }
};

export const COST_TYPES = ['Shipping', 'Booth fees', 'Travel & hotel', 'Other business expenses'];

export const FX_TO_PHP = { PHP: 1, USD: 58, EUR: 63, GBP: 73, JPY: 0.39, CAD: 42, AUD: 38 };

export function defaultShopData() {
  return {
    products: [], sales: [], conventions: [], costs: [],
    feedback: [], stockLog: [], customCategories: [], customCostTypes: []
  };
}
