'use client';

/**
 * Read-only operator view: pilot commission obligations (who is owed what).
 * Data: GET /api/deal-network-pilot/obligations — no writes from this screen.
 * KPIs and filters derive from loaded rows + authoritative status only (no payout math).
 */

import * as React from 'react';
import Link from 'next/link';
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
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  RefreshCw,
  ArrowLeft,
  HelpCircle,
  AlertTriangle,
  Clock,
  CircleDollarSign,
  CheckCircle2,
  Ban,
  FileWarning,
} from 'lucide-react';
import type { DealNetworkPilotObligationStatus } from '@prisma/client';

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
  participant: { id: string; name: string; role: string; email: string | null } | null;
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
  'PENDING_APPROVAL',
  'AVAILABLE_FOR_PAYOUT',
]);

function toNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  const n = Number(String(v));
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.length === 3 ? currency : 'USD',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
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
      return 'border-l-4 border-l-amber-500 bg-amber-50/40 dark:bg-amber-950/25';
    case 'PENDING_APPROVAL':
      return 'border-l-4 border-l-sky-600 bg-sky-50/35 dark:bg-sky-950/25';
    case 'AVAILABLE_FOR_PAYOUT':
      return 'border-l-4 border-l-emerald-600 bg-emerald-50/35 dark:bg-emerald-950/25';
    case 'PAID':
      return 'bg-muted/30';
    case 'REJECTED':
    case 'REVERSED':
      return 'border-l-4 border-l-red-500 bg-red-50/30 dark:bg-red-950/20';
    default:
      return '';
  }
}

