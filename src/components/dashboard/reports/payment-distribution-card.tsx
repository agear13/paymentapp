'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CREATE_INVOICE_HREF } from '@/lib/navigation/payment-routes';
import {
  colorForDistributionLabel,
  PAYMENT_DISTRIBUTION_LABELS,
} from '@/lib/reports/payment-rails-display';
import { PaymentRailBadge } from '@/components/dashboard/reports/payment-rail-badge';
import type { PaymentRailId } from '@/lib/reports/payment-rails-display';
import { formatCurrency } from '@/lib/formatters/format-currency';

interface DistributionItem {
  label: string;
  value: number;
  count: number;
  revenue: number;
  color: string;
}

const LABEL_TO_RAIL: Record<string, PaymentRailId | undefined> = {
  Stripe: 'stripe',
  Wise: 'wise',
  'Hedera - HBAR': 'hbar',
  'Hedera - USDC': 'usdc',
  'Hedera - USDT': 'usdt',
  'Hedera - AUDD': 'audd',
};

function operatorLabel(raw: string): string {
  return PAYMENT_DISTRIBUTION_LABELS[raw] ?? raw.replace(/^Hedera - /, '');
}

interface PaymentDistributionCardProps {
  organizationId: string;
  startDate?: string;
  endDate?: string;
}

export function PaymentDistributionCard({
  organizationId,
  startDate,
  endDate,
}: PaymentDistributionCardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [currencyCode, setCurrencyCode] = useState('AUD');
  const [data, setData] = useState<{
    breakdown: DistributionItem[];
    totalRevenue: number;
    totalPayments: number;
  } | null>(null);

  useEffect(() => {
    void fetchData();
  }, [organizationId, startDate, endDate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ organizationId });
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`/api/reports/token-breakdown?${params}`);
      if (!response.ok) throw new Error('Failed to fetch payment distribution');

      const result = await response.json();
      setData({
        breakdown: (result.breakdown as DistributionItem[]).map((item) => ({
          ...item,
          color: item.color || colorForDistributionLabel(item.label),
        })),
        totalRevenue: result.totalRevenue,
        totalPayments: result.totalPayments,
      });

      const settingsRes = await fetch(
        `/api/merchant-settings?organizationId=${organizationId}`
      );
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        if (settings[0]?.default_currency) {
          setCurrencyCode(settings[0].default_currency);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment distribution</CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-amber-800">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const breakdown = data?.breakdown ?? [];
  const activeItems = breakdown.filter(
    (item) => item.count > 0 || item.revenue > 0
  );
  const visibleItems = showInactive ? breakdown : activeItems;
  const hasActivity = (data?.totalPayments ?? 0) > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Payment distribution</CardTitle>
          <CardDescription>
            Revenue share and payment method mix for the selected period.
          </CardDescription>
        </div>
        {hasActivity ? (
          <div className="flex items-center gap-2 shrink-0">
            <Switch
              id="show-inactive-rails"
              checked={showInactive}
              onCheckedChange={setShowInactive}
            />
            <Label htmlFor="show-inactive-rails" className="text-xs font-normal">
              Show inactive rails
            </Label>
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        {!hasActivity ? (
          <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-8 text-center">
            <p className="text-sm font-medium">No payments have been received yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your first payment will automatically appear here.
            </p>
            <Button className="mt-4" variant="secondary" size="sm" asChild>
              <Link href={CREATE_INVOICE_HREF}>Create invoice</Link>
            </Button>
          </div>
        ) : visibleItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No payment methods with activity in this period. Enable &quot;Show inactive
            rails&quot; to see all methods.
          </p>
        ) : (
          <div className="space-y-4">
            {visibleItems.map((item) => {
              const displayLabel = operatorLabel(item.label);
              const railId = LABEL_TO_RAIL[item.label];
              return (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {railId ? (
                        <PaymentRailBadge rail={railId} />
                      ) : (
                        <div
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                      )}
                      <span className="font-medium truncate">{displayLabel}</span>
                    </div>
                    <span className="text-muted-foreground tabular-nums shrink-0 text-right">
                      {item.count} payment{item.count !== 1 ? 's' : ''} ·{' '}
                      {formatCurrency(item.revenue, currencyCode)} ({item.value.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${Math.min(100, item.value)}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="border-t pt-3 text-sm font-medium flex justify-between gap-2">
              <span>Total</span>
              <span className="tabular-nums text-right">
                {data?.totalPayments} payments ·{' '}
                {formatCurrency(data?.totalRevenue ?? 0, currencyCode)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
