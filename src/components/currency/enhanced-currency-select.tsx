'use client';

/**
 * Enhanced Currency Select Component
 * 
 * Advanced currency selector with:
 * - Flag emojis and symbols
 * - Category grouping
 * - Search/filter
 * - Popular currencies at top
 * - Keyboard navigation
 * 
 * Sprint 25: Multi-Currency Enhancement
 */

import * as React from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  getEnabledCurrencies,
  getPopularCurrencies,
  getCurrenciesByCategory,
  type CurrencyMetadata,
} from '@/lib/currency/currency-config';

export interface EnhancedCurrencySelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  showPopularOnly?: boolean;
  excludeCrypto?: boolean;
  className?: string;
}

export function EnhancedCurrencySelect({
  value,
  onValueChange,
  disabled = false,
  placeholder = 'Select currency',
  showPopularOnly = false,
  excludeCrypto = false,
  className,
}: EnhancedCurrencySelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  // Get currencies
  const allCurrencies = React.useMemo(() => {
    let currencies = getEnabledCurrencies();
    
    if (excludeCrypto) {
      currencies = currencies.filter(c => c.category !== 'crypto');
    }
    
    if (showPopularOnly) {
      return getPopularCurrencies();
    }
    
    return currencies;
  }, [showPopularOnly, excludeCrypto]);

  // Group currencies by category
  const currencyGroups = React.useMemo(() => {
    const popular = getPopularCurrencies().slice(0, 10);
    const categories = [
      'major',
      'americas',
      'europe',
      'asia_pacific',
      'middle_east',
      'africa',
    ];
    
    if (!excludeCrypto) {
      categories.push('crypto');
    }

    const groups: Array<{ label: string; currencies: CurrencyMetadata[] }> = [];

    // Popular currencies first
    if (!showPopularOnly && popular.length > 0) {
      groups.push({
        label: 'Popular',
        currencies: popular,
      });
    }

    // Then by category
    categories.forEach(category => {
      const currencies = getCurrenciesByCategory(category as any);
      if (currencies.length > 0) {
        groups.push({
          label: getCategoryLabel(category),
          currencies,
        });
      }
    });

    return groups;
  }, [showPopularOnly, excludeCrypto]);

  // Filter currencies based on search
  const filteredGroups = React.useMemo(() => {
    if (!search) return currencyGroups;

    const lowerSearch = search.toLowerCase();
    return currencyGroups
      .map(group => ({
        ...group,
        currencies: group.currencies.filter(
          c =>
            c.code.toLowerCase().includes(lowerSearch) ||
            c.name.toLowerCase().includes(lowerSearch) ||
            c.countries.some(country => country.toLowerCase().includes(lowerSearch))
        ),
      }))
      .filter(group => group.currencies.length > 0);
  }, [currencyGroups, search]);

  const selectedCurrency = allCurrencies.find(c => c.code === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between', className)}
        >
          {selectedCurrency ? (
            <div className="flex items-center gap-2">
              {selectedCurrency.flag && (
                <span className="text-lg">{selectedCurrency.flag}</span>
              )}
              <span className="font-medium">{selectedCurrency.code}</span>
              <span className="text-muted-foreground">-</span>
              <span className="text-sm text-muted-foreground truncate">
                {selectedCurrency.name}
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              placeholder="Search currency or country..."
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            <CommandEmpty>No currency found.</CommandEmpty>
            {filteredGroups.map(group => (
              <CommandGroup key={group.label} heading={group.label}>
                {group.currencies.map(currency => (
                  <CommandItem
                    key={currency.code}
                    value={currency.code}
                    onSelect={(currentValue) => {
                      onValueChange(currentValue.toUpperCase());
                      setOpen(false);
                      setSearch('');
                    }}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        {currency.flag && (
                          <span className="text-lg">{currency.flag}</span>
                        )}
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{currency.code}</span>
                            <span className="text-xs text-muted-foreground">
                              {currency.symbol}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {currency.name}
                          </span>
                        </div>
                      </div>
                      <Check
                        className={cn(
                          'h-4 w-4',
                          value === currency.code ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    major: 'Major Currencies',
    americas: 'Americas',
    europe: 'Europe',
    asia_pacific: 'Asia & Pacific',
    middle_east: 'Middle East',
    africa: 'Africa',
    crypto: 'Cryptocurrencies',
  };
  return labels[category] || category;
}







