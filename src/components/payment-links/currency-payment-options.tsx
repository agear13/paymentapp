'use client';

/**
 * Currency Payment Options Component
 * 
 * Allows customers to select their preferred payment currency
 * Shows conversion rates and amounts in real-time
 * 
 * Sprint 25: Multi-Currency Enhancement
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CurrencyAmountDisplay } from '@/components/currency/currency-amount-display';
import { getCurrency, type CurrencyMetadata } from '@/lib/currency/currency-config';
import { convertCurrency } from '@/lib/currency/currency-converter';
import { ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';

export interface CurrencyPaymentOptionsProps {
  baseAmount: number;
  baseCurrency: string;
  availableCurrencies: string[];
  selectedCurrency?: string;
  onCurrencyChange: (currency: string) => void;
  showConversionRates?: boolean;
}

export function CurrencyPaymentOptions({
  baseAmount,
  baseCurrency,
  availableCurrencies,
  selectedCurrency,
  onCurrencyChange,
  showConversionRates = true,
}: CurrencyPaymentOptionsProps) {
  const [convertedAmounts, setConvertedAmounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Load conversion rates for all available currencies
  useEffect(() => {
    const loadConversions = async () => {
      setIsLoading(true);
      const amounts: Record<string, number> = {};

      for (const currency of availableCurrencies) {
        if (currency === baseCurrency) {
          amounts[currency] = baseAmount;
        } else {
          try {
            const converted = await convertCurrency(baseAmount, baseCurrency, currency);
            amounts[currency] = converted;
          } catch (error) {
            console.error(`Failed to convert ${baseCurrency} to ${currency}:`, error);
            amounts[currency] = baseAmount; // Fallback
          }
        }
      }

      setConvertedAmounts(amounts);
      setIsLoading(false);
    };

    loadConversions();
  }, [baseAmount, baseCurrency, availableCurrencies]);

  // Calculate conversion rate
  const getConversionRate = (targetCurrency: string): number => {
    if (!convertedAmounts[targetCurrency]) return 1;
    return convertedAmounts[targetCurrency] / baseAmount;
  };

  // Group currencies by type
  const cryptoCurrencies = availableCurrencies.filter(code => {
    const currency = getCurrency(code);
    return currency?.category === 'crypto';
  });

  const fiatCurrencies = availableCurrencies.filter(code => {
    const currency = getCurrency(code);
    return currency?.category !== 'crypto';
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Select Payment Currency</CardTitle>
          <CardDescription>Choose your preferred currency for payment</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {availableCurrencies.map((_, index) => (
              <Skeleton key={index} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Payment Currency</CardTitle>
        <CardDescription>
          Choose your preferred currency. Amounts are converted at current market rates.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={selectedCurrency || baseCurrency}
          onValueChange={onCurrencyChange}
          className="space-y-3"
        >
          {/* Fiat Currencies */}
          {fiatCurrencies.length > 0 && (
            <>
              <div className="text-sm font-semibold text-muted-foreground mb-2">
                Fiat Currencies
              </div>
              {fiatCurrencies.map(currencyCode => (
                <CurrencyOption
                  key={currencyCode}
                  currencyCode={currencyCode}
                  amount={convertedAmounts[currencyCode] || baseAmount}
                  isBase={currencyCode === baseCurrency}
                  conversionRate={getConversionRate(currencyCode)}
                  showRate={showConversionRates && currencyCode !== baseCurrency}
                />
              ))}
            </>
          )}

          {/* Crypto Currencies */}
          {cryptoCurrencies.length > 0 && (
            <>
              <div className="text-sm font-semibold text-muted-foreground mb-2 mt-4">
                Cryptocurrencies
              </div>
              {cryptoCurrencies.map(currencyCode => (
                <CurrencyOption
                  key={currencyCode}
                  currencyCode={currencyCode}
                  amount={convertedAmounts[currencyCode] || baseAmount}
                  isBase={currencyCode === baseCurrency}
                  conversionRate={getConversionRate(currencyCode)}
                  showRate={showConversionRates && currencyCode !== baseCurrency}
                />
              ))}
            </>
          )}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}

interface CurrencyOptionProps {
  currencyCode: string;
  amount: number;
  isBase: boolean;
  conversionRate: number;
  showRate: boolean;
}

function CurrencyOption({
  currencyCode,
  amount,
  isBase,
  conversionRate,
  showRate,
}: CurrencyOptionProps) {
  const currency = getCurrency(currencyCode);

  if (!currency) return null;

  return (
    <div className="flex items-center space-x-3 p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer">
      <RadioGroupItem value={currencyCode} id={currencyCode} />
      <Label
        htmlFor={currencyCode}
        className="flex-1 cursor-pointer flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          {currency.flag && <span className="text-2xl">{currency.flag}</span>}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-lg">
                {currency.code}
              </span>
              {isBase && (
                <Badge variant="secondary" className="text-xs">
                  Base
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              {currency.name}
            </div>
            {showRate && (
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <span>Rate: 1.0000 = {conversionRate.toFixed(4)}</span>
              </div>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold">
            <CurrencyAmountDisplay
              amount={amount}
              currency={currencyCode}
              mode="symbol-only"
              showTooltip={false}
            />
          </div>
        </div>
      </Label>
    </div>
  );
}

/**
 * Compact Currency Selector for inline use
 */
export interface CompactCurrencySelectorProps {
  availableCurrencies: string[];
  selectedCurrency: string;
  onCurrencyChange: (currency: string) => void;
}

export function CompactCurrencySelector({
  availableCurrencies,
  selectedCurrency,
  onCurrencyChange,
}: CompactCurrencySelectorProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {availableCurrencies.map(currencyCode => {
        const currency = getCurrency(currencyCode);
        if (!currency) return null;

        const isSelected = currencyCode === selectedCurrency;

        return (
          <button
            key={currencyCode}
            onClick={() => onCurrencyChange(currencyCode)}
            className={`px-4 py-2 rounded-md border transition-colors ${
              isSelected
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background hover:bg-accent'
            }`}
          >
            <div className="flex items-center gap-2">
              {currency.flag && <span>{currency.flag}</span>}
              <span className="font-medium">{currency.code}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}







