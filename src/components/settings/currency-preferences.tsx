'use client';

/**
 * Currency Preferences Settings Component
 * 
 * Allows organizations to configure:
 * - Default display currency
 * - Enabled payment currencies
 * - Currency display format preferences
 * - Conversion rate preferences
 * 
 * Sprint 25: Multi-Currency Enhancement
 */

import * as React from 'react';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { EnhancedCurrencySelect } from '@/components/currency/enhanced-currency-select';
import {
  getEnabledCurrencies,
  getCurrenciesByCategory,
  type CurrencyMetadata,
  type CurrencyCategory,
} from '@/lib/currency/currency-config';
import { Check, X } from 'lucide-react';

export interface CurrencyPreferencesProps {
  organizationId: string;
  initialSettings?: {
    defaultCurrency: string;
    enabledCurrencies: string[];
    showSymbolsInUI: boolean;
    showCodesInUI: boolean;
    autoRefreshRates: boolean;
  };
  onSave?: (settings: any) => Promise<void>;
}

export function CurrencyPreferences({
  organizationId,
  initialSettings,
  onSave,
}: CurrencyPreferencesProps) {
  const [defaultCurrency, setDefaultCurrency] = useState(
    initialSettings?.defaultCurrency || 'USD'
  );
  const [enabledCurrencies, setEnabledCurrencies] = useState<Set<string>>(
    new Set(initialSettings?.enabledCurrencies || ['USD', 'AUD', 'EUR'])
  );
  const [showSymbolsInUI, setShowSymbolsInUI] = useState(
    initialSettings?.showSymbolsInUI ?? true
  );
  const [showCodesInUI, setShowCodesInUI] = useState(
    initialSettings?.showCodesInUI ?? false
  );
  const [autoRefreshRates, setAutoRefreshRates] = useState(
    initialSettings?.autoRefreshRates ?? true
  );
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const allCurrencies = getEnabledCurrencies();

  const handleToggleCurrency = (currencyCode: string) => {
    const newEnabled = new Set(enabledCurrencies);
    if (newEnabled.has(currencyCode)) {
      // Can't disable the default currency
      if (currencyCode === defaultCurrency) {
        return;
      }
      newEnabled.delete(currencyCode);
    } else {
      newEnabled.add(currencyCode);
    }
    setEnabledCurrencies(newEnabled);
    setHasChanges(true);
  };

  const handleSetDefaultCurrency = (currencyCode: string) => {
    setDefaultCurrency(currencyCode);
    // Ensure the default currency is enabled
    if (!enabledCurrencies.has(currencyCode)) {
      const newEnabled = new Set(enabledCurrencies);
      newEnabled.add(currencyCode);
      setEnabledCurrencies(newEnabled);
    }
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const settings = {
        defaultCurrency,
        enabledCurrencies: Array.from(enabledCurrencies),
        showSymbolsInUI,
        showCodesInUI,
        autoRefreshRates,
      };

      if (onSave) {
        await onSave(settings);
      }

      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save currency preferences:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Group currencies by category for better organization
  const currencyGroups = React.useMemo(() => {
    const categories: CurrencyCategory[] = [
      'major',
      'americas',
      'europe',
      'asia_pacific',
      'middle_east',
      'africa',
      'crypto',
    ];

    return categories.map(category => ({
      category,
      currencies: getCurrenciesByCategory(category),
    }));
  }, []);

  const getCategoryLabel = (category: CurrencyCategory): string => {
    const labels: Record<CurrencyCategory, string> = {
      major: 'Major Currencies',
      americas: 'Americas',
      europe: 'Europe',
      asia_pacific: 'Asia & Pacific',
      middle_east: 'Middle East',
      africa: 'Africa',
      crypto: 'Cryptocurrencies',
    };
    return labels[category];
  };

  return (
    <div className="space-y-6">
      {/* Default Currency */}
      <Card>
        <CardHeader>
          <CardTitle>Default Currency</CardTitle>
          <CardDescription>
            This currency will be used for invoicing, reporting, and as the base for conversions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="default-currency">Select Default Currency</Label>
            <EnhancedCurrencySelect
              value={defaultCurrency}
              onValueChange={handleSetDefaultCurrency}
              placeholder="Select default currency"
            />
          </div>
        </CardContent>
      </Card>

      {/* Enabled Payment Currencies */}
      <Card>
        <CardHeader>
          <CardTitle>Enabled Payment Currencies</CardTitle>
          <CardDescription>
            Choose which currencies customers can use to make payments.
            {enabledCurrencies.size > 0 && (
              <span className="block mt-2 text-sm">
                {enabledCurrencies.size} {enabledCurrencies.size === 1 ? 'currency' : 'currencies'} enabled
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {currencyGroups.map(
              ({ category, currencies }) =>
                currencies.length > 0 && (
                  <div key={category}>
                    <h4 className="text-sm font-semibold mb-3">
                      {getCategoryLabel(category)}
                    </h4>
                    <div className="grid gap-2">
                      {currencies.map(currency => {
                        const isEnabled = enabledCurrencies.has(currency.code);
                        const isDefault = currency.code === defaultCurrency;

                        return (
                          <div
                            key={currency.code}
                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              {currency.flag && (
                                <span className="text-xl">{currency.flag}</span>
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{currency.code}</span>
                                  <span className="text-sm text-muted-foreground">
                                    {currency.symbol}
                                  </span>
                                  {isDefault && (
                                    <Badge variant="secondary" className="text-xs">
                                      Default
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {currency.name}
                                </div>
                              </div>
                            </div>
                            <Switch
                              checked={isEnabled}
                              onCheckedChange={() => handleToggleCurrency(currency.code)}
                              disabled={isDefault}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )
            )}
          </div>
        </CardContent>
      </Card>

      {/* Display Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Display Preferences</CardTitle>
          <CardDescription>
            Configure how currency amounts are displayed throughout the application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="show-symbols">Show Currency Symbols</Label>
                <div className="text-sm text-muted-foreground">
                  Display symbols like $, €, £ before amounts
                </div>
              </div>
              <Switch
                id="show-symbols"
                checked={showSymbolsInUI}
                onCheckedChange={(checked) => {
                  setShowSymbolsInUI(checked);
                  setHasChanges(true);
                }}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="show-codes">Show Currency Codes</Label>
                <div className="text-sm text-muted-foreground">
                  Display 3-letter codes like USD, EUR after amounts
                </div>
              </div>
              <Switch
                id="show-codes"
                checked={showCodesInUI}
                onCheckedChange={(checked) => {
                  setShowCodesInUI(checked);
                  setHasChanges(true);
                }}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-refresh">Auto-Refresh Exchange Rates</Label>
                <div className="text-sm text-muted-foreground">
                  Automatically update rates every 5 minutes
                </div>
              </div>
              <Switch
                id="auto-refresh"
                checked={autoRefreshRates}
                onCheckedChange={(checked) => {
                  setAutoRefreshRates(checked);
                  setHasChanges(true);
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      {hasChanges && (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              // Reset to initial values
              setDefaultCurrency(initialSettings?.defaultCurrency || 'USD');
              setEnabledCurrencies(
                new Set(initialSettings?.enabledCurrencies || ['USD', 'AUD', 'EUR'])
              );
              setShowSymbolsInUI(initialSettings?.showSymbolsInUI ?? true);
              setShowCodesInUI(initialSettings?.showCodesInUI ?? false);
              setAutoRefreshRates(initialSettings?.autoRefreshRates ?? true);
              setHasChanges(false);
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Preferences'}
          </Button>
        </div>
      )}
    </div>
  );
}







