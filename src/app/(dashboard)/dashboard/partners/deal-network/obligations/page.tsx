'use client';

/**
 * Operator obligations view — who is owed what, funding status, and payout readiness.
 */

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  PAYOUTS_HUB_HREF,
  PAYOUTS_SETTLEMENTS_HREF,
} from '@/lib/navigation/operator-nav';
import { PAYOUT_TRUST_COPY } from '@/lib/payouts/payout-trust-copy';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  RefreshCw,
  ArrowLeft,
  ChevronDown,
  AlertTriangle,
  Clock,
  CircleDollarSign,
  CheckCircle2,
  Ban,
  FileWarning,
} from 'lucide-react';
import type { DealNetworkPilotObligationStatus } from '@prisma/client';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { PilotParticipantOnboardingStatus } from '@/lib/deal-network-demo/participant-onboarding';
import {
  isApprovedButNotOnboarded,
  isOnboardingComplete,
} from '@/lib/deal-network-demo/participant-onboarding';
import { useOrganizationCurrency } from '@/hooks/use-organization-currency';
import { formatPayoutCurrency } from '@/lib/payouts/format-payout-currency';
import {
  getObligationBlockingIssue,
  getObligationNextAction,
  operatorStatusLabel,
} from '@/lib/payouts/obligation-status-labels';
import {
  readNeedsAttentionPreference,
  writeNeedsAttentionPreference,
} from '@/lib/payouts/payout-operator-preferences';
import { PayoutEmptyState } from '@/components/payouts/payout-empty-state';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { PayoutGlossaryTooltip } from '@/components/payouts/payout-glossary-tooltip';
import { cn } from '@/lib/utils';
import { OperationalSettlementInitialization } from '@/components/operations/operational-settlement-initialization';
import { ReleaseInteractionNotice } from '@/components/payouts/release-interaction-notice';
import { useOperationalCoordinationState } from '@/hooks/use-operational-coordination-state';
import { subscribeOperationalWindowEvents } from '@/lib/operations/orchestration/operational-event-bus';
import { useOperationalTimelineProjection } from '@/hooks/use-operational-timeline-projection';
import { safeObligationsProjection } from '@/lib/operations/coordination/safe-obligations-projection';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type ObligationRow = {
  id: string;
  deal_id: string;
  participant_id: string | null;
  obligation_type: string;
  amount_owed: unknown;
  currency: string;
  status: DealNetworkPilotObligationStatus;
  calculation_explanation: string;
  payment_event_id: string | null;
  deal: { id: string; name: string; partner: string } | null;
  participant: {
    id: string;
    name: string;
    role: string;
    email: string | null;
    approvalStatus?: string;
    onboardingStatus?: PilotParticipantOnboardingStatus;
  } | null;
  payment_event: {
    id: string;
    source_type: string | null;
    payment_link_id: string | null;
    event_type: string;
    gross_amount: unknown;
    amount_received: unknown;
    currency_received: string | null;
    received_at: string | null;
  } | null;
};

const STATUS_OPTIONS: DealNetworkPilotObligationStatus[] = [
  'UNFUNDED',
  'PARTIALLY_FUNDED',
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'AVAILABLE_FOR_PAYOUT',
  'PAID',
  'REJECTED',
  'REVERSED',
];

/** Statuses that typically require operator follow-up (authoritative enum values only). */
const NEEDS_ACTION_STATUSES = new Set<DealNetworkPilotObligationStatus>([
  'UNFUNDED',
  'PARTIALLY_FUNDED',
  'PENDING_APPROVAL',
  'AVAILABLE_FOR_PAYOUT',
]);

function toNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  const n = Number(String(v));
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(amount: number, currency: string, orgDefault: string): string {
  return formatPayoutCurrency(amount, currency, orgDefault);
}

function statusLabel(s: DealNetworkPilotObligationStatus): string {
  return s.replace(/_/g, ' ');
}

