'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface RevenueSummary {
  totalRevenue: number;
  totalPayments: number;
  breakdown: {
    stripe: { count: number; revenue: number; percentage: number };
    hedera_hbar: { count: number; revenue: number; percentage: number };
    hedera_usdc: { count: number; revenue: number; percentage: number };
    hedera_usdt: { count: number; revenue: number; percentage: number };
    hedera_audd: { count: number; revenue: number; percentage: number };
  };
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

  useEffect(() => {
    fetchSummary();
  }, [organizationId, startDate, endDate]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ organizationId });
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`/api/reports/revenue-summary?${params}`);
      if (!response.ok) throw new Error('Failed to fetch revenue summary');

      const data = await response.json();
      setSummary(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue Summary</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue Summary</CardTitle>
          <CardDescription>Error loading data</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue Summary</CardTitle>
        <CardDescription>
          Total revenue breakdown by payment method
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-2xl font-bold">
                ${summary.totalRevenue.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Total Revenue</p>
            </div>
            <div>
              <div className="text-2xl font-bold">{summary.totalPayments}</div>
              <p className="text-xs text-muted-foreground">Total Payments</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Payment Method Breakdown</div>
            
            {/* Stripe */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-[#635BFF]" />
                <span className="text-sm">Stripe</span>
              </div>
              <div className="text-sm font-medium">
                ${summary.breakdown.stripe.revenue.toFixed(2)} (
                {summary.breakdown.stripe.percentage.toFixed(1)}%)
              </div>
            </div>

            {/* Hedera - HBAR */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-[#82A4F8]" />
                <span className="text-sm">Hedera - HBAR</span>
              </div>
              <div className="text-sm font-medium">
                ${summary.breakdown.hedera_hbar.revenue.toFixed(2)} (
                {summary.breakdown.hedera_hbar.percentage.toFixed(1)}%)
              </div>
            </div>

            {/* Hedera - USDC */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-[#2775CA]" />
                <span className="text-sm">Hedera - USDC</span>
              </div>
              <div className="text-sm font-medium">
                ${summary.breakdown.hedera_usdc.revenue.toFixed(2)} (
                {summary.breakdown.hedera_usdc.percentage.toFixed(1)}%)
              </div>
            </div>

            {/* Hedera - USDT */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-[#26A17B]" />
                <span className="text-sm">Hedera - USDT</span>
              </div>
              <div className="text-sm font-medium">
                ${summary.breakdown.hedera_usdt.revenue.toFixed(2)} (
                {summary.breakdown.hedera_usdt.percentage.toFixed(1)}%)
              </div>
            </div>

            {/* Hedera - AUDD */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-[#00843D]" />
                <span className="text-sm">Hedera - AUDD</span>
              </div>
              <div className="text-sm font-medium">
                ${summary.breakdown.hedera_audd.revenue.toFixed(2)} (
                {summary.breakdown.hedera_audd.percentage.toFixed(1)}%)
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}







