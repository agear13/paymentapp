'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { OnboardingProgressIndicator } from '@/components/partner-preview/onboarding-progress-indicator';
import { AccountingPlatformBadge } from '@/components/partner-preview/partner-preview-badges';
import { RiskScoreIndicator } from '@/components/partner-preview/risk-score-indicator';
import type { ClientBusiness } from '@/lib/data/mock-partner-preview';
import { quickActions, workspaceNavItems } from '@/lib/data/mock-partner-preview';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  FileCheck,
  FileText,
  LayoutDashboard,
  Megaphone,
  Settings,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const NAV_ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  FileText,
  FileCheck,
  CircleDollarSign,
  Banknote,
  BarChart3,
  Megaphone,
  Settings,
};

interface PartnerWorkspaceSheetProps {
  business: ClientBusiness | null;
  businesses: ClientBusiness[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSwitchBusiness: (business: ClientBusiness) => void;
}

function getInvoiceStatusVariant(
  status: string
): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (status) {
    case 'Paid':
      return 'default';
    case 'Overdue':
      return 'destructive';
    case 'Outstanding':
      return 'secondary';
    default:
      return 'outline';
  }
}

function getRailStatusIcon(status: string) {
  switch (status) {
    case 'Connected':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'Disconnected':
    case 'Not configured':
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Clock className="h-4 w-4 text-amber-500" />;
  }
}

