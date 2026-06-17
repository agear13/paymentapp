'use client';

import * as React from 'react';
import { Check, Circle, ChevronDown, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import { useOperationalCoordinationState } from '@/hooks/use-operational-coordination-state';
import { resolveAgreementDestination } from '@/components/workflow/workflow-navigation';
import { deriveWorkflowContext } from '@/components/workflow/workflow-context';
import Link from 'next/link';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

/* ─── Data types ─── */

type ObligationRow = {
  id: string;
  deal_id: string;
  participant_id: string | null;
  obligation_type: string;
  amount_owed: unknown;
  currency: string;
  status: string;
  participant: {
    name: string;
    role: string;
    approvalStatus?: string;
    onboardingStatus?: string;
  } | null;
};

type ProjectTreasurySummary = {
  operationalReadiness?: string;
  collected?: number;
  reserved?: number;
  readyToRelease?: number;
  currency?: string;
  needsFunding?: number;
  paid?: number;
};

function formatMoney(amount: unknown, currency: string): string {
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: currency || 'AUD',
    maximumFractionDigits: 2,
  }).format(n);
}

function obStatusLabel(status: string): string {
  switch (status.toLowerCase()) {
    case 'funded':
    case 'ready':    return 'Ready to pay';
    case 'pending':  return 'Awaiting funding';
    case 'released': return 'Paid';
    case 'blocked':  return 'Blocked';
    default:         return status;
  }
}

function obStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'funded':
    case 'ready':    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'released': return 'bg-slate-50 text-slate-500 border-slate-200';
    case 'blocked':  return 'bg-red-50 text-red-700 border-red-200';
    default:         return 'bg-amber-50 text-amber-700 border-amber-200';
  }
}

/* ─── Section components ─── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </p>
  );
}

function Divider() {
  return <div className="h-px bg-border/40" />;
}

/* ─── Main view ─── */

