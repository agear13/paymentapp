/**
 * Currency Select Component
 * Dropdown selector for ISO 4217 currency codes
 */

'use client';

import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  flag?: string;
}

// Common currencies with ISO 4217 codes
export const CURRENCIES: Currency[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', flag: '🇸🇬' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', flag: '🇳🇿' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', flag: '🇭🇰' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', flag: '🇨🇭' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', flag: '🇸🇪' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', flag: '🇳🇴' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr', flag: '🇩🇰' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', flag: '🇮🇩' },
];

// Crypto currencies
export const CRYPTO_CURRENCIES: Currency[] = [
  { code: 'HBAR', name: 'Hedera', symbol: 'ℏ' },
  { code: 'USDC', name: 'USD Coin', symbol: 'USDC' },
];

export interface CurrencySelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  includeCrypto?: boolean;
  placeholder?: string;
  className?: string;
}

export const CurrencySelect: React.FC<CurrencySelectProps> = ({
  value,
  onValueChange,
  disabled = false,
  includeCrypto = false,
  placeholder = 'Select currency',
  className,
}) => {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder}>
          {value && (
            <span className="flex items-center gap-2">
              {CURRENCIES.find((c) => c.code === value)?.flag ||
                CRYPTO_CURRENCIES.find((c) => c.code === value)?.symbol}
              <span className="font-medium">{value}</span>
              <span className="text-muted-foreground">
                {CURRENCIES.find((c) => c.code === value)?.name ||
                  CRYPTO_CURRENCIES.find((c) => c.code === value)?.name}
              </span>
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Fiat Currencies</SelectLabel>
          {CURRENCIES.map((currency) => (
            <SelectItem key={currency.code} value={currency.code}>
              <span className="flex items-center gap-2">
                <span>{currency.flag}</span>
                <span className="font-medium">{currency.code}</span>
                <span className="text-muted-foreground">
                  {currency.name} ({currency.symbol})
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
        
        {includeCrypto && (
          <SelectGroup>
            <SelectLabel>Crypto Currencies</SelectLabel>
            {CRYPTO_CURRENCIES.map((currency) => (
              <SelectItem key={currency.code} value={currency.code}>
                <span className="flex items-center gap-2">
                  <span className="font-medium">{currency.code}</span>
                  <span className="text-muted-foreground">
                    {currency.name}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
};

/**
 * Get currency symbol by code
 */
export const getCurrencySymbol = (code: string): string => {
  const currency = [...CURRENCIES, ...CRYPTO_CURRENCIES].find(
    (c) => c.code === code
  );
  return currency?.symbol || code;
};

/**
 * Get currency name by code
 */
export const getCurrencyName = (code: string): string => {
  const currency = [...CURRENCIES, ...CRYPTO_CURRENCIES].find(
    (c) => c.code === code
  );
  return currency?.name || code;
};

/**
 * Format amount with currency
 */
export const formatCurrency = (
  amount: number,
  currencyCode: string,
  options?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  }
): string => {
  const symbol = getCurrencySymbol(currencyCode);
  
  const formattedAmount = amount.toLocaleString('en-US', {
    minimumFractionDigits: options?.minimumFractionDigits ?? 2,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  });

  return `${symbol}${formattedAmount}`;
};