/** Badge variant — uses design-system tokens (fintech / operator). */
function statusBadgeVariant(
  s: DealNetworkPilotObligationStatus
): 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' {
  switch (s) {
    case 'UNFUNDED':
      return 'warning';
    case 'PARTIALLY_FUNDED':
      return 'warning';
    case 'PENDING_APPROVAL':
      return 'info';
    case 'AVAILABLE_FOR_PAYOUT':
      return 'success';
    case 'APPROVED':
      return 'secondary';
    case 'PAID':
      return 'default';
    case 'REJECTED':
    case 'REVERSED':
      return 'destructive';
    case 'DRAFT':
    default:
      return 'outline';
  }
}

function statusRowAccent(s: DealNetworkPilotObligationStatus): string {
  switch (s) {
    case 'UNFUNDED':
    case 'PARTIALLY_FUNDED':
      return 'border-l-2 border-l-amber-400/80';
    case 'PENDING_APPROVAL':
      return 'border-l-2 border-l-sky-400/70';
    case 'AVAILABLE_FOR_PAYOUT':
      return 'border-l-2 border-l-emerald-500/90';
    case 'REJECTED':
    case 'REVERSED':
      return 'border-l-2 border-l-red-400/70';
    default:
      return '';
  }
}

function StatusBadge({
  status,
  participant,
}: {
  status: DealNetworkPilotObligationStatus;
  participant?: ObligationRow['participant'];
}) {
  const demoParticipant = participant
    ? ({
        id: participant.id,
        name: participant.name,
        role: participant.role,
        approvalStatus:
          participant.approvalStatus === 'Approved' ? 'Approved' : 'Pending approval',
        onboardingStatus: participant.onboardingStatus,
      } as DemoParticipant)
    : null;
  const variant = statusBadgeVariant(status);
  const label = operatorStatusLabel(status, demoParticipant);
  const icon =
    status === 'UNFUNDED' || status === 'PARTIALLY_FUNDED' ? (
      <AlertTriangle className="size-3 shrink-0" aria-hidden />
    ) : status === 'PENDING_APPROVAL' ? (
      <Clock className="size-3 shrink-0" aria-hidden />
    ) : status === 'AVAILABLE_FOR_PAYOUT' ? (
      <CircleDollarSign className="size-3 shrink-0" aria-hidden />
    ) : status === 'PAID' ? (
      <CheckCircle2 className="size-3 shrink-0" aria-hidden />
    ) : status === 'REJECTED' || status === 'REVERSED' ? (
      <Ban className="size-3 shrink-0" aria-hidden />
    ) : status === 'DRAFT' ? (
      <FileWarning className="size-3 shrink-0" aria-hidden />
    ) : null;

  return (
    <Badge
      variant={variant}
      className="max-w-[140px] gap-1 font-normal text-[11px] px-1.5 py-0 transition-colors"
    >
      {icon}
      <span className="truncate">{label}</span>
    </Badge>
  );
}

function paidAndOutstanding(row: ObligationRow): { paid: number; outstanding: number } {
  const owed = toNumber(row.amount_owed);
  if (row.status === 'PAID') {
    return { paid: owed, outstanding: 0 };
  }
  if (row.status === 'REJECTED' || row.status === 'REVERSED') {
    return { paid: 0, outstanding: 0 };
  }
  return { paid: 0, outstanding: owed };
}

/** Monetary totals from obligation table rows — not operational readiness KPIs. */
function computeObligationMonetaryTotals(rows: ObligationRow[]) {
  let totalOwed = 0;
  let totalPaid = 0;
  let totalOutstanding = 0;
  let totalUnfunded = 0;
  let totalPartiallyFunded = 0;
  let availableForPayoutCount = 0;
  let availableForPayoutAmount = 0;
  const currencies = new Set<string>();

  for (const r of rows) {
    const code = (r.currency || '').trim().toUpperCase();
    if (code.length === 3) currencies.add(code);
    const owed = toNumber(r.amount_owed);
    const { paid, outstanding } = paidAndOutstanding(r);
    totalOwed += owed;
    totalPaid += paid;
    totalOutstanding += outstanding;
    if (r.status === 'UNFUNDED') {
      totalUnfunded += owed;
    }
    if (r.status === 'PARTIALLY_FUNDED') {
      totalPartiallyFunded += owed;
    }
    if (r.status === 'AVAILABLE_FOR_PAYOUT') {
      availableForPayoutCount += 1;
      availableForPayoutAmount += owed;
    }
  }

  const singleCurrency = currencies.size === 1 ? [...currencies][0]! : null;
  const mixedCurrency = currencies.size > 1;

  return {
    totalOwed,
    totalPaid,
    totalOutstanding,
    totalUnfunded,
    totalPartiallyFunded,
    availableForPayoutCount,
    availableForPayoutAmount,
    singleCurrency,
    mixedCurrency,
  };
}