function StatusBadge({ status }: { status: DealNetworkPilotObligationStatus }) {
  const variant = statusBadgeVariant(status);
  const icon =
    status === 'UNFUNDED' ? (
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
    <Badge variant={variant} className="max-w-[200px] gap-1 font-normal">
      {icon}
      <span className="truncate">{statusLabel(status)}</span>
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

function computeKpis(rows: ObligationRow[]) {
  let totalOwed = 0;
  let totalPaid = 0;
  let totalOutstanding = 0;
  let totalUnfunded = 0;
  let availableForPayoutCount = 0;
  let availableForPayoutAmount = 0;
  const currencies = new Set<string>();

  for (const r of rows) {
    currencies.add(r.currency || 'USD');
    const owed = toNumber(r.amount_owed);
    const { paid, outstanding } = paidAndOutstanding(r);
    totalOwed += owed;
    totalPaid += paid;
    totalOutstanding += outstanding;
    if (r.status === 'UNFUNDED') {
      totalUnfunded += owed;
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
    availableForPayoutCount,
    availableForPayoutAmount,
    singleCurrency,
    mixedCurrency,
  };
}

export default function DealNetworkObligationsPage() {
  const [allRows, setAllRows] = React.useState<ObligationRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [dealFilter, setDealFilter] = React.useState<string>('__all__');
  const [statusFilter, setStatusFilter] = React.useState<string>('__all__');
  const [participantFilter, setParticipantFilter] = React.useState<string>('__all__');
  const [needsActionOnly, setNeedsActionOnly] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/deal-network-pilot/obligations', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (res.status === 401) {
        setError('You need to be signed in to view pilot obligations.');
        setAllRows([]);
        return;
      }
      if (!res.ok) {
        setError('Could not load obligations.');
        setAllRows([]);
        return;
      }
      const json = (await res.json()) as { data: ObligationRow[] };
      setAllRows(Array.isArray(json.data) ? json.data : []);
    } catch {
      setError('Could not load obligations.');
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const rows = React.useMemo(() => {
    return allRows.filter((r) => {
      if (needsActionOnly && !NEEDS_ACTION_STATUSES.has(r.status)) return false;
      if (dealFilter !== '__all__' && r.deal_id !== dealFilter) return false;
      if (statusFilter !== '__all__' && r.status !== statusFilter) return false;
      if (participantFilter !== '__all__' && r.participant_id !== participantFilter) return false;
      return true;
    });
  }, [allRows, needsActionOnly, dealFilter, statusFilter, participantFilter]);

  const kpi = React.useMemo(() => computeKpis(rows), [rows]);

  const formatKpiAmount = (n: number) => {
    if (rows.length === 0) return formatMoney(0, 'USD');
    if (kpi.mixedCurrency) return '—';
    const ccy = kpi.singleCurrency ?? 'USD';
    return formatMoney(n, ccy);
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

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2 h-8 px-2">
            <Link href="/dashboard/partners/deal-network">
              <ArrowLeft className="mr-1 size-4" />
              Back to Deal Network
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Financial obligations</h1>
          <p className="text-muted-foreground text-sm">
            Operator view — totals and rows reflect <strong>stored obligation lines</strong> and their
            statuses only (same rules as the table below).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {/* KPI strip — sums over the same filtered row set as the table */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="space-y-1 p-4 pb-2">
            <CardDescription className="text-[10px] font-semibold uppercase tracking-wider">
              Total owed
            </CardDescription>
            <CardTitle className="text-xl tabular-nums sm:text-2xl">
              {loading ? '…' : formatKpiAmount(kpi.totalOwed)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="space-y-1 p-4 pb-2">
            <CardDescription className="text-[10px] font-semibold uppercase tracking-wider">
              Total paid
            </CardDescription>
            <CardTitle className="text-muted-foreground text-xl tabular-nums sm:text-2xl">
              {loading ? '…' : formatKpiAmount(kpi.totalPaid)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="space-y-1 p-4 pb-2">
            <CardDescription className="text-[10px] font-semibold uppercase tracking-wider">
              Outstanding
            </CardDescription>
            <CardTitle className="text-xl tabular-nums sm:text-2xl">
              {loading ? '…' : formatKpiAmount(kpi.totalOutstanding)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-amber-200/80 bg-amber-50/50 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/20">
          <CardHeader className="space-y-1 p-4 pb-2">
            <CardDescription className="text-[10px] font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-200/90">
              Unfunded
            </CardDescription>
            <CardTitle className="text-xl tabular-nums text-amber-950 sm:text-2xl dark:text-amber-50">
              {loading ? '…' : formatKpiAmount(kpi.totalUnfunded)}
            </CardTitle>
            <p className="text-[11px] leading-snug text-amber-900/80 dark:text-amber-200/80">
              Sum of lines in <strong>Unfunded</strong> status
            </p>
          </CardHeader>
        </Card>
        <Card className="border-emerald-200/80 bg-emerald-50/40 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <CardHeader className="space-y-1 p-4 pb-2">
            <CardDescription className="text-[10px] font-semibold uppercase tracking-wider text-emerald-900 dark:text-emerald-200/90">
              Available for payout
            </CardDescription>
            <CardTitle className="text-xl tabular-nums text-emerald-950 sm:text-2xl dark:text-emerald-50">
              {loading ? '…' : formatKpiAmount(kpi.availableForPayoutAmount)}
            </CardTitle>
            <p className="text-[11px] leading-snug text-emerald-900/80 dark:text-emerald-200/80">
              {loading ? '…' : `${kpi.availableForPayoutCount} line${kpi.availableForPayoutCount === 1 ? '' : 's'} · status Available for payout`}
            </p>
          </CardHeader>
        </Card>
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="space-y-1 p-4 pb-2">
            <CardDescription className="text-[10px] font-semibold uppercase tracking-wider">
              Rows in view
            </CardDescription>
            <CardTitle className="text-xl tabular-nums sm:text-2xl">{loading ? '…' : rows.length}</CardTitle>
            {kpi.mixedCurrency && rows.length > 0 ? (
              <p className="text-muted-foreground text-[11px]">Multiple currencies — amount totals hidden</p>
            ) : null}
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Filters</CardTitle>
          <CardDescription>
            Combine <strong>Needs action</strong> with deal, status, or participant. All values come from
            obligation rows as returned from the API.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="bg-muted/40 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <Label htmlFor="needs-action" className="text-sm font-medium">
                Needs action
              </Label>
              <p className="text-muted-foreground max-w-xl text-xs leading-relaxed">
                Surfaces lines in <strong>Unfunded</strong>, <strong>Pending approval</strong>, or{' '}
                <strong>Available for payout</strong> ({needsActionCount} across all loaded rows). Excludes
                Paid, Rejected, and Reversed.
              </p>
            </div>
            <div className="flex items-center gap-2 sm:pr-2">
              <Switch
                id="needs-action"
                checked={needsActionOnly}
                onCheckedChange={setNeedsActionOnly}
                aria-label="Show only obligations that need action"
              />
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
            <div className="min-w-[200px] flex-1 space-y-1">
              <span className="text-muted-foreground text-xs font-medium">Deal</span>
              <Select value={dealFilter} onValueChange={setDealFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All deals" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All deals</SelectItem>
                  {dealOptions.map(([id, label]) => (
                    <SelectItem key={id} value={id}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[200px] flex-1 space-y-1">
              <span className="text-muted-foreground text-xs font-medium">Status</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All statuses</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {statusLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[200px] flex-1 space-y-1">
              <span className="text-muted-foreground text-xs font-medium">Participant</span>
              <Select value={participantFilter} onValueChange={setParticipantFilter}>
                <SelectTrigger>
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Obligation lines</CardTitle>
          <CardDescription>
            {loading
              ? 'Loading…'
              : rows.length === 0
                ? 'No obligation rows match the current filters.'
                : `${rows.length} row${rows.length === 1 ? '' : 's'} in view`}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0 sm:p-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deal</TableHead>
                <TableHead>Participant</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Owed</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment / source</TableHead>
                <TableHead className="w-[130px]">Why?</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-muted-foreground py-10 text-center text-sm">
                    No rows match the current filters — or no obligations have been generated yet.
                  </TableCell>
                </TableRow>
              ) : null}
              {!loading &&
                rows.map((row) => {
                  const { paid, outstanding } = paidAndOutstanding(row);
                  const owed = toNumber(row.amount_owed);
                  const participantLabel =
                    row.participant?.name ??
                    (row.obligation_type === 'PLATFORM_FEE' ? 'Platform' : '—');
                  const roleLabel =
                    row.participant?.role ??
                    (row.obligation_type === 'PLATFORM_FEE' ? 'Platform fee' : '—');
                  const dealLabel = row.deal?.name ?? row.deal_id;
                  const pe = row.payment_event;
                  const paymentBits = [
                    pe?.source_type ? String(pe.source_type).replace(/_/g, ' ') : null,
                    pe?.payment_link_id ? `link ${pe.payment_link_id.slice(0, 8)}…` : null,
                  ].filter(Boolean);

                  return (
                    <TableRow key={row.id} className={statusRowAccent(row.status)}>
                      <TableCell className="max-w-[180px]">
                        <div className="truncate font-medium" title={dealLabel}>
                          {dealLabel}
                        </div>
                        <div className="text-muted-foreground truncate text-xs">{row.deal_id}</div>
                      </TableCell>
                      <TableCell className="max-w-[160px]">
                        <div className="truncate" title={participantLabel}>
                          {participantLabel}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[140px] truncate text-sm" title={roleLabel}>
                        {roleLabel}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(owed, row.currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatMoney(paid, row.currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatMoney(outstanding, row.currency)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="max-w-[200px] text-xs">
                        {pe ? (
                          <div className="space-y-0.5">
                            <div className="truncate font-mono text-[11px]" title={pe.id}>
                              evt {pe.id.slice(0, 8)}…
                            </div>
                            <div className="text-muted-foreground truncate">
                              {paymentBits.length ? paymentBits.join(' · ') : '—'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Not linked</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <details className="group text-xs">
                          <summary className="text-primary hover:bg-primary/5 flex cursor-pointer list-none items-center gap-1.5 rounded-md py-1 pr-1 font-medium underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden">
                            <HelpCircle className="size-3.5 shrink-0 opacity-80" aria-hidden />
                            <span>Why this line?</span>
                          </summary>
                          <p className="text-muted-foreground border-border/60 mt-2 max-w-sm rounded-md border bg-background/80 p-3 text-[13px] leading-relaxed shadow-sm">
                            {row.calculation_explanation}
                          </p>
                        </details>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
