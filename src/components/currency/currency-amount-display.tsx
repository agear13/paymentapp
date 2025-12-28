'use client';

/**
 * Currency Amount Display Component
 * 
 * Beautiful display of currency amounts with:
 * - Proper formatting per currency
 * - Symbol positioning
 * - Decimal handling
 * - Tooltips with full details
 * - Multiple display modes
 * 
 * Sprint 25: Multi-Currency Enhancement
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  getCurrency,
  formatCurrencyAmount,
  getCurrencySymbol,
  getCurrencyDecimals,
} from '@/lib/currency/currency-config';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface CurrencyAmountDisplayProps {
  amount: number | string;
  currency: string;
  mode?: 'default' | 'compact' | 'detailed' | 'symbol-only';
  showCode?: boolean;
  showSymbol?: boolean;
  className?: string;
  amountClassName?: string;
  codeClassName?: string;
  showTooltip?: boolean;
  locale?: string;
}

export function CurrencyAmountDisplay({
  amount,
  currency,
  mode = 'default',
  showCode,
  showSymbol,
  className,
  amountClassName,
  codeClassName,
  showTooltip = true,
  locale = 'en-US',
}: CurrencyAmountDisplayProps) {
  const currencyMeta = getCurrency(currency);
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  // Determine display options based on mode
  const displayOptions = React.useMemo(() => {
    switch (mode) {
      case 'compact':
        return { showSymbol: true, showCode: false };
      case 'detailed':
        return { showSymbol: true, showCode: true };
      case 'symbol-only':
        return { showSymbol: true, showCode: false };
      default:
        return {
          showSymbol: showSymbol ?? true,
          showCode: showCode ?? false,
        };
    }
  }, [mode, showSymbol, showCode]);

  // Format the amount
  const formattedAmount = React.useMemo(() => {
    if (!currencyMeta) {
      return `${numAmount.toFixed(2)} ${currency}`;
    }

    const decimals = currencyMeta.decimalDigits;
    const formatted = numAmount.toFixed(decimals);

    if (mode === 'symbol-only') {
      return currencyMeta.symbol + formatted;
    }

    if (displayOptions.showSymbol && displayOptions.showCode) {
      return `${currencyMeta.symbol}${formatted} ${currency}`;
    }

    if (displayOptions.showSymbol) {
      return `${currencyMeta.symbol}${formatted}`;
    }

    if (displayOptions.showCode) {
      return `${formatted} ${currency}`;
    }

    return formatted;
  }, [numAmount, currency, currencyMeta, mode, displayOptions]);

  // Tooltip content
  const tooltipContent = React.useMemo(() => {
    if (!showTooltip || !currencyMeta) return null;

    const formattedWithDecimals = numAmount.toFixed(currencyMeta.decimalDigits);
    return (
      <div className="space-y-1">
        <div className="font-semibold">
          {currencyMeta.symbol}
          {formattedWithDecimals} {currency}
        </div>
        <div className="text-xs text-muted-foreground">
          {currencyMeta.name}
        </div>
        {currencyMeta.flag && (
          <div className="text-xs text-muted-foreground">
            {currencyMeta.flag} {currencyMeta.countries.join(', ')}
          </div>
        )}
      </div>
    );
  }, [numAmount, currency, currencyMeta, showTooltip]);

  const content = (
    <div className={cn('inline-flex items-baseline gap-1', className)}>
      <span className={cn('font-semibold tabular-nums', amountClassName)}>
        {displayOptions.showSymbol && currencyMeta && (
          <span className="mr-0.5">{currencyMeta.symbol}</span>
        )}
        {numAmount.toFixed(currencyMeta?.decimalDigits ?? 2)}
      </span>
      {displayOptions.showCode && (
        <span className={cn('text-sm text-muted-foreground', codeClassName)}>
          {currency}
        </span>
      )}
    </div>
  );

  if (!showTooltip || !tooltipContent) {
    return content;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help">{content}</span>
        </TooltipTrigger>
        <TooltipContent>{tooltipContent}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Multi-Currency Amount Display
 * Shows amount in multiple currencies simultaneously
 */
export interface MultiCurrencyAmountDisplayProps {
  amount: number;
  baseCurrency: string;
  displayCurrencies: string[];
  className?: string;
}

export function MultiCurrencyAmountDisplay({
  amount,
  baseCurrency,
  displayCurrencies,
  className,
}: MultiCurrencyAmountDisplayProps) {
  // In a real implementation, you'd fetch conversion rates
  // For now, we'll just show the base currency
  
  return (
    <div className={cn('space-y-2', className)}>
      <div className="text-lg">
        <CurrencyAmountDisplay
          amount={amount}
          currency={baseCurrency}
          mode="detailed"
          showTooltip={false}
        />
      </div>
      {displayCurrencies.length > 0 && (
        <div className="space-y-1">
          {displayCurrencies.map(currency => (
            <div key={currency} className="text-sm text-muted-foreground">
              ≈{' '}
              <CurrencyAmountDisplay
                amount={amount}
                currency={currency}
                mode="compact"
                showTooltip={false}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Currency Comparison Display
 * Shows two amounts side by side for comparison
 */
export interface CurrencyComparisonDisplayProps {
  amount1: number;
  currency1: string;
  amount2: number;
  currency2: string;
  conversionRate?: number;
  className?: string;
}

export function CurrencyComparisonDisplay({
  amount1,
  currency1,
  amount2,
  currency2,
  conversionRate,
  className,
}: CurrencyComparisonDisplayProps) {
  return (
    <div className={cn('flex items-center gap-4', className)}>
      <CurrencyAmountDisplay
        amount={amount1}
        currency={currency1}
        mode="detailed"
      />
      <span className="text-muted-foreground">=</span>
      <CurrencyAmountDisplay
        amount={amount2}
        currency={currency2}
        mode="detailed"
      />
      {conversionRate && (
        <span className="text-xs text-muted-foreground ml-2">
          @ {conversionRate.toFixed(6)}
        </span>
      )}
    </div>
  );
}







