'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { CREATE_INVOICE_HREF } from '@/lib/navigation/payment-routes';
import { formatCurrency } from '@/lib/formatters/format-currency';

interface RevenueSummary {
  totalRevenue: number;
  totalPayments: number;
}

interface RevenueSummaryCardProps {
  organizationId: string;
  startDate?: string;
  endDate?: string;
}

export function RevenueSummaryCard({
  organizationId,
  startDate,
  endDate,
}: RevenueSummaryCardProps) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currencyCode, setCurrencyCode] = useState('AUD');

  useEffect(() => {
    void fetchSummary();
  }, [organizationId, startDate, endDate]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ organizationId });
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`/api/reports/revenue-summary?${params}`);
      if (!response.ok) throw new Error('Failed to fetch revenue summary');

      const data = await response.json();
      setSummary({
        totalRevenue: data.totalRevenue,
        totalPayments: data.totalPayments,
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
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue summary</CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-amber-800">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const isEmpty = !summary || summary.totalPayments === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue summary</CardTitle>
        <CardDescription>Aggregate paid revenue for the selected period.</CardDescription>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-8 text-center">
            <p className="text-sm font-medium">No payments have been received yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your first payment will automatically appear here.
            </p>
            <Button className="mt-4" variant="secondary" size="sm" asChild>
              <Link href={CREATE_INVOICE_HREF}>Create invoice</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-2xl font-bold tabular-nums">
                {formatCurrency(summary.totalRevenue, currencyCode)}
              </div>
              <p className="text-xs text-muted-foreground">Total revenue</p>
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{summary.totalPayments}</div>
              <p className="text-xs text-muted-foreground">Successful payments</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