function ObligationRowDetailPanel({
  row,
  orgCurrency,
}: {
  row: ObligationRow;
  orgCurrency: string;
}) {
  const participantApprovedNotOnboarded =
    row.participant &&
    row.obligation_type !== 'PLATFORM_FEE' &&
    isApprovedButNotOnboarded({
      id: row.participant.id,
      approvalStatus:
        row.participant.approvalStatus === 'Approved' ? 'Approved' : 'Pending approval',
      onboardingStatus: row.participant.onboardingStatus,
    });
  const onboardingDone =
    row.participant?.onboardingStatus != null
      ? isOnboardingComplete(row.participant.onboardingStatus)
      : true;
  const roleLabel =
    row.participant?.role ??
    (row.obligation_type === 'PLATFORM_FEE' ? 'Platform fee' : '—');
  const pe = row.payment_event;
  const paymentLabel = pe?.source_type
    ? String(pe.source_type).replace(/_/g, ' ')
    : pe
      ? 'Customer payment'
      : 'Not linked';
  const blocking = getObligationBlockingIssue(row);

  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      {blocking ? (
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground text-xs">Blocking issue</dt>
          <dd className="font-medium">{blocking}</dd>
        </div>
      ) : null}
      <div>
        <dt className="text-muted-foreground text-xs">Role</dt>
        <dd>{roleLabel}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground text-xs">Participant readiness</dt>
        <dd>
          {row.obligation_type === 'PLATFORM_FEE'
            ? '—'
            : participantApprovedNotOnboarded
              ? 'Setup required'
              : row.participant
                ? onboardingDone
                  ? 'Ready'
                  : 'Pending setup'
                : '—'}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground text-xs">Payment source</dt>
        <dd>{paymentLabel}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground text-xs">Payout status</dt>
        <dd>{operatorStatusLabel(row.status)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground text-xs">Outstanding</dt>
        <dd className="tabular-nums font-medium">
          {formatMoney(toNumber(row.amount_owed), row.currency, orgCurrency)}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground text-xs">Project reference</dt>
        <dd className="font-mono text-xs break-all">{row.deal_id}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground text-xs">Line reference</dt>
        <dd className="font-mono text-xs break-all">{row.id}</dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="text-muted-foreground text-xs mb-1">Calculation</dt>
        <dd className="text-muted-foreground leading-relaxed text-xs">
          {row.calculation_explanation}
        </dd>
      </div>
    </dl>
  );
}

