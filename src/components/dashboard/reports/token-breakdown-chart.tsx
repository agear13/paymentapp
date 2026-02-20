'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface TokenBreakdownItem {
  label: string;
  value: number;
  count: number;
  revenue: number;
  color: string;
}

interface TokenBreakdown {
  breakdown: TokenBreakdownItem[];
  totalRevenue: number;
  totalPayments: number;
}

interface TokenBreakdownChartProps {
  organizationId: string;
  startDate?: string;
  endDate?: string;
}

export function TokenBreakdownChart({
  organizationId,
  startDate,
  endDate,
}: TokenBreakdownChartProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TokenBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [organizationId, startDate, endDate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ organizationId });
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`/api/reports/token-breakdown?${params}`);
      if (!response.ok) throw new Error('Failed to fetch token breakdown');

      const result = await response.json();
      setData(result);
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
          <CardTitle>Token Breakdown</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const placeholderBreakdown: TokenBreakdownItem[] = [
    { label: 'Stripe', value: 52, count: 12, revenue: 1250, color: '#635BFF' },
    { label: 'Hedera - HBAR', value: 18, count: 4, revenue: 432, color: '#82A4F8' },
    { label: 'Hedera - USDC', value: 22, count: 6, revenue: 528, color: '#2775CA' },
    { label: 'Hedera - USDT', value: 4, count: 1, revenue: 96, color: '#26A17B' },
    { label: 'Hedera - AUDD', value: 4, count: 2, revenue: 96, color: '#00843D' },
  ];
  const displayData =
    data ??
    ({
      breakdown: placeholderBreakdown,
      totalRevenue: 2402,
      totalPayments: 25,
    } as TokenBreakdown);

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Token Breakdown</CardTitle>
          <CardDescription>
            Sample data for demo — live data unavailable
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-amber-700 mb-4">
            {error ?? 'Could not load data.'} Showing sample data for demo.
          </p>
          <TokenBreakdownContent data={displayData} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Token Breakdown</CardTitle>
        <CardDescription>
          Payment distribution across all supported tokens
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TokenBreakdownContent data={displayData} />
      </CardContent>
    </Card>
  );
}

function TokenBreakdownContent({ data }: { data: TokenBreakdown }) {
  return (
    <div className="space-y-4">
      {data.breakdown.map((item, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-medium">{item.label}</span>
                </div>
                <div className="text-muted-foreground">
                  {item.count} payment{item.count !== 1 ? 's' : ''} · $
                  {item.revenue.toFixed(2)}
                </div>
              </div>
              <div className="relative h-4 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${item.value}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
              <div className="text-xs text-muted-foreground text-right">
                {item.value.toFixed(1)}% of total revenue
              </div>
            </div>
          ))}

      <div className="pt-4 border-t">
        <div className="flex justify-between text-sm font-medium">
          <span>Total</span>
          <span>
            {data.totalPayments} payments · ${data.totalRevenue.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}







