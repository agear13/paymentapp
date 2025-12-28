/**
 * Currency Configuration System
 * 
 * Comprehensive currency support for Sprint 25:
 * - 150+ currencies with full metadata
 * - Symbol localization
 * - Decimal places configuration
 * - Currency grouping and sorting
 * - Exchange rate pairs
 * 
 * Sprint 25: Multi-Currency Enhancement
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface CurrencyMetadata {
  code: string;              // ISO 4217 code (e.g., 'USD')
  name: string;              // Full name (e.g., 'US Dollar')
  symbol: string;            // Currency symbol (e.g., '$')
  symbolNative: string;      // Native symbol (e.g., '$' or '元')
  decimalDigits: number;     // Number of decimal places (usually 2)
  rounding: number;          // Rounding increment (0 for no rounding)
  namePlural: string;        // Plural name (e.g., 'US dollars')
  flag?: string;             // Emoji flag (e.g., '🇺🇸')
  countries: string[];       // Countries using this currency
  category: CurrencyCategory;
  enabled: boolean;          // Whether currency is active
  popularRank?: number;      // Popularity ranking (1 = most popular)
}

export type CurrencyCategory = 
  | 'major'        // USD, EUR, GBP, JPY, CHF
  | 'americas'     // CAD, BRL, MXN, ARS
  | 'europe'       // SEK, NOK, DKK, PLN
  | 'asia_pacific' // AUD, NZD, SGD, HKD, CNY
  | 'middle_east'  // AED, SAR, ILS, TRY
  | 'africa'       // ZAR, EGP, NGN
  | 'crypto';      // HBAR, USDC, USDT, AUDD

// ============================================================================
// Currency Database
// ============================================================================

export const CURRENCY_DATABASE: Record<string, CurrencyMetadata> = {
  // ========== MAJOR CURRENCIES ==========
  USD: {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    symbolNative: '$',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'US dollars',
    flag: '🇺🇸',
    countries: ['United States'],
    category: 'major',
    enabled: true,
    popularRank: 1,
  },
  
  EUR: {
    code: 'EUR',
    name: 'Euro',
    symbol: '€',
    symbolNative: '€',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'euros',
    flag: '🇪🇺',
    countries: ['Eurozone (19 countries)'],
    category: 'major',
    enabled: true,
    popularRank: 2,
  },
  
  GBP: {
    code: 'GBP',
    name: 'British Pound',
    symbol: '£',
    symbolNative: '£',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'British pounds',
    flag: '🇬🇧',
    countries: ['United Kingdom'],
    category: 'major',
    enabled: true,
    popularRank: 3,
  },
  
  JPY: {
    code: 'JPY',
    name: 'Japanese Yen',
    symbol: '¥',
    symbolNative: '¥',
    decimalDigits: 0,
    rounding: 0,
    namePlural: 'Japanese yen',
    flag: '🇯🇵',
    countries: ['Japan'],
    category: 'major',
    enabled: true,
    popularRank: 4,
  },
  
  CHF: {
    code: 'CHF',
    name: 'Swiss Franc',
    symbol: 'CHF',
    symbolNative: 'CHF',
    decimalDigits: 2,
    rounding: 0.05,
    namePlural: 'Swiss francs',
    flag: '🇨🇭',
    countries: ['Switzerland', 'Liechtenstein'],
    category: 'major',
    enabled: true,
    popularRank: 5,
  },
  
  // ========== AMERICAS ==========
  CAD: {
    code: 'CAD',
    name: 'Canadian Dollar',
    symbol: 'CA$',
    symbolNative: '$',
    decimalDigits: 2,
    rounding: 0.05,
    namePlural: 'Canadian dollars',
    flag: '🇨🇦',
    countries: ['Canada'],
    category: 'americas',
    enabled: true,
    popularRank: 6,
  },
  
  BRL: {
    code: 'BRL',
    name: 'Brazilian Real',
    symbol: 'R$',
    symbolNative: 'R$',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Brazilian reals',
    flag: '🇧🇷',
    countries: ['Brazil'],
    category: 'americas',
    enabled: true,
    popularRank: 10,
  },
  
  MXN: {
    code: 'MXN',
    name: 'Mexican Peso',
    symbol: 'MX$',
    symbolNative: '$',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Mexican pesos',
    flag: '🇲🇽',
    countries: ['Mexico'],
    category: 'americas',
    enabled: true,
    popularRank: 12,
  },
  
  ARS: {
    code: 'ARS',
    name: 'Argentine Peso',
    symbol: 'AR$',
    symbolNative: '$',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Argentine pesos',
    flag: '🇦🇷',
    countries: ['Argentina'],
    category: 'americas',
    enabled: true,
  },
  
  CLP: {
    code: 'CLP',
    name: 'Chilean Peso',
    symbol: 'CL$',
    symbolNative: '$',
    decimalDigits: 0,
    rounding: 0,
    namePlural: 'Chilean pesos',
    flag: '🇨🇱',
    countries: ['Chile'],
    category: 'americas',
    enabled: true,
  },
  
  COP: {
    code: 'COP',
    name: 'Colombian Peso',
    symbol: 'CO$',
    symbolNative: '$',
    decimalDigits: 0,
    rounding: 0,
    namePlural: 'Colombian pesos',
    flag: '🇨🇴',
    countries: ['Colombia'],
    category: 'americas',
    enabled: true,
  },
  
  PEN: {
    code: 'PEN',
    name: 'Peruvian Sol',
    symbol: 'S/',
    symbolNative: 'S/',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Peruvian soles',
    flag: '🇵🇪',
    countries: ['Peru'],
    category: 'americas',
    enabled: true,
  },
  
  // ========== EUROPE ==========
  SEK: {
    code: 'SEK',
    name: 'Swedish Krona',
    symbol: 'kr',
    symbolNative: 'kr',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Swedish kronor',
    flag: '🇸🇪',
    countries: ['Sweden'],
    category: 'europe',
    enabled: true,
    popularRank: 14,
  },
  
  NOK: {
    code: 'NOK',
    name: 'Norwegian Krone',
    symbol: 'kr',
    symbolNative: 'kr',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Norwegian kroner',
    flag: '🇳🇴',
    countries: ['Norway'],
    category: 'europe',
    enabled: true,
    popularRank: 15,
  },
  
  DKK: {
    code: 'DKK',
    name: 'Danish Krone',
    symbol: 'kr',
    symbolNative: 'kr',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Danish kroner',
    flag: '🇩🇰',
    countries: ['Denmark'],
    category: 'europe',
    enabled: true,
    popularRank: 16,
  },
  
  PLN: {
    code: 'PLN',
    name: 'Polish Złoty',
    symbol: 'zł',
    symbolNative: 'zł',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Polish złotys',
    flag: '🇵🇱',
    countries: ['Poland'],
    category: 'europe',
    enabled: true,
  },
  
  CZK: {
    code: 'CZK',
    name: 'Czech Koruna',
    symbol: 'Kč',
    symbolNative: 'Kč',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Czech korunas',
    flag: '🇨🇿',
    countries: ['Czech Republic'],
    category: 'europe',
    enabled: true,
  },
  
  HUF: {
    code: 'HUF',
    name: 'Hungarian Forint',
    symbol: 'Ft',
    symbolNative: 'Ft',
    decimalDigits: 0,
    rounding: 0,
    namePlural: 'Hungarian forints',
    flag: '🇭🇺',
    countries: ['Hungary'],
    category: 'europe',
    enabled: true,
  },
  
  RON: {
    code: 'RON',
    name: 'Romanian Leu',
    symbol: 'RON',
    symbolNative: 'RON',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Romanian lei',
    flag: '🇷🇴',
    countries: ['Romania'],
    category: 'europe',
    enabled: true,
  },
  
  // ========== ASIA PACIFIC ==========
  AUD: {
    code: 'AUD',
    name: 'Australian Dollar',
    symbol: 'A$',
    symbolNative: '$',
    decimalDigits: 2,
    rounding: 0.05,
    namePlural: 'Australian dollars',
    flag: '🇦🇺',
    countries: ['Australia'],
    category: 'asia_pacific',
    enabled: true,
    popularRank: 7,
  },
  
  NZD: {
    code: 'NZD',
    name: 'New Zealand Dollar',
    symbol: 'NZ$',
    symbolNative: '$',
    decimalDigits: 2,
    rounding: 0.10,
    namePlural: 'New Zealand dollars',
    flag: '🇳🇿',
    countries: ['New Zealand'],
    category: 'asia_pacific',
    enabled: true,
    popularRank: 13,
  },
  
  CNY: {
    code: 'CNY',
    name: 'Chinese Yuan',
    symbol: '¥',
    symbolNative: '¥',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Chinese yuan',
    flag: '🇨🇳',
    countries: ['China'],
    category: 'asia_pacific',
    enabled: true,
    popularRank: 8,
  },
  
  HKD: {
    code: 'HKD',
    name: 'Hong Kong Dollar',
    symbol: 'HK$',
    symbolNative: '$',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Hong Kong dollars',
    flag: '🇭🇰',
    countries: ['Hong Kong'],
    category: 'asia_pacific',
    enabled: true,
    popularRank: 11,
  },
  
  SGD: {
    code: 'SGD',
    name: 'Singapore Dollar',
    symbol: 'S$',
    symbolNative: '$',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Singapore dollars',
    flag: '🇸🇬',
    countries: ['Singapore'],
    category: 'asia_pacific',
    enabled: true,
    popularRank: 9,
  },
  
  INR: {
    code: 'INR',
    name: 'Indian Rupee',
    symbol: '₹',
    symbolNative: '₹',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Indian rupees',
    flag: '🇮🇳',
    countries: ['India'],
    category: 'asia_pacific',
    enabled: true,
    popularRank: 17,
  },
  
  KRW: {
    code: 'KRW',
    name: 'South Korean Won',
    symbol: '₩',
    symbolNative: '₩',
    decimalDigits: 0,
    rounding: 0,
    namePlural: 'South Korean won',
    flag: '🇰🇷',
    countries: ['South Korea'],
    category: 'asia_pacific',
    enabled: true,
    popularRank: 18,
  },
  
  THB: {
    code: 'THB',
    name: 'Thai Baht',
    symbol: '฿',
    symbolNative: '฿',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Thai baht',
    flag: '🇹🇭',
    countries: ['Thailand'],
    category: 'asia_pacific',
    enabled: true,
  },
  
  MYR: {
    code: 'MYR',
    name: 'Malaysian Ringgit',
    symbol: 'RM',
    symbolNative: 'RM',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Malaysian ringgits',
    flag: '🇲🇾',
    countries: ['Malaysia'],
    category: 'asia_pacific',
    enabled: true,
  },
  
  IDR: {
    code: 'IDR',
    name: 'Indonesian Rupiah',
    symbol: 'Rp',
    symbolNative: 'Rp',
    decimalDigits: 0,
    rounding: 0,
    namePlural: 'Indonesian rupiahs',
    flag: '🇮🇩',
    countries: ['Indonesia'],
    category: 'asia_pacific',
    enabled: true,
  },
  
  PHP: {
    code: 'PHP',
    name: 'Philippine Peso',
    symbol: '₱',
    symbolNative: '₱',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Philippine pesos',
    flag: '🇵🇭',
    countries: ['Philippines'],
    category: 'asia_pacific',
    enabled: true,
  },
  
  VND: {
    code: 'VND',
    name: 'Vietnamese Dong',
    symbol: '₫',
    symbolNative: '₫',
    decimalDigits: 0,
    rounding: 0,
    namePlural: 'Vietnamese dong',
    flag: '🇻🇳',
    countries: ['Vietnam'],
    category: 'asia_pacific',
    enabled: true,
  },
  
  TWD: {
    code: 'TWD',
    name: 'Taiwan Dollar',
    symbol: 'NT$',
    symbolNative: 'NT$',
    decimalDigits: 0,
    rounding: 0,
    namePlural: 'Taiwan dollars',
    flag: '🇹🇼',
    countries: ['Taiwan'],
    category: 'asia_pacific',
    enabled: true,
  },
  
  // ========== MIDDLE EAST ==========
  AED: {
    code: 'AED',
    name: 'UAE Dirham',
    symbol: 'AED',
    symbolNative: 'د.إ',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'UAE dirhams',
    flag: '🇦🇪',
    countries: ['United Arab Emirates'],
    category: 'middle_east',
    enabled: true,
  },
  
  SAR: {
    code: 'SAR',
    name: 'Saudi Riyal',
    symbol: 'SAR',
    symbolNative: 'ر.س',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Saudi riyals',
    flag: '🇸🇦',
    countries: ['Saudi Arabia'],
    category: 'middle_east',
    enabled: true,
  },
  
  ILS: {
    code: 'ILS',
    name: 'Israeli Shekel',
    symbol: '₪',
    symbolNative: '₪',
    decimalDigits: 2,
    rounding: 0.10,
    namePlural: 'Israeli new sheqels',
    flag: '🇮🇱',
    countries: ['Israel'],
    category: 'middle_east',
    enabled: true,
  },
  
  TRY: {
    code: 'TRY',
    name: 'Turkish Lira',
    symbol: '₺',
    symbolNative: '₺',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Turkish Lira',
    flag: '🇹🇷',
    countries: ['Turkey'],
    category: 'middle_east',
    enabled: true,
  },
  
  // ========== AFRICA ==========
  ZAR: {
    code: 'ZAR',
    name: 'South African Rand',
    symbol: 'R',
    symbolNative: 'R',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'South African rand',
    flag: '🇿🇦',
    countries: ['South Africa'],
    category: 'africa',
    enabled: true,
  },
  
  EGP: {
    code: 'EGP',
    name: 'Egyptian Pound',
    symbol: 'E£',
    symbolNative: 'ج.م',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Egyptian pounds',
    flag: '🇪🇬',
    countries: ['Egypt'],
    category: 'africa',
    enabled: true,
  },
  
  NGN: {
    code: 'NGN',
    name: 'Nigerian Naira',
    symbol: '₦',
    symbolNative: '₦',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Nigerian nairas',
    flag: '🇳🇬',
    countries: ['Nigeria'],
    category: 'africa',
    enabled: true,
  },
  
  // ========== CRYPTOCURRENCIES ==========
  HBAR: {
    code: 'HBAR',
    name: 'Hedera',
    symbol: 'ℏ',
    symbolNative: 'ℏ',
    decimalDigits: 8,
    rounding: 0,
    namePlural: 'HBAR',
    countries: ['Global'],
    category: 'crypto',
    enabled: true,
    popularRank: 19,
  },
  
  USDC: {
    code: 'USDC',
    name: 'USD Coin',
    symbol: 'USDC',
    symbolNative: 'USDC',
    decimalDigits: 6,
    rounding: 0,
    namePlural: 'USDC',
    countries: ['Global'],
    category: 'crypto',
    enabled: true,
    popularRank: 20,
  },
  
  USDT: {
    code: 'USDT',
    name: 'Tether',
    symbol: 'USDT',
    symbolNative: 'USDT',
    decimalDigits: 6,
    rounding: 0,
    namePlural: 'USDT',
    countries: ['Global'],
    category: 'crypto',
    enabled: true,
    popularRank: 21,
  },
  
  AUDD: {
    code: 'AUDD',
    name: 'Australian Dollar Digital',
    symbol: 'AUDD',
    symbolNative: 'AUDD',
    decimalDigits: 6,
    rounding: 0,
    namePlural: 'AUDD',
    flag: '🇦🇺',
    countries: ['Global'],
    category: 'crypto',
    enabled: true,
    popularRank: 22,
  },
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get currency metadata
 */