export function ProjectObligationsView() {
  const { deal, summary, projectId } = useProjectWorkspace();
  const { kpis, guidance, workspaceContext, activation, loading: opLoading } =
    useOperationalCoordinationState({ traceSurface: 'project-obligations' });

  const [rows, setRows] = React.useState<ObligationRow[]>([]);
  const [treasury, setTreasury] = React.useState<ProjectTreasurySummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [diagnosticsOpen, setDiagnosticsOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!deal) return;
    setLoading(true);
    try {
      const [oblRes, treRes] = await Promise.all([
        fetch(`/api/deal-network-pilot/obligations?dealId=${encodeURIComponent(deal.id)}`, {
          credentials: 'include',
          cache: 'no-store',
        }),
        fetch(`/api/projects/${encodeURIComponent(projectId)}/treasury-summary`, {
          credentials: 'include',
          cache: 'no-store',
        }),
      ]);
      if (oblRes.ok) {
        const json = (await oblRes.json()) as { data: ObligationRow[] };
        setRows(Array.isArray(json.data) ? json.data.filter((r) => r.deal_id === deal.id) : []);
      } else {
        setRows([]);
      }
      if (treRes.ok) {
        const json = (await treRes.json()) as { data: ProjectTreasurySummary };
        setTreasury(json.data ?? null);
      }
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [deal, projectId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (!deal || !summary) return null;

  const wfCtx = deriveWorkflowContext({
    projectId,
    kpis: kpis ?? null,
    releaseConfidence: guidance.releaseConfidence ?? null,
    workspaceContext: workspaceContext ?? null,
    activation: activation ?? null,
  });

  const currency = treasury?.currency ?? 'AUD';

  // Derive settlement status sentence
  const readyToRelease = guidance.releaseConfidence?.readyToRelease ?? 0;
  const blockerCount = (kpis?.participantCount ?? 0) - (kpis?.payoutReadyCount ?? 0);
  const actionDestination = resolveAgreementDestination(
    readyToRelease > 0 ? 'release-payouts'
    : wfCtx.currentStage === 'preparing-payments' ? 'connect-provider'
    : blockerCount > 0 ? 'review-obligations'
    : 'release-payouts',
    projectId
  );

  function statusSentence(): string {
    if (wfCtx.isCompleted) return 'Settlement is fully operational.';
    if (readyToRelease > 0) return 'Payouts are ready to release.';
    if (wfCtx.currentStage === 'preparing-payments') {
      return 'Settlement is waiting. Connect a payment provider to proceed.';
    }
    if (wfCtx.currentStage === 'collecting-approvals') {
      return `Settlement is waiting for ${blockerCount > 1 ? `${blockerCount} team member approvals` : 'one team member approval'}.`;
    }
    if (rows.length === 0 && !loading) {
      return 'No settlement obligations recorded yet.';
    }
    return blockerCount > 0
      ? `Settlement isn't ready yet. ${blockerCount} step${blockerCount === 1 ? '' : 's'} remain.`
      : 'Settlement is progressing normally.';
  }

  const isReady = wfCtx.isCompleted || readyToRelease > 0;
  const primaryBlocker = wfCtx.currentStage !== 'operational'
    ? actionDestination
    : null;

  return (
    <div className="space-y-1 max-w-2xl">
      {/* Page intro */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">What is owed</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track what each team member is owed and when it can be paid.
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-white divide-y divide-border/40 overflow-hidden">

        {/* ── Section 1: Settlement Status ── */}
        <div className="px-5 py-4 space-y-1">
          <SectionLabel>Settlement status</SectionLabel>
          <p className={cn(
            'text-sm font-semibold mt-1',
            isReady ? 'text-[rgb(29,111,66)]' : 'text-foreground'
          )}>
            {loading || opLoading
              ? 'Loading settlement status…'
              : statusSentence()
            }
          </p>
        </div>

        <Divider />

        {/* ── Section 2: Action Required (only renders if there's a blocker) ── */}
        {primaryBlocker && !wfCtx.isCompleted ? (
          <>
            <div className="px-5 py-4 space-y-3">
              <SectionLabel>Action required</SectionLabel>
              <div className="rounded-lg border border-amber-200/60 bg-amber-50/40 px-4 py-3.5 space-y-2.5">
                <p className="text-sm font-semibold text-foreground">{primaryBlocker.label}</p>
                <p className="text-xs text-muted-foreground leading-snug">{primaryBlocker.reason}</p>
                {/* Consequences */}
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Doing this enables</p>
                  {BLOCKER_CONSEQUENCES[wfCtx.currentStage]?.map((c) => (
                    <div key={c} className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-[rgb(29,111,66)] shrink-0" />
                      <span className="text-xs text-foreground/80">{c}</span>
                    </div>
                  ))}
                </div>
                {primaryBlocker.estimatedMinutes > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Estimated time:{' '}
                    <span className="font-medium text-foreground">{primaryBlocker.estimatedMinutes} minutes</span>
                  </p>
                ) : null}
                <Button asChild size="sm" className="h-7 text-xs bg-foreground hover:bg-foreground/90 text-background border-0">
                  <Link href={primaryBlocker.href}>{primaryBlocker.label}</Link>
                </Button>
              </div>
            </div>
            <Divider />
          </>
        ) : null}

        {/* ── Section 3: Financial Position (only if treasury data exists) ── */}
        {treasury ? (
          <>
            <div className="px-5 py-4 space-y-3">
              <SectionLabel>Financial position</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Outstanding', value: treasury.collected, show: (treasury.collected ?? 0) > 0 },
                  { label: 'Ready to release', value: treasury.readyToRelease, highlight: true, show: (treasury.readyToRelease ?? 0) > 0 },
                  { label: 'Needs funding', value: treasury.needsFunding, warn: true, show: (treasury.needsFunding ?? 0) > 0 },
                  { label: 'Paid', value: treasury.paid, muted: true, show: (treasury.paid ?? 0) > 0 },
                ].filter((f) => f.show).map((field) => (
                  <div
                    key={field.label}
                    className={cn(
                      'rounded-lg border px-3 py-2.5',
                      field.highlight ? 'border-[rgba(29,111,66,0.25)] bg-[rgba(29,111,66,0.04)]'
                        : field.warn ? 'border-amber-200/60 bg-amber-50/30'
                        : 'border-border/40 bg-muted/20'
                    )}
                  >
                    <p className={cn(
                      'text-xs font-medium',
                      field.highlight ? 'text-[rgb(29,111,66)]'
                        : field.warn ? 'text-amber-700'
                        : field.muted ? 'text-muted-foreground'
                        : 'text-foreground'
                    )}>
                      {formatMoney(field.value, currency)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{field.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <Divider />
          </>
        ) : null}

        {/* ── Section 4: Obligations table ── */}
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <SectionLabel>Payment obligations</SectionLabel>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-muted-foreground hover:text-foreground px-2"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={cn('h-3 w-3 mr-1', loading && 'animate-spin')} />
              Refresh
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading payment obligations…
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Payment obligations appear here once team members are allocated and earnings are configured.
            </p>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/40 px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {r.participant?.name ?? '—'}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {r.obligation_type?.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="text-sm font-semibold tabular-nums">
                      {formatMoney(r.amount_owed, r.currency)}
                    </p>
                    <span className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border',
                      obStatusColor(r.status)
                    )}>
                      {obStatusLabel(r.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Progressive disclosure: technical diagnostics ── */}
        {rows.length > 0 ? (
          <Collapsible open={diagnosticsOpen} onOpenChange={setDiagnosticsOpen}>
            <CollapsibleTrigger className="w-full flex items-center justify-between px-5 py-3 text-xs text-muted-foreground hover:text-foreground transition-colors border-t border-border/40">
              <span>Advanced details</span>
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', diagnosticsOpen && 'rotate-180')} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-5 pb-4 space-y-2 border-t border-border/40 pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Raw obligation data
                </p>
                {rows.map((r) => (
                  <div key={r.id} className="text-xs text-muted-foreground font-mono">
                    <span className="text-foreground/60">{r.id.slice(0, 8)}…</span>
                    {' · '}
                    {r.obligation_type}
                    {' · '}
                    {r.status}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </div>
    </div>
  );
}

/* ─── Consequence catalogue for obligation blockers ─── */

const BLOCKER_CONSEQUENCES: Partial<Record<string, string[]>> = {
  'setup':                ['Earnings configuration', 'Payout calculations', 'Settlement readiness'],
  'configuring':          ['Approval collection', 'Payout scheduling', 'Settlement eligibility'],
  'collecting-approvals': ['Participant payouts', 'Revenue releases', 'Settlement readiness'],
  'preparing-payments':   ['Customer payments', 'Revenue tracking', 'Settlement automation'],
  'ready-to-collect':     ['Revenue collection', 'Obligation tracking', 'Payout release'],
  'collecting-revenue':   ['Obligation confirmation', 'Payout readiness', 'Settlement'],
  'ready-to-release':     ['Team member payments', 'Obligation settlement', 'Completion'],
};
