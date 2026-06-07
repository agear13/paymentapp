'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RevenueSummaryCard } from './revenue-summary-card';
import { LedgerBalanceReport } from './ledger-balance-report';
import { ReconciliationReport } from './reconciliation-report';
import { OperationalInsightsCard } from './operational-insights-card';
import { ConnectedPaymentMethodsStrip } from './connected-payment-methods-strip';
import { ReconciliationHeroCard } from './reconciliation-hero-card';
import { PaymentDistributionCard } from './payment-distribution-card';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  getStoredReportsViewMode,
  setStoredReportsViewMode,
  type ReportsViewMode,
} from '@/lib/reports/reports-view-mode';
import { REPORTS_EXPORTS_HREF, REPORTS_LEDGER_HREF } from '@/lib/navigation/operator-nav';

interface ReportsPageClientProps {
  organizationId: string;
}

export function ReportsPageClient({ organizationId }: ReportsPageClientProps) {
  const [dateRange, setDateRange] = useState<string>('30d');
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewMode, setViewMode] = useState<ReportsViewMode>('overview');

  useEffect(() => {
    setViewMode(getStoredReportsViewMode());
  }, []);

  const handleViewModeChange = (value: string) => {
    if (value !== 'overview' && value !== 'finance') return;
    setViewMode(value);
    setStoredReportsViewMode(value);
  };

  const getDateRange = () => {
    const end = new Date();
    const start = new Date();

    switch (dateRange) {
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      case 'month':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
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
      endDate: end.toISOString(),
    };
  };

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const { startDate, endDate } = getDateRange();

  const insightsBlock = (
    <OperationalInsightsCard
      key={`insights-${refreshKey}`}
      organizationId={organizationId}
    />
  );

  const revenueBlock = (
    <div className="grid gap-6 lg:grid-cols-2">
      <RevenueSummaryCard
        key={`revenue-${refreshKey}`}
        organizationId={organizationId}
        startDate={startDate}
        endDate={endDate}
      />
      <PaymentDistributionCard
        key={`distribution-${refreshKey}`}
        organizationId={organizationId}
        startDate={startDate}
        endDate={endDate}
      />
    </div>
  );

  const ledgerBlock = (
    <div className="space-y-6" id="ledger-snapshot">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Ledger snapshot</h2>
        <p className="text-sm text-muted-foreground">
          Clearing balances and full reconciliation detail for accountants and audit review.
        </p>
      </div>
      <LedgerBalanceReport
        key={`ledger-${refreshKey}`}
        organizationId={organizationId}
      />
      <ReconciliationReport
        key={`recon-${refreshKey}`}
        organizationId={organizationId}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reporting</h1>
          <p className="text-muted-foreground max-w-2xl">
            Your financial operations center — reconciliation integrity, revenue outcomes, and
            audit-ready ledger visibility.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(v) => v && handleViewModeChange(v)}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="overview" aria-label="Overview">
              Overview
            </ToggleGroupItem>
            <ToggleGroupItem value="finance" aria-label="Finance">
              Finance
            </ToggleGroupItem>
          </ToggleGroup>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="month">This month</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={handleRefresh} aria-label="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" asChild>
            <Link href={REPORTS_EXPORTS_HREF}>
              <Download className="h-4 w-4 mr-2" />
              Export Center
            </Link>
          </Button>
        </div>
      </div>

      <ReconciliationHeroCard
        key={`hero-${refreshKey}`}
        organizationId={organizationId}
      />

      {viewMode === 'overview' ? (
        <>
          {insightsBlock}
          {revenueBlock}
          {ledgerBlock}
        </>
      ) : (
        <>
          {ledgerBlock}
          {insightsBlock}
          {revenueBlock}
        </>
      )}

      <ConnectedPaymentMethodsStrip organizationId={organizationId} />

      <div className="flex justify-end">
        <Button variant="link" className="h-auto p-0 text-sm" asChild>
          <Link href={REPORTS_LEDGER_HREF}>Open full ledger workspace</Link>
        </Button>
      </div>
    </div>
  );
}
