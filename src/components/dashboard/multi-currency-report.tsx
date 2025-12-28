'use client';

/**
 * Multi-Currency Reporting Dashboard
 * 
 * Comprehensive reporting for multi-currency transactions:
 * - Currency breakdown by volume and value
 * - Conversion gain/loss tracking
 * - Exchange rate trends
 * - Currency exposure analysis
 * - Normalized reporting in base currency
 * 
 * Sprint 26: Final Testing & Quality Assurance
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CurrencyAmountDisplay } from '@/components/currency/currency-amount-display';
import { getCurrency } from '@/lib/currency/currency-config';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Globe,
  BarChart3,
  PieChart,
  ArrowUpDown,
} from 'lucide-react';

export interface MultiCurrencyReportProps {
  organizationId: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
}

interface CurrencyBreakdown {
  currency: string;
  transactionCount: number;
  totalAmount: number;
  normalizedAmount: number; // In base currency
  percentage: number;
  averageTransactionSize: number;
}

interface ConversionMetrics {
  totalConversions: number;
  totalGainLoss: number;
  gainLossPercentage: number;
  mostVolatilePair: string;
  averageSpread: number;
}

interface ExchangeRateTrend {
  currencyPair: string;
  currentRate: number;
  previousRate: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

export function MultiCurrencyReport({ organizationId, dateRange }: MultiCurrencyReportProps) {
  const [loading, setLoading] = useState(true);
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [currencyBreakdown, setCurrencyBreakdown] = useState<CurrencyBreakdown[]>([]);
  const [conversionMetrics, setConversionMetrics] = useState<ConversionMetrics | null>(null);
  const [rateTrends, setRateTrends] = useState<ExchangeRateTrend[]>([]);
  const [totalNormalized, setTotalNormalized] = useState(0);

  useEffect(() => {
    loadReportData();
  }, [organizationId, dateRange, baseCurrency]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API calls
      // Simulated data for now
      await new Promise(resolve => setTimeout(resolve, 1000));

      setCurrencyBreakdown([
        {
          currency: 'USD',
          transactionCount: 45,
          totalAmount: 12500,
          normalizedAmount: 12500,
          percentage: 45,
          averageTransactionSize: 278,
        },
        {
          currency: 'EUR',
          transactionCount: 28,
          totalAmount: 8200,
          normalizedAmount: 8930,
          percentage: 32,
          averageTransactionSize: 293,
        },
        {
          currency: 'GBP',
          transactionCount: 18,
          totalAmount: 4800,
          normalizedAmount: 6096,
          percentage: 22,
          averageTransactionSize: 267,
        },
        {
          currency: 'HBAR',
          transactionCount: 5,
          totalAmount: 50000,
          normalizedAmount: 400,
          percentage: 1,
          averageTransactionSize: 80,
        },
      ]);

      setConversionMetrics({
        totalConversions: 51,
        totalGainLoss: 126.50,
        gainLossPercentage: 0.45,
        mostVolatilePair: 'GBP/USD',
        averageSpread: 0.0025,
      });

      setRateTrends([
        {
          currencyPair: 'EUR/USD',
          currentRate: 1.09,
          previousRate: 1.08,
          changePercent: 0.93,
          trend: 'up',
        },
        {
          currencyPair: 'GBP/USD',
          currentRate: 1.27,
          previousRate: 1.28,
          changePercent: -0.78,
          trend: 'down',
        },
        {
          currencyPair: 'HBAR/USD',
          currentRate: 0.08,
          previousRate: 0.08,
          changePercent: 0.00,
          trend: 'stable',
        },
      ]);

      setTotalNormalized(27926);
    } catch (error) {
      console.error('Failed to load report data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Multi-Currency Report</h2>
          <p className="text-muted-foreground">
            Comprehensive currency analysis and conversion metrics
          </p>
        </div>
        <Select value={baseCurrency} onValueChange={setBaseCurrency}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Base currency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="USD">USD - US Dollar</SelectItem>
            <SelectItem value="EUR">EUR - Euro</SelectItem>
            <SelectItem value="GBP">GBP - British Pound</SelectItem>
            <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total (Normalized)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <CurrencyAmountDisplay
                amount={totalNormalized}
                currency={baseCurrency}
                mode="symbol-only"
                showTooltip={false}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Across {currencyBreakdown.reduce((sum, c) => sum + c.transactionCount, 0)} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Currencies Used</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currencyBreakdown.length}</div>
            <p className="text-xs text-muted-foreground">
              {currencyBreakdown.filter(c => c.currency !== baseCurrency).length} requiring conversion
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Gain/Loss</CardTitle>
            {conversionMetrics && conversionMetrics.totalGainLoss >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${conversionMetrics && conversionMetrics.totalGainLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              <CurrencyAmountDisplay
                amount={Math.abs(conversionMetrics?.totalGainLoss || 0)}
                currency={baseCurrency}
                mode="symbol-only"
                showTooltip={false}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {conversionMetrics?.gainLossPercentage.toFixed(2)}% of total volume
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversions</CardTitle>
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversionMetrics?.totalConversions || 0}</div>
            <p className="text-xs text-muted-foreground">
              Avg spread: {((conversionMetrics?.averageSpread || 0) * 100).toFixed(3)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="breakdown" className="space-y-4">
        <TabsList>
          <TabsTrigger value="breakdown">Currency Breakdown</TabsTrigger>
          <TabsTrigger value="trends">Exchange Rate Trends</TabsTrigger>
          <TabsTrigger value="exposure">Currency Exposure</TabsTrigger>
        </TabsList>

        {/* Currency Breakdown Tab */}
        <TabsContent value="breakdown" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Transaction Volume by Currency</CardTitle>
              <CardDescription>
                All amounts normalized to {baseCurrency} for comparison
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {currencyBreakdown.map((item) => {
                  const currency = getCurrency(item.currency);
                  return (
                    <div key={item.currency} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {currency?.flag && (
                            <span className="text-2xl">{currency.flag}</span>
                          )}
                          <div>
                            <div className="font-semibold">{item.currency}</div>
                            <div className="text-sm text-muted-foreground">
                              {item.transactionCount} transactions
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">
                            <CurrencyAmountDisplay
                              amount={item.normalizedAmount}
                              currency={baseCurrency}
                              mode="symbol-only"
                              showTooltip={false}
                            />
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {item.percentage.toFixed(1)}% of total
                          </div>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                      {item.currency !== baseCurrency && (
                        <div className="text-xs text-muted-foreground">
                          Original: {item.totalAmount.toFixed(2)} {item.currency} → Converted at current rates
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Exchange Rate Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Exchange Rate Movements</CardTitle>
              <CardDescription>
                Recent changes in exchange rates for active currency pairs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {rateTrends.map((trend) => (
                  <div key={trend.currencyPair} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-semibold">{trend.currencyPair}</div>
                      <div className="text-sm text-muted-foreground">
                        Current: {trend.currentRate.toFixed(4)}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className={`font-semibold ${trend.trend === 'up' ? 'text-green-500' : trend.trend === 'down' ? 'text-red-500' : 'text-muted-foreground'}`}>
                          {trend.changePercent > 0 && '+'}
                          {trend.changePercent.toFixed(2)}%
                        </div>
                        <div className="text-sm text-muted-foreground">
                          vs {trend.previousRate.toFixed(4)}
                        </div>
                      </div>
                      {trend.trend === 'up' && <TrendingUp className="h-5 w-5 text-green-500" />}
                      {trend.trend === 'down' && <TrendingDown className="h-5 w-5 text-red-500" />}
                      {trend.trend === 'stable' && <div className="h-5 w-5" />}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Currency Exposure Tab */}
        <TabsContent value="exposure" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Currency Exposure Analysis</CardTitle>
              <CardDescription>
                Risk assessment based on currency distribution
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Exposure Summary */}
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">
                      Dominant Currency
                    </div>
                    <div className="text-2xl font-bold">
                      {currencyBreakdown[0]?.currency || 'N/A'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {currencyBreakdown[0]?.percentage.toFixed(1)}% of volume
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">
                      Diversification
                    </div>
                    <div className="text-2xl font-bold">
                      {currencyBreakdown.length > 3 ? 'High' : currencyBreakdown.length > 1 ? 'Medium' : 'Low'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {currencyBreakdown.length} currencies active
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">
                      Volatility Risk
                    </div>
                    <div className="text-2xl font-bold">
                      {conversionMetrics && Math.abs(conversionMetrics.gainLossPercentage) > 1 ? 'High' : 'Low'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Based on conversion variance
                    </div>
                  </div>
                </div>

                {/* Recommendations */}
                <div className="space-y-2">
                  <div className="text-sm font-semibold">Recommendations</div>
                  <div className="space-y-2">
                    {currencyBreakdown[0]?.percentage > 70 && (
                      <div className="flex items-start gap-2 text-sm">
                        <Badge variant="outline" className="mt-0.5">Info</Badge>
                        <span>Consider diversifying currency exposure to reduce concentration risk</span>
                      </div>
                    )}
                    {conversionMetrics && Math.abs(conversionMetrics.gainLossPercentage) > 1 && (
                      <div className="flex items-start gap-2 text-sm">
                        <Badge variant="outline" className="mt-0.5">Warning</Badge>
                        <span>High conversion variance detected. Consider using rate locks for large transactions</span>
                      </div>
                    )}
                    {currencyBreakdown.some(c => c.currency.length === 4) && (
                      <div className="flex items-start gap-2 text-sm">
                        <Badge variant="outline" className="mt-0.5">Info</Badge>
                        <span>Cryptocurrency exposure present. Monitor volatility closely</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}







