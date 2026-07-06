'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty/EmptyState';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  Building2,
  DollarSign,
  FileText,
  AlertTriangle,
  Plug,
  TrendingUp,
  Receipt,
  Users,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Upload,
  Eye,
  Bell,
  Search,
  Sparkles,
  ArrowRight,
  ChevronDown,
  CircleDot,
  Inbox,
  BarChart3,
  Lock,
} from 'lucide-react';
import {
  partnerRevenueMetrics,
  portfolioValueSummary,
  todaysPriorities,
  clientBusinesses,
  businessesRequiringAttention,
  aiRecommendations,
  aiPortfolioInsights,
  clientPipelineStages,
  partnerGrowthOpportunities,
  estimatedAdditionalMonthlyRevenue,
  operationalHealthMetrics,
  monthlyPaymentVolume,
  clientRevenueDistribution,
  paymentMethodBreakdown,
  outstandingReceivables,
  portfolioFilterChips,
  comingSoonIntegrations,
  getGroupedRecentActivity,
  filterClientBusinesses,
  industryFilterOptions,
  healthFilterOptions,
  accountingFilterOptions,
  paymentRailFilterOptions,
  statusFilterOptions,
  type ClientBusiness,
  type OperationalHealthCategory,
  type ActivityType,
  type PortfolioFilterChip,
  type PriorityUrgency,
} from '@/lib/data/mock-partner-preview';
import { PartnerWorkspaceSheet } from '@/components/partner-preview/partner-workspace-sheet';
import { OnboardingProgressIndicator } from '@/components/partner-preview/onboarding-progress-indicator';
import { AnimatedCounter } from '@/components/partner-preview/animated-counter';
import { RiskScoreIndicator } from '@/components/partner-preview/risk-score-indicator';
import { BusinessHoverPreview } from '@/components/partner-preview/business-hover-preview';
import { DemoModeBanner } from '@/components/partner-preview/demo-mode-banner';
import { NotificationsPanel } from '@/components/partner-preview/notifications-panel';
import {
  AccountingPlatformBadge,
  AttentionSeverityBadge,
  RecommendationCategoryBadge,
} from '@/components/partner-preview/partner-preview-badges';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5, var(--muted-foreground)))',
  'hsl(var(--muted-foreground))',
];

const OPERATIONAL_HEALTH_ITEMS: Array<{
  key: OperationalHealthCategory;
  label: string;
  value: keyof typeof operationalHealthMetrics;
  color: string;
}> = [
  { key: 'healthy', label: 'Healthy Businesses', value: 'healthyBusinesses', color: 'text-green-600' },
  { key: 'needs_attention', label: 'Needs Attention', value: 'needsAttention', color: 'text-amber-600' },
  { key: 'critical', label: 'Critical Issues', value: 'criticalIssues', color: 'text-red-600' },
  { key: 'disconnected', label: 'Disconnected Integrations', value: 'disconnectedIntegrations', color: 'text-orange-600' },
  { key: 'pending_approval', label: 'Outstanding Approvals', value: 'outstandingApprovals', color: 'text-blue-600' },
  { key: 'pending_settlement', label: 'Pending Settlements', value: 'pendingSettlements', color: 'text-purple-600' },
];

const PRIORITY_DOT: Record<PriorityUrgency, string> = {
  critical: 'bg-red-500',
  warning: 'bg-amber-500',
  success: 'bg-green-500',
};

function getActivityIcon(type: ActivityType) {
  switch (type) {
    case 'invoice_paid':
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    case 'settlement_completed':
    case 'settlement_released':
      return <DollarSign className="h-3.5 w-3.5 text-green-500" />;
    case 'xero_synced':
      return <RefreshCw className="h-3.5 w-3.5 text-blue-500" />;
    case 'agreement_uploaded':
      return <Upload className="h-3.5 w-3.5 text-blue-500" />;
    case 'payment_failed':
      return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    case 'reminder_sent':
      return <Bell className="h-3.5 w-3.5 text-amber-500" />;
    case 'invoice_viewed':
      return <Eye className="h-3.5 w-3.5 text-muted-foreground" />;
    default:
      return null;
  }
}

