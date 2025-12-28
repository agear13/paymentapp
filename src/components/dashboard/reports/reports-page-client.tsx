'use client';

import { RevenueSummaryCard } from './revenue-summary-card';
import { TokenBreakdownChart } from './token-breakdown-chart';
import { LedgerBalanceReport } from './ledger-balance-report';
import { ReconciliationReport } from './reconciliation-report';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ReportsPageClientProps {
  organizationId: string;
}

export function ReportsPageClient({ organizationId }: ReportsPageClientProps) {
  const [dateRange, setDateRange] = useState<string>('30d');
  const [refreshKey, setRefreshKey] = useState(0);

  const getDateRange = () => {
    const end = new Date().toISOString();
    const start = new Date();

    switch (dateRange) {
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      case '90d':
        start.setDate(start.getDate() - 90);
        break;
      case '1y':
        start.setFullYear(start.getFullYear() - 1);
        break;
      default:
        start.setDate(start.getDate() - 30);
    }

    return {
      startDate: start.toISOString(),
      endDate: end,
    };
  };

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleExport = async () => {
    try {
      const { startDate, endDate } = getDateRange();
      const params = new URLSearchParams({
        organizationId,
        startDate,
        endDate,
      });

      const response = await fetch(`/api/reports/export?${params}`);
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payments-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export data');
    }
  };

  const { startDate, endDate } = getDateRange();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground">
            Comprehensive reporting across all payment methods including Stripe and Hedera
            (HBAR, USDC, USDT, AUDD)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Token Breakdown Info Card */}
      <Card className="border-primary/50 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg">Token Support Overview</CardTitle>
          <CardDescription>
            This dashboard tracks payments across all supported methods
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">💳</div>
              <div className="text-sm font-medium mt-1">Stripe</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">ℏ</div>
              <div className="text-sm font-medium mt-1">HBAR</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">💵</div>
              <div className="text-sm font-medium mt-1">USDC</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">💰</div>
              <div className="text-sm font-medium mt-1">USDT</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">🇦🇺</div>
              <div className="text-sm font-medium mt-1">AUDD</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Summary and Token Breakdown */}
      <div className="grid gap-6 md:grid-cols-2">
        <RevenueSummaryCard
          key={`revenue-${refreshKey}`}
          organizationId={organizationId}
          startDate={startDate}
          endDate={endDate}
        />
        <TokenBreakdownChart
          key={`token-${refreshKey}`}
          organizationId={organizationId}
          startDate={startDate}
          endDate={endDate}
        />
      </div>

      {/* Financial Reports */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-4">Financial Reports</h2>
          <div className="grid gap-6">
            <LedgerBalanceReport
              key={`ledger-${refreshKey}`}
              organizationId={organizationId}
            />
            <ReconciliationReport
              key={`recon-${refreshKey}`}
              organizationId={organizationId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}