function matchesSearch(row: ObligationRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    row.deal?.name,
    row.deal_id,
    row.participant?.name,
    row.participant?.email,
    row.participant?.role,
    row.obligation_type,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

function DealNetworkObligationsPageContent() {
  const { currency: orgCurrency } = useOrganizationCurrency();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    readiness,
    settlementInitialization,
    operationalOnboarding,
    operationalInitialization,
    loading: activationLoading,
    guidance,
    graphSnapshotConverged,
    releaseInteraction,
    kpis,
  } = useOperationalCoordinationState({ traceSurface: 'obligations-page' });
  const timelineProjection = useOperationalTimelineProjection();
  const isPayoutsRoute = pathname?.startsWith('/dashboard/payouts') ?? false;
  const backHref = isPayoutsRoute ? PAYOUTS_HUB_HREF : '/dashboard/partners/deal-network';
  const backLabel = isPayoutsRoute ? 'Back to Payouts' : 'Back to Deal Network';

  const [allRows, setAllRows] = React.useState<ObligationRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [dealFilter, setDealFilter] = React.useState<string>('__all__');
  const [statusFilter, setStatusFilter] = React.useState<string>('__all__');
  const [participantFilter, setParticipantFilter] = React.useState<string>('__all__');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [needsActionOnly, setNeedsActionOnly] = React.useState(isPayoutsRoute);
  const [expandedRowId, setExpandedRowId] = React.useState<string | null>(null);
  const [sheetRow, setSheetRow] = React.useState<ObligationRow | null>(null);
  const isMobile = useIsMobile();

  React.useEffect(() => {
    const stored = readNeedsAttentionPreference();
    if (stored !== null && isPayoutsRoute) {
      setNeedsActionOnly(stored);
    }
    if (searchParams.get('needsAction') === '1') {
      setNeedsActionOnly(true);
    }
    const status = searchParams.get('status');
    if (status && STATUS_OPTIONS.includes(status as DealNetworkPilotObligationStatus)) {
      setStatusFilter(status);
      if (status !== '__all__') setNeedsActionOnly(false);
    }
    if (searchParams.get('focus') === 'unfunded') {
      setNeedsActionOnly(true);
      setStatusFilter('UNFUNDED');
    }
  }, [searchParams, isPayoutsRoute]);

  const setNeedsAttention = React.useCallback((value: boolean) => {
    setNeedsActionOnly(value);
    writeNeedsAttentionPreference(value);
    if (value) setStatusFilter('__all__');
  }, []);

  const hasOperationalEvidence = React.useMemo(
    () =>
      (kpis?.participantCount ?? 0) > 0 ||
      (kpis?.earningsConfiguredCount ?? 0) > 0 ||
      (kpis?.obligationCount ?? 0) > 0 ||
      allRows.length > 0,
    [allRows.length, kpis]
  );

  const showInitializationShell =
    settlementInitialization.showInitializationShell && !hasOperationalEvidence;

  const load = React.useCallback(async () => {

    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/deal-network-pilot/obligations', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (res.status === 401) {
        setLoadError('You need to be signed in to view payout obligations.');
        setAllRows([]);
        return;
      }
      if (!res.ok) {
        setLoadError(null);
        setAllRows([]);
        return;
      }
      const json = (await res.json()) as { data: ObligationRow[] };
      setAllRows(Array.isArray(json.data) ? json.data : []);
    } catch {
      setLoadError(null);
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    return subscribeOperationalWindowEvents(() => {
      void load();
    });
  }, [load]);

  const rows = React.useMemo(() => {
    return allRows.filter((r) => {
      if (needsActionOnly && !NEEDS_ACTION_STATUSES.has(r.status)) return false;
      if (dealFilter !== '__all__' && r.deal_id !== dealFilter) return false;
      if (statusFilter !== '__all__' && r.status !== statusFilter) return false;
      if (participantFilter !== '__all__' && r.participant_id !== participantFilter) return false;
      if (!matchesSearch(r, searchQuery)) return false;
      return true;
    });
  }, [allRows, needsActionOnly, dealFilter, statusFilter, participantFilter, searchQuery]);

  const kpi = React.useMemo(() => computeObligationMonetaryTotals(rows), [rows]);

  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'development' || !kpis) return;
    if (dealFilter !== '__all__' || statusFilter !== '__all__' || participantFilter !== '__all__') {
      return;
    }
    if (allRows.length > 0 && kpis.obligationCount !== allRows.length) {
      console.warn(
        `[convergence-warning] obligations table row count (${allRows.length}) !== canonical obligationCount (${kpis.obligationCount})`
      );
    }
  }, [allRows.length, dealFilter, kpis, participantFilter, statusFilter]);

  const formatKpiAmount = (n: number) => {
    if (kpi.mixedCurrency) return '—';
    const ccy = kpi.singleCurrency ?? orgCurrency;
    return formatMoney(n, ccy, orgCurrency);
  };

  const dealOptions = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const r of allRows) {
      const id = r.deal_id;
      const label = r.deal?.name ?? id;
      if (!m.has(id)) m.set(id, label);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [allRows]);

  const participantOptions = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const r of allRows) {
      if (r.participant_id && r.participant) {
        m.set(r.participant_id, r.participant.name);
      }
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [allRows]);

  const needsActionCount = React.useMemo(
    () => allRows.filter((r) => NEEDS_ACTION_STATUSES.has(r.status)).length,
    [allRows]
  );

  const onboardingPayoutGateBlocked = React.useMemo(
    () =>
      allRows.some(
        (r) =>
          r.obligation_type !== 'PLATFORM_FEE' &&
          r.participant != null &&
          isApprovedButNotOnboarded({
            id: r.participant.id,
            approvalStatus:
              r.participant.approvalStatus === 'Approved' ? 'Approved' : 'Pending approval',
            onboardingStatus: r.participant.onboardingStatus,
          })
      ),
    [allRows]
  );

  const obligationsProjection = React.useMemo(
    () =>
      safeObligationsProjection({
        readiness,
        settlementShowShell: showInitializationShell,
        timelineProjection,
        nextActions: guidance.actions,
        loadError,
        obligationsAvailable: allRows.length > 0 || (kpis?.obligationCount ?? 0) > 0,
      }),
    [
      allRows.length,
      guidance.actions,
      kpis?.obligationCount,
      loadError,
      readiness,
      showInitializationShell,
      timelineProjection,
    ]
  );

  if (showInitializationShell) {
    return (
      <div className="mx-auto max-w-7xl space-y-8 p-4 md:p-8">
        <Button variant="ghost" size="sm" asChild className="-ml-2 h-8 px-2">
          <Link href={backHref}>
            <ArrowLeft className="mr-1 size-4" />
            {backLabel}
          </Link>
        </Button>
        <OperationalSettlementInitialization
          onboarding={operationalOnboarding}
          initialization={operationalInitialization}
          loading={activationLoading}
          graphSnapshotConverged={graphSnapshotConverged}
          nextActions={guidance.actions}
        >
          {null}
        </OperationalSettlementInitialization>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2 h-8 px-2">
            <Link href={backHref}>
              <ArrowLeft className="mr-1 size-4" />
              {backLabel}
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Obligations</h1>
            <PayoutGlossaryTooltip term="obligation" />
          </div>
          <p className="text-muted-foreground text-sm">
            Track what is owed, what is funded, and what is ready for payout.
          </p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void load()}
                disabled={loading}
                aria-label="Refresh payout data"
              >
                <RefreshCw className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh payout data</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {!releaseInteraction.releaseInteractionEnabled ? (
        <ReleaseInteractionNotice state={releaseInteraction} />
      ) : null}

      {obligationsProjection.degraded && obligationsProjection.guidance ? (
        <Alert className="border-primary/20 bg-primary/[0.03]">
          <AlertTitle>{obligationsProjection.headline}</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{obligationsProjection.guidance}</p>
            {obligationsProjection.nextActions[0] ? (
              <p className="text-sm font-medium text-foreground">
                Next: {obligationsProjection.nextActions[0].action} —{' '}
                {obligationsProjection.nextActions[0].reason}
              </p>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Sign-in required</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      {!loading && onboardingPayoutGateBlocked ? (
        <Alert className="border-amber-300/90 bg-amber-50/90 dark:border-amber-800/80 dark:bg-amber-950/40">
          <AlertTriangle className="h-4 w-4 text-amber-800 dark:text-amber-400" aria-hidden />
          <AlertTitle className="text-amber-950 dark:text-amber-100">
            Payout cannot be executed until onboarding is complete
          </AlertTitle>
          <AlertDescription className="text-amber-900/95 dark:text-amber-100/90">
            At least one payout line has an <strong>approved</strong> participant who has not finished{' '}
            <strong>onboarding</strong>. Use Deal Network to mark onboarding complete before paying out.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-5">
        <div className="grid gap-6 sm:grid-cols-[1.15fr_1fr] sm:items-end">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Outstanding</p>
            <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl">
              {loading ? '…' : formatKpiAmount(kpi.totalOutstanding)}
            </p>
          </div>
          <div className="sm:text-right sm:pb-1">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              Ready for payout
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-800 dark:text-emerald-300 sm:text-3xl">
              {loading ? '…' : formatKpiAmount(kpi.availableForPayoutAmount)}
            </p>
            {!loading ? (
              kpi.availableForPayoutCount > 0 ? (
                <>
                  <p className="mt-1 text-xs text-emerald-800/70 dark:text-emerald-400/80">
                    {kpi.availableForPayoutCount} payout
                    {kpi.availableForPayoutCount === 1 ? '' : 's'} ready to release
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 sm:justify-end">
                    {releaseInteraction.canCreateReleaseBatch ? (
                      <Button size="sm" variant="default" className="h-8 shadow-sm" asChild>
                        <Link href={PAYOUTS_SETTLEMENTS_HREF}>Create release batch</Link>
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" className="h-8" asChild>
                      <Link href={`${PAYOUTS_OBLIGATIONS_HREF}?status=AVAILABLE_FOR_PAYOUT`}>
                        Review payouts
                      </Link>
                    </Button>
                  </div>
                </>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">None ready to release</p>
              )
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground/90 border-t border-border/25 pt-3">
          <span>
            <span className="text-amber-800/80 dark:text-amber-400/90">Needs funding</span>{' '}
            {loading ? '…' : formatKpiAmount(kpi.totalUnfunded)}
          </span>
          <span>
            Total paid {loading ? '…' : formatKpiAmount(kpi.totalPaid)}
          </span>
          <span>
            Payout lines {loading ? '…' : rows.length}
          </span>
          {kpi.mixedCurrency && rows.length > 0 ? (
            <span className="text-amber-700/80 dark:text-amber-400/80">Multiple currencies</span>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground/60">{PAYOUT_TRUST_COPY.activityRecorded}</p>
      </div>

      <div className="sticky top-0 z-10 -mx-4 border-b border-border/25 bg-background/98 px-4 py-2 backdrop-blur-sm md:-mx-8 md:px-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
          <div
            className={cn(
              'flex items-center gap-2 shrink-0 rounded-md px-2 py-1 transition-colors',
              needsActionOnly && 'bg-amber-500/8 ring-1 ring-amber-500/20'
            )}
          >
            <Switch
              id="needs-action"
              checked={needsActionOnly}
              onCheckedChange={setNeedsAttention}
              aria-label="Show only obligations that need attention"
            />
            <Label htmlFor="needs-action" className="text-sm font-medium cursor-pointer whitespace-nowrap">
              Needs attention
              <span className="text-muted-foreground font-normal ml-1">({needsActionCount})</span>
            </Label>
          </div>
          <Input
            id="obligation-search"
            className="h-9 flex-1"
            placeholder="Search project or participant…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search obligations"
          />
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              if (v !== '__all__') {
                setNeedsActionOnly(false);
                writeNeedsAttentionPreference(false);
              }
            }}
          >
            <SelectTrigger className="h-9 w-full sm:w-[180px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {operatorStatusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 transition-transform duration-200 ease-out',
                advancedOpen && 'rotate-180'
              )}
            />
            Advanced filters
          </CollapsibleTrigger>
          <CollapsibleContent className="overflow-hidden transition-all data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 duration-200">
            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
              <Select value={dealFilter} onValueChange={setDealFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All projects</SelectItem>
                  {dealOptions.map(([id, label]) => (
                    <SelectItem key={id} value={id}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={participantFilter} onValueChange={setParticipantFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All participants" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All participants</SelectItem>
                  {participantOptions.map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="space-y-3 pt-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">Payout lines</h2>
          <p className="text-muted-foreground text-xs">
            {loading ? 'Loading…' : `${rows.length} in view`}
          </p>
        </div>
        {!loading && rows.length === 0 ? (
          <PayoutEmptyState
            iconVariant="default"
            title="No payout lines in this view"
            description={
              needsActionOnly
                ? 'No lines need attention. Turn off Needs attention or adjust filters to see all payout lines.'
                : 'Participant payout obligations will appear here once earnings and funding are configured.'
            }
            action={
              needsActionOnly ? (
                <Button variant="outline" size="sm" onClick={() => setNeedsAttention(false)}>
                  Show all payout lines
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto -mx-1 px-1">
            <Table className="border-separate border-spacing-0">
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border/20">
                  <TableHead className="w-8 hidden md:table-cell" />
                  <TableHead>Project</TableHead>
                  <TableHead>Participant</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead>Next action</TableHead>
                  <TableHead className="hidden lg:table-cell">Blocking issue</TableHead>
                  <TableHead className="w-[120px]">
                    <span className="text-xs text-muted-foreground">Status</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!loading &&
                  rows.map((row) => {
                    const { outstanding } = paidAndOutstanding(row);
                    const participantLabel =
                      row.participant?.name ??
                      (row.obligation_type === 'PLATFORM_FEE' ? 'Platform' : '—');
                    const dealLabel = row.deal?.name ?? row.deal_id;
                    const expanded = expandedRowId === row.id;
                    let nextAction = 'Review';
                    let blocking: string | null = null;
                    try {
                      nextAction = getObligationNextAction(row);
                      blocking = getObligationBlockingIssue(row);
                    } catch {
                      nextAction = 'Review obligation line';
                      blocking = null;
                    }

                    const openDetail = () => {
                      if (isMobile) {
                        setSheetRow(row);
                      } else {
                        setExpandedRowId(expanded ? null : row.id);
                      }
                    };

                    return (
                      <React.Fragment key={row.id}>
                        <TableRow
                          className={cn(
                            statusRowAccent(row.status),
                            'cursor-pointer md:cursor-default border-b border-border/15',
                            'transition-colors hover:bg-muted/20 [&>td]:py-5'
                          )}
                          onClick={() => {
                            if (isMobile) openDetail();
                          }}
                        >
                          <TableCell className="w-8 p-2 hidden md:table-cell">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              aria-label={expanded ? 'Collapse details' : 'Expand details'}
                              onClick={(e) => {
                                e.stopPropagation();
                                openDetail();
                              }}
                            >
                              <ChevronDown
                                className={cn(
                                  'h-4 w-4 transition-transform',
                                  expanded && 'rotate-180'
                                )}
                              />
                            </Button>
                          </TableCell>
                          <TableCell className="max-w-[180px]">
                            <div className="truncate font-medium" title={dealLabel}>
                              {dealLabel}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[160px]">
                            <div className="truncate text-sm" title={participantLabel}>
                              {participantLabel}
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">
                            {formatMoney(outstanding, row.currency, orgCurrency)}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-semibold text-foreground">
                              {nextAction}
                            </span>
                            {blocking && isMobile ? (
                              <p className="text-[11px] text-muted-foreground/70 mt-1 lg:hidden">
                                {blocking}
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-xs text-muted-foreground/75 max-w-[160px]">
                            {blocking ?? '—'}
                          </TableCell>
                          <TableCell className="opacity-80">
                            <StatusBadge status={row.status} participant={row.participant} />
                          </TableCell>
                        </TableRow>
                        {expanded && !isMobile ? (
                          <TableRow className="bg-muted/15 hover:bg-muted/15 border-0">
                            <TableCell colSpan={7} className="py-4">
                              <ObligationRowDetailPanel row={row} orgCurrency={orgCurrency} />
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Sheet open={sheetRow != null} onOpenChange={(open) => !open && setSheetRow(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] rounded-t-xl">
          {sheetRow ? (
            <>
              <SheetHeader>
                <SheetTitle className="text-left">
                  {sheetRow.deal?.name ?? sheetRow.deal_id}
                </SheetTitle>
                <SheetDescription className="text-left">
                  {sheetRow.participant?.name ?? 'Payout line details'}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 overflow-y-auto pb-6">
                <ObligationRowDetailPanel row={sheetRow} orgCurrency={orgCurrency} />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function DealNetworkObligationsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="mx-auto max-w-7xl p-8 text-muted-foreground text-sm">Loading obligations…</div>
      }
    >
      <DealNetworkObligationsPageContent />
    </React.Suspense>
  );
}