export function PartnerPreviewDashboard() {
  const [selectedBusiness, setSelectedBusiness] = useState<ClientBusiness | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [tableSearch, setTableSearch] = useState('');
  const [portfolioChip, setPortfolioChip] = useState<PortfolioFilterChip>('all');
  const [industry, setIndustry] = useState('All industries');
  const [health, setHealth] = useState('all');
  const [accounting, setAccounting] = useState('All platforms');
  const [paymentRail, setPaymentRail] = useState('All rails');
  const [status, setStatus] = useState('All statuses');
  const [operationalHealth, setOperationalHealth] = useState<OperationalHealthCategory | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  const metrics = partnerRevenueMetrics;
  const portfolio = portfolioValueSummary;
  const groupedActivity = getGroupedRecentActivity();

  const filteredBusinesses = useMemo(
    () =>
      filterClientBusinesses(clientBusinesses, {
        search: tableSearch,
        globalSearch,
        industry,
        health,
        accounting,
        paymentRail,
        status,
        operationalHealth,
        portfolioChip,
      }),
    [tableSearch, globalSearch, industry, health, accounting, paymentRail, status, operationalHealth, portfolioChip]
  );

  const openWorkspace = (business: ClientBusiness) => {
    setSelectedBusiness(business);
    setSheetOpen(true);
  };

  const handleAction = (label: string) => {
    toast({
      title: 'Action recorded',
      description: `${label} will be available when the partner program launches.`,
    });
  };

  const handlePriorityAction = (priority: (typeof todaysPriorities)[0]) => {
    if (priority.businessId) {
      const business = clientBusinesses.find((b) => b.id === priority.businessId);
      if (business) {
        openWorkspace(business);
        return;
      }
    }
    handleAction(priority.ctaLabel);
  };

  const chartConfig = {
    volume: { label: 'Volume', color: 'hsl(var(--primary))' },
    value: { label: 'Value', color: 'hsl(var(--primary))' },
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 gap-0">
      <div className="min-w-0 flex-1 space-y-6 transition-all duration-300">
        <DemoModeBanner />

        {/* Command centre header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">Partner Workspace</h1>
              <Badge variant="secondary">Preview</Badge>
              <span className="flex items-center gap-1.5 text-xs text-green-600">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                6 clients active
              </span>
            </div>
            <p className="text-muted-foreground">
              Your operating system for managing every client business — payments, accounting,
              agreements, and settlements.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:min-w-[360px]">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search businesses, invoices, agreements..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="pl-9 transition-shadow focus:shadow-md"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="relative shrink-0 xl:hidden"
              onClick={() => setNotificationsOpen((v) => !v)}
            >
              <Bell className="h-4 w-4" />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-green-500" />
            </Button>
          </div>
        </div>

        {/* Today's Priorities */}
        <Card className="border-primary/20 bg-gradient-to-br from-background to-primary/5 shadow-sm transition-shadow hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CircleDot className="h-5 w-5 text-primary" />
              Today&apos;s Priorities
            </CardTitle>
            <CardDescription>Your daily task list — ordered by importance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {todaysPriorities.map((priority) => (
                <div
                  key={priority.id}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-background/80 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn('h-2.5 w-2.5 shrink-0 rounded-full', PRIORITY_DOT[priority.urgency])}
                    />
                    <span className="text-sm font-medium">{priority.label}</span>
                  </div>
                  <Button
                    variant={priority.urgency === 'critical' ? 'default' : 'outline'}
                    size="sm"
                    className="shrink-0"
                    onClick={() => handlePriorityAction(priority)}
                  >
                    {priority.ctaLabel}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Portfolio Value Hero */}
        <Card className="overflow-hidden border-0 bg-gradient-to-r from-primary/10 via-primary/5 to-background shadow-md">
          <CardContent className="p-6">
            <p className="mb-4 text-sm font-medium text-muted-foreground">Portfolio Overview</p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <p className="text-xs text-muted-foreground">Total Portfolio Revenue</p>
                <p className="text-2xl font-bold tracking-tight">
                  <AnimatedCounter value={portfolio.totalPortfolioRevenue} prefix="$" />
                </p>
                <p className="text-xs text-muted-foreground">Annual run rate</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Annual Processing Volume</p>
                <p className="text-2xl font-bold tracking-tight">
                  <AnimatedCounter value={portfolio.annualProcessingVolume} prefix="$" />
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Settled This Month</p>
                <p className="text-2xl font-bold tracking-tight text-green-600">
                  <AnimatedCounter value={portfolio.moneySettledThisMonth} prefix="$" />
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Outstanding Receivables</p>
                <p className="text-2xl font-bold tracking-tight text-amber-600">
                  <AnimatedCounter value={portfolio.outstandingReceivables} prefix="$" />
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Businesses Connected</p>
                <p className="text-2xl font-bold tracking-tight">
                  <AnimatedCounter value={portfolio.businessesConnected} />
                  <span className="text-lg text-muted-foreground">
                    /{metrics.totalClientBusinesses}
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Portfolio filter chips */}
        <div className="flex flex-wrap gap-2">
          {portfolioFilterChips.map((chip) => (
            <Button
              key={chip.id}
              variant={portfolioChip === chip.id ? 'default' : 'outline'}
              size="sm"
              className="rounded-full transition-all"
              onClick={() => setPortfolioChip(chip.id)}
            >
              {chip.label}
            </Button>
          ))}
        </div>

        {/* Businesses Requiring Attention */}
        <Card className="border-l-4 border-l-amber-500 transition-shadow hover:shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Businesses Requiring Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            {businessesRequiringAttention.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="h-8 w-8 text-green-500" />}
                title="All clear"
                description="No businesses require attention right now."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business</TableHead>
                    <TableHead>Issue</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Recommended Action</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {businessesRequiringAttention.map((row) => {
                    const business = clientBusinesses.find((b) => b.id === row.businessId);
                    return (
                      <TableRow key={row.id} className="transition-colors hover:bg-muted/30">
                        <TableCell className="font-medium">{row.business}</TableCell>
                        <TableCell>{row.issue}</TableCell>
                        <TableCell>
                          <AttentionSeverityBadge severity={row.severity} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">{row.recommendedAction}</TableCell>
                        <TableCell className="text-right">
                          {business && row.severity !== 'Healthy' ? (
                            <Button variant="outline" size="sm" onClick={() => openWorkspace(business)}>
                              Open Workspace
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Partner Revenue Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { title: 'Total Client Businesses', value: metrics.totalClientBusinesses, icon: Building2, sub: 'Active in portfolio' },
            { title: 'Monthly Payment Volume', value: metrics.monthlyPaymentVolume, icon: DollarSign, sub: 'Across all clients', prefix: '$' },
            { title: 'Estimated Partner Revenue', value: metrics.estimatedPartnerRevenue, icon: Receipt, sub: 'This month', prefix: '$', highlight: true },
            { title: 'Growth This Month', value: metrics.growthThisMonthPercent, icon: TrendingUp, sub: 'Payment volume', suffix: '%', prefix: '+' },
            { title: 'Businesses Ready to Bill', value: metrics.businessesReadyToBill, icon: CheckCircle2, sub: 'Fully onboarded' },
            { title: 'Businesses Needing Attention', value: metrics.businessesNeedingAttention, icon: AlertTriangle, sub: 'Require follow-up', warn: true },
            { title: 'Invoices Awaiting Reconciliation', value: metrics.invoicesAwaitingReconciliation, icon: FileText, sub: 'Across portfolio' },
            { title: 'Connected Accounting Platforms', value: metrics.connectedAccountingPlatforms, icon: Plug, sub: `Of ${metrics.totalClientBusinesses} clients` },
          ].map((card) => (
            <Card key={card.title} className="transition-all hover:shadow-md hover:-translate-y-0.5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <card.icon className={cn('h-4 w-4', card.warn ? 'text-amber-500' : 'text-muted-foreground')} />
              </CardHeader>
              <CardContent>
                <div className={cn('text-2xl font-bold', card.highlight && 'text-primary', card.warn && 'text-amber-600')}>
                  <AnimatedCounter
                    value={card.value}
                    prefix={card.prefix ?? ''}
                    suffix={card.suffix ?? ''}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{card.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* AI Portfolio Insights */}
        <Card className="border-dashed border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              AI Portfolio Insights
            </CardTitle>
            <CardDescription>Patterns and trends across your client portfolio</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {aiPortfolioInsights.map((insight) => (
                <div
                  key={insight.id}
                  className="flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/30"
                >
                  <TrendingUp
                    className={cn(
                      'mt-0.5 h-4 w-4 shrink-0',
                      insight.trend === 'up' && 'text-green-500',
                      insight.trend === 'down' && 'text-amber-500',
                      insight.trend === 'neutral' && 'text-blue-500'
                    )}
                  />
                  <p className="text-sm">{insight.text}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Operational Health + Pipeline */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Operational Health</CardTitle>
              <CardDescription>Click a metric to filter the client table</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {OPERATIONAL_HEALTH_ITEMS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setOperationalHealth(operationalHealth === item.key ? null : item.key)}
                    className={cn(
                      'rounded-lg border p-3 text-left transition-all hover:bg-muted/50 hover:shadow-sm',
                      operationalHealth === item.key && 'border-primary bg-primary/5 shadow-sm'
                    )}
                  >
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className={cn('text-2xl font-bold', item.color)}>
                      <AnimatedCounter value={operationalHealthMetrics[item.value]} />
                    </p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Client Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              {clientPipelineStages.map((stage, index) => (
                <div key={stage.stage}>
                  <div className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/50">
                    <span className={stage.stage === 'Active' ? 'font-semibold' : ''}>{stage.stage}</span>
                    <Badge variant={stage.stage === 'Active' ? 'default' : 'secondary'}>{stage.count}</Badge>
                  </div>
                  {index < clientPipelineStages.length - 1 && (
                    <div className="flex justify-center py-0.5">
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* AI Recommendations + Growth */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {aiRecommendations.length === 0 ? (
                <EmptyState title="No recommendations" description="You're all caught up." />
              ) : (
                aiRecommendations.map((rec) => (
                  <div key={rec.id} className="rounded-lg border p-4 transition-colors hover:bg-muted/20">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <RecommendationCategoryBadge category={rec.category} />
                      {rec.impact && <span className="text-xs font-medium text-green-600">{rec.impact}</span>}
                    </div>
                    <p className="mb-1 font-medium">{rec.title}</p>
                    <p className="mb-3 text-sm text-muted-foreground">{rec.description}</p>
                    <Button variant="outline" size="sm" onClick={() => handleAction(rec.ctaLabel)}>
                      {rec.ctaLabel}
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card className="border-dashed border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle>Partner Growth Opportunities</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="mb-6 space-y-3">
                {partnerGrowthOpportunities.map((opp) => (
                  <li key={opp.id} className="flex items-start gap-2 text-sm">
                    <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>
                      <strong>{opp.businessCount}</strong> — {opp.description}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="rounded-lg border bg-background p-4">
                <p className="text-sm text-muted-foreground">Estimated additional monthly revenue</p>
                <p className="text-3xl font-bold text-primary">
                  <AnimatedCounter value={estimatedAdditionalMonthlyRevenue} prefix="$" />
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Client Portfolio */}
        <Card>
          <CardHeader>
            <CardTitle>Client Portfolio</CardTitle>
            <CardDescription>
              {filteredBusinesses.length} of {clientBusinesses.length} businesses
              {(globalSearch || portfolioChip !== 'all' || operationalHealth) && ' (filtered)'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Filter table..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger className="w-full lg:w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {industryFilterOptions.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={health} onValueChange={setHealth}>
                <SelectTrigger className="w-full lg:w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {healthFilterOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={accounting} onValueChange={setAccounting}>
                <SelectTrigger className="w-full lg:w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {accountingFilterOptions.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Onboarding</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Accounting</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBusinesses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <EmptyState
                        icon={<Inbox className="h-8 w-8 text-muted-foreground" />}
                        title="No businesses found"
                        description="Try adjusting your search or filters to see more clients."
                        action={
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setGlobalSearch('');
                              setTableSearch('');
                              setPortfolioChip('all');
                              setOperationalHealth(null);
                            }}
                          >
                            Clear all filters
                          </Button>
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBusinesses.map((business) => (
                    <TableRow key={business.id} className="transition-colors hover:bg-muted/30">
                      <TableCell>
                        <BusinessHoverPreview business={business}>
                          <button
                            type="button"
                            className="flex items-center gap-2 font-medium hover:text-primary"
                            onClick={() => openWorkspace(business)}
                          >
                            <span
                              className={cn(
                                'flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold text-white',
                                business.logoColor
                              )}
                            >
                              {business.logoInitials}
                            </span>
                            {business.name}
                          </button>
                        </BusinessHoverPreview>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{business.industry}</TableCell>
                      <TableCell>
                        <OnboardingProgressIndicator progress={business.onboardingProgress} compact />
                      </TableCell>
                      <TableCell>
                        <RiskScoreIndicator
                          score={business.riskScore}
                          label={business.riskLabel}
                          size="sm"
                        />
                      </TableCell>
                      <TableCell>
                        <AccountingPlatformBadge
                          platform={business.accountingPlatform}
                          status={business.accountingConnectionStatus}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {business.outstandingInvoices}
                        <span className="ml-1 text-xs text-muted-foreground">
                          (${business.outstandingAmount.toLocaleString()})
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => openWorkspace(business)}>
                          Open Workspace
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Activity + Charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {groupedActivity.length === 0 ? (
                <EmptyState title="No recent activity" description="Events will appear here as they happen." />
              ) : (
                <div className="space-y-6">
                  {groupedActivity.map((group) => (
                    <div key={group.businessId}>
                      <div className="mb-3 flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">{group.businessName}</span>
                      </div>
                      <div className="ml-2 border-l-2 border-border pl-4">
                        {group.activities.map((activity, index) => (
                          <div key={activity.id} className={cn('relative flex gap-3 pb-4', index === group.activities.length - 1 && 'pb-0')}>
                            <div className="absolute -left-[21px] mt-0.5 rounded-full bg-background p-0.5">
                              {getActivityIcon(activity.type)}
                            </div>
                            <div>
                              <span className="text-sm font-medium">{activity.title}</span>
                              <p className="text-xs text-muted-foreground">{activity.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Monthly Payment Volume</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[280px]">
                <AreaChart data={monthlyPaymentVolume}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="volume" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} strokeWidth={2} />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            { title: 'Client Revenue Distribution', chart: 'pie' as const, data: clientRevenueDistribution },
            { title: 'Payment Method Breakdown', chart: 'barH' as const, data: paymentMethodBreakdown },
            { title: 'Outstanding Receivables', chart: 'bar' as const, data: outstandingReceivables },
          ].map((c) => (
            <Card key={c.title}>
              <CardHeader><CardTitle className="text-base">{c.title}</CardTitle></CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[220px]">
                  {c.chart === 'pie' ? (
                    <PieChart>
                      <Pie data={c.data} cx="50%" cy="50%" outerRadius={70} dataKey="value" nameKey="label">
                        {c.data.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  ) : c.chart === 'barH' ? (
                    <BarChart data={c.data} layout="vertical">
                      <XAxis type="number" tickFormatter={(v) => `${v}%`} />
                      <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 11 }} />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  ) : (
                    <BarChart data={c.data}>
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  )}
                </ChartContainer>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Coming Soon */}
        <div>
          <h2 className="mb-4 text-lg font-semibold text-muted-foreground">Coming Soon</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {comingSoonIntegrations.map((item) => (
              <Card key={item.id} className="opacity-60 grayscale transition-opacity hover:opacity-80">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
                    <Badge variant="secondary" className="text-[10px]">
                      <Lock className="mr-1 h-3 w-3" />
                      Coming Soon
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <PartnerWorkspaceSheet
          business={selectedBusiness}
          businesses={clientBusinesses}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          onSwitchBusiness={setSelectedBusiness}
        />
      </div>

      <NotificationsPanel open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </div>
  );
}