export function PartnerWorkspaceSheet({
  business,
  businesses,
  open,
  onOpenChange,
  onSwitchBusiness,
}: PartnerWorkspaceSheetProps) {
  const { toast } = useToast();

  const handleAction = (label: string) => {
    toast({
      title: 'Action recorded',
      description: `${label} will be available when the partner program launches.`,
    });
  };

  if (!business) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
      >
        <div className="sticky top-0 z-10 shrink-0 border-b bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <Button
            variant="ghost"
            size="sm"
            className="mb-3 -ml-2 gap-1 text-muted-foreground"
            onClick={() => onOpenChange(false)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Partner Workspace
          </Button>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex gap-4">
              <div
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white shadow-sm ${business.logoColor}`}
              >
                {business.logoInitials}
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Viewing Workspace
                </p>
                <h2 className="text-2xl font-bold tracking-tight">{business.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {business.industry} · {business.overview.location}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <RiskScoreIndicator
                score={business.riskScore}
                label={business.riskLabel}
                size="sm"
              />
              <AccountingPlatformBadge
                platform={business.accountingPlatform}
                status={business.accountingConnectionStatus}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Select
              value={business.id}
              onValueChange={(id) => {
                const next = businesses.find((b) => b.id === id);
                if (next) onSwitchBusiness(next);
              }}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Switch workspace" />
              </SelectTrigger>
              <SelectContent>
                {businesses.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              Last synced{' '}
              {business.accountingStatus.lastSync === '—'
                ? 'never'
                : new Date(business.accountingStatus.lastSync).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
            </span>
            <span className="relative flex items-center gap-1.5 text-xs text-green-600">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
              Live
            </span>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <aside className="hidden w-48 shrink-0 overflow-y-auto border-r bg-muted/20 p-3 md:block">
            <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Navigation
            </p>
            <nav className="space-y-0.5">
              {workspaceNavItems.map((item, index) => {
                const Icon = NAV_ICONS[item.icon] ?? LayoutDashboard;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                      index === 0
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-muted-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </div>
                );
              })}
            </nav>
          </aside>

          <div className="flex-1 overflow-y-auto p-6 transition-opacity duration-200">
            <div className="mb-6 flex flex-wrap items-center gap-4">
              <OnboardingProgressIndicator progress={business.onboardingProgress} />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Business Overview</h3>
                <div className="grid grid-cols-2 gap-3 rounded-lg border p-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Contact</p>
                    <p className="font-medium">{business.overview.contactName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Onboarded</p>
                    <p className="font-medium">{business.overview.onboardedAt}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Monthly volume</p>
                    <p className="font-medium">
                      ${business.overview.monthlyVolume.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Active invoices</p>
                    <p className="font-medium">{business.overview.activeInvoices}</p>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Payment Health</h3>
                <div className="rounded-lg border p-4 text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Success rate</span>
                    <span className="font-medium">{business.paymentHealth.successRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Failed (30d)</span>
                    <span>{business.paymentHealth.failedPayments30d}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg settlement</span>
                    <span>{business.paymentHealth.avgSettlementDays} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge
                      variant={
                        business.paymentHealth.status === 'Good'
                          ? 'default'
                          : business.paymentHealth.status === 'Fair'
                            ? 'secondary'
                            : 'destructive'
                      }
                    >
                      {business.paymentHealth.status}
                    </Badge>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Accounting</h3>
                <div className="rounded-lg border p-4 text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Platform</span>
                    <span className="font-medium">{business.accountingStatus.platform}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Connection</span>
                    <Badge
                      variant={
                        business.accountingStatus.connection === 'Connected'
                          ? 'default'
                          : 'destructive'
                      }
                    >
                      {business.accountingStatus.connection}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last sync</span>
                    <span>
                      {business.accountingStatus.lastSync === '—'
                        ? '—'
                        : new Date(business.accountingStatus.lastSync).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Unreconciled</span>
                    <span>{business.accountingStatus.unreconciledCount} items</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {business.paymentRails.map((rail) => (
                    <div
                      key={rail.rail}
                      className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        {getRailStatusIcon(rail.status)}
                        {rail.rail}
                      </div>
                      <Badge variant={rail.status === 'Connected' ? 'default' : 'secondary'}>
                        {rail.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Recent Activity</h3>
                <div className="space-y-2">
                  {business.workspaceActivity.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{activity.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(activity.timestamp).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-3 lg:col-span-2">
                <h3 className="text-sm font-semibold">Agreement Analyzer</h3>
                <div className="rounded-lg border p-4 text-sm">
                  <div className="mb-3 flex gap-6">
                    <div>
                      <p className="text-muted-foreground">Reviewed</p>
                      <p className="font-semibold">
                        {business.agreementAnalyzerSummary.agreementsReviewed}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Open issues</p>
                      <p className="font-semibold">
                        {business.agreementAnalyzerSummary.openIssues}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Last review</p>
                      <p className="font-semibold">
                        {business.agreementAnalyzerSummary.lastReview}
                      </p>
                    </div>
                  </div>
                  <p className="text-muted-foreground">
                    {business.agreementAnalyzerSummary.summary}
                  </p>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Revenue Summary</h3>
                <div className="rounded-lg border p-4 text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monthly revenue</span>
                    <span className="font-semibold">
                      ${business.revenueSummary.monthlyRevenue.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">YTD revenue</span>
                    <span>${business.revenueSummary.ytdRevenue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Outstanding</span>
                    <span>${business.revenueSummary.outstandingReceivables.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-muted-foreground">Partner fee est.</span>
                    <span className="font-semibold text-primary">
                      ${business.revenueSummary.partnerFeeEstimate.toLocaleString()}/mo
                    </span>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Settlement Status</h3>
                <div className="rounded-lg border p-4 text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pending</span>
                    <span className="font-semibold">
                      ${business.settlementStatus.pendingAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last settlement</span>
                    <span>{business.settlementStatus.lastSettlement}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Next settlement</span>
                    <span>{business.settlementStatus.nextSettlement}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge
                      variant={
                        business.settlementStatus.status === 'On schedule'
                          ? 'default'
                          : business.settlementStatus.status === 'Delayed'
                            ? 'secondary'
                            : 'destructive'
                      }
                    >
                      {business.settlementStatus.status}
                    </Badge>
                  </div>
                </div>
              </section>

              <section className="space-y-3 lg:col-span-2">
                <h3 className="text-sm font-semibold">Outstanding Invoices</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {business.recentInvoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.reference}</TableCell>
                        <TableCell className="text-right">
                          ${invoice.amount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getInvoiceStatusVariant(invoice.status)}>
                            {invoice.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{invoice.dueDate}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </section>

              <section className="space-y-3 lg:col-span-2">
                <h3 className="text-sm font-semibold">Recommended Actions</h3>
                <ul className="space-y-2">
                  {business.recommendedActions.map((action) => (
                    <li
                      key={action}
                      className="flex items-start gap-2 rounded-lg border p-3 text-sm"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      {action}
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <Separator className="my-6" />

            <section>
              <h3 className="mb-3 text-sm font-semibold">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {quickActions.map((action) => (
                  <Button
                    key={action.id}
                    variant="outline"
                    size="sm"
                    className="justify-start"
                    onClick={() => handleAction(action.label)}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            </section>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