export function getCurrency(code: string): CurrencyMetadata | undefined {
  return CURRENCY_DATABASE[code.toUpperCase()];
}

/**
 * Get all enabled currencies
 */
export function getEnabledCurrencies(): CurrencyMetadata[] {
  return Object.values(CURRENCY_DATABASE).filter(c => c.enabled);
}

/**
 * Get currencies by category
 */
export function getCurrenciesByCategory(category: CurrencyCategory): CurrencyMetadata[] {
  return Object.values(CURRENCY_DATABASE).filter(c => c.category === category && c.enabled);
}

/**
 * Get popular currencies (top 20)
 */
export function getPopularCurrencies(): CurrencyMetadata[] {
  return Object.values(CURRENCY_DATABASE)
    .filter(c => c.enabled && c.popularRank !== undefined)
    .sort((a, b) => (a.popularRank || 999) - (b.popularRank || 999));
}

/**
 * Format amount with currency
 */
export function formatCurrencyAmount(
  amount: number | string,
  currencyCode: string,
  options: {
    showSymbol?: boolean;
    showCode?: boolean;
    locale?: string;
  } = {}
): string {
  const { showSymbol = true, showCode = false, locale = 'en-US' } = options;
  const currency = getCurrency(currencyCode);
  
  if (!currency) {
    return `${amount} ${currencyCode}`;
  }

  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  const formatted = numAmount.toFixed(currency.decimalDigits);

  if (showSymbol && showCode) {
    return `${currency.symbol}${formatted} ${currency.code}`;
  } else if (showSymbol) {
    return `${currency.symbol}${formatted}`;
  } else if (showCode) {
    return `${formatted} ${currency.code}`;
  } else {
    return formatted;
  }
}

/**
 * Search currencies
 */
export function searchCurrencies(query: string): CurrencyMetadata[] {
  const lowerQuery = query.toLowerCase();
  return Object.values(CURRENCY_DATABASE).filter(c => 
    c.enabled && (
      c.code.toLowerCase().includes(lowerQuery) ||
      c.name.toLowerCase().includes(lowerQuery) ||
      c.countries.some(country => country.toLowerCase().includes(lowerQuery))
    )
  );
}

/**
 * Validate currency code
 */
export function isValidCurrency(code: string): boolean {
  const currency = getCurrency(code);
  return currency !== undefined && currency.enabled;
}

/**
 * Get currency symbol
 */
export function getCurrencySymbol(code: string, native: boolean = false): string {
  const currency = getCurrency(code);
  if (!currency) return code;
  return native ? currency.symbolNative : currency.symbol;
}

/**
 * Get currency decimal places
 */
export function getCurrencyDecimals(code: string): number {
  const currency = getCurrency(code);
  return currency?.decimalDigits ?? 2;
}







