'use client';

/**
 * Approval Centre Header
 *
 * Two states:
 *
 *   State A — Approvals outstanding
 *     Progress bar · counts · Provvy guidance line (who to chase next)
 *
 *   State B — Everyone approved
 *     ✓ strip · one next-step CTA (first unresolved bottleneck only)
 *
 * Design rules:
 *   - Explain something once. No expandable "why approvals matter?" — the count
 *     and progress bar are self-explanatory.
 *   - State B surfaces exactly ONE recommendation. The operator sees one button.
 *   - No "estimated time" — there is no real telemetry to base it on.
 */

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { CommercialCapabilities } from '@/components/workflow/commercial-decision-engine';
import { deriveAgreementLifecycleState } from '@/lib/operations/lifecycle/agreement-lifecycle';
import { projectOverviewPath } from '@/lib/projects/project-routes';
import { cn } from '@/lib/utils';

/* ─── Approval stat derivation ─────────────────────────────────────────────── */

export type ApprovalStats = {
  total: number;
  approved: number;
  /** Shared / viewed / signed — sent but not yet approved */
  waiting: number;
  /** Agreement not yet generated or shared */
  notSent: number;
  /** total − approved */
  pending: number;
  percentage: number;
};

export function deriveApprovalStats(participants: DemoParticipant[]): ApprovalStats {
  const total = participants.length;
  if (total === 0) {
    return { total: 0, approved: 0, waiting: 0, notSent: 0, pending: 0, percentage: 0 };
  }

  let approved = 0;
  let waiting = 0;
  let notSent = 0;

  for (const p of participants) {
    if (p.approvalStatus === 'Approved') {
      approved++;
      continue;
    }
    const lc = deriveAgreementLifecycleState(p);
    if (lc === 'SHARED' || lc === 'VIEWED' || lc === 'SIGNED') {
      waiting++;
    } else {
      notSent++;
    }
  }

  return {
    total,
    approved,
    waiting,
    notSent,
    pending: total - approved,
    percentage: Math.round((approved / total) * 100),
  };
}

/* ─── Progress bar ─────────────────────────────────────────────────────────── */

function ApprovalProgressBar({ percentage }: { percentage: number }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${percentage}% approved`}
      className="h-1.5 w-full rounded-full bg-border/40 overflow-hidden"
    >
      <div
        className={cn(
          'h-full rounded-full transition-all duration-700 ease-out',
          percentage === 100 ? 'bg-[rgb(29,111,66)]' : 'bg-primary'
        )}
        style={{ width: `${Math.max(2, percentage)}%` }}
      />
    </div>
  );
}

/* ─── Provvy guidance line (State A) ────────────────────────────────────────
 *
 * Surfaces the single most actionable nudge without requiring the operator to
 * read a paragraph. Examples:
 *   "Send the agreement to Sam — they are the only one waiting."
 *   "2 participants still need the agreement sent."
 *   "1 participant has opened the agreement but not yet approved."
 */

function deriveGuidanceLine(
  participants: DemoParticipant[],
  stats: ApprovalStats
): string | null {
  if (stats.pending === 0) return null;

  // Single participant not yet sent → name them directly
  if (stats.notSent === 1 && stats.waiting === 0) {
    const p = participants.find((x) => {
      const lc = deriveAgreementLifecycleState(x);
      return x.approvalStatus !== 'Approved' && lc !== 'SHARED' && lc !== 'VIEWED' && lc !== 'SIGNED';
    });
    if (p?.name) return `Send the agreement to ${p.name} — they haven't received it yet.`;
  }

  // Single participant waiting (sent but not approved)
  if (stats.waiting === 1 && stats.notSent === 0) {
    const p = participants.find((x) => {
      const lc = deriveAgreementLifecycleState(x);
      return lc === 'SHARED' || lc === 'VIEWED' || lc === 'SIGNED';
    });
    if (p?.name) return `${p.name} has received the agreement but hasn't approved yet.`;
  }

  // Multiple unsent
  if (stats.notSent > 0) {
    return `${stats.notSent} ${stats.notSent === 1 ? 'participant' : 'participants'} still need the agreement sent.`;
  }

  // All sent, some waiting
  if (stats.waiting > 0) {
    return `${stats.waiting} ${stats.waiting === 1 ? 'participant has' : 'participants have'} received the agreement but haven't approved yet.`;
  }

  return null;
}

/* ─── Next bottleneck (State B) — exactly one recommendation ───────────────
 *
 * Returns the first unresolved bottleneck only.
 * The operator sees one button and one action.
 */

type NextBottleneck = {
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
};

export function deriveNextBottleneck(
  caps: CommercialCapabilities,
  projectId: string
): NextBottleneck | null {
  const base = `/dashboard/projects/${encodeURIComponent(projectId)}`;

  if (!caps.paymentProviderConnected) {
    return {
      title: 'Set up payments',
      description: 'Connect a payment provider so customers can pay and revenue can flow.',
      ctaLabel: 'Connect payment provider',
      href: '/dashboard/settings/merchant#payment-provider',
    };
  }

  if (!caps.revenueFlowing) {
    return {
      title: 'Start collecting revenue',
      description: 'Share your payment links to begin collecting customer payments.',
      ctaLabel: 'View agreement',
      href: projectOverviewPath(projectId),
    };
  }

  if (caps.revenueFlowing && !caps.settlementReady) {
    return {
      title: 'Review obligations',
      description: 'Revenue is flowing. Confirm what each participant is owed before releasing payments.',
      ctaLabel: 'Review obligations',
      href: `${base}/payouts`,
    };
  }

  if (caps.settlementReady) {
    return {
      title: 'Release payments',
      description: 'Revenue has been collected. Review what each participant is owed.',
      ctaLabel: 'Review obligations',
      href: `${base}/payouts`,
    };
  }

  return null;
}

/* ─── Props ─────────────────────────────────────────────────────────────────── */

type ApprovalCentreHeaderProps = {
  participants: DemoParticipant[];
  agreementName: string;
  commercialCapabilities: CommercialCapabilities | null;
  /** Required for next-bottleneck CTA links in State B */
  projectId: string;
};

/* ─── Main export ───────────────────────────────────────────────────────────── */

export function ApprovalCentreHeader({
  participants,
  agreementName,
  commercialCapabilities,
  projectId,
}: ApprovalCentreHeaderProps) {
  const stats = React.useMemo(() => deriveApprovalStats(participants), [participants]);
  const guidanceLine = React.useMemo(
    () => deriveGuidanceLine(participants, stats),
    [participants, stats]
  );

  const caps = commercialCapabilities;
  const approvalsComplete = caps?.approvalsComplete ?? false;
  const nextBottleneck =
    approvalsComplete && caps ? deriveNextBottleneck(caps, projectId) : null;

  /* ─── STATE B: Everyone approved ─── */

  if (approvalsComplete) {
    return (
      <div className="rounded-xl border border-[rgba(29,111,66,0.3)] bg-[rgba(29,111,66,0.04)] px-5 py-4 space-y-4">
        {/* Success header */}
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-[rgba(29,111,66,0.15)] flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-4.5 w-4.5 text-[rgb(29,111,66)]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-[rgb(29,111,66)] leading-tight">
              Everyone has approved.
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {agreementName} is payment-ready.
            </p>
          </div>
          <Badge className="shrink-0 bg-[rgb(29,111,66)] hover:bg-[rgb(29,111,66)] text-white text-xs">
            {stats.total}/{stats.total}
          </Badge>
        </div>

        {/* Full progress bar */}
        <ApprovalProgressBar percentage={100} />

        {/* Single next step — one button, one action */}
        {nextBottleneck ? (
          <div className="border-t border-[rgba(29,111,66,0.15)] pt-3.5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{nextBottleneck.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">
                  {nextBottleneck.description}
                </p>
              </div>
              <Button asChild size="sm" className="shrink-0 h-8 px-4 text-xs font-semibold gap-1.5">
                <Link href={nextBottleneck.href}>
                  {nextBottleneck.ctaLabel}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  /* ─── STATE A: Approvals outstanding ─── */

  const outstandingLabel =
    stats.pending === 1
      ? 'Waiting on 1 person'
      : `${stats.pending} approvals outstanding`;

  return (
    <div className="rounded-xl border border-border/60 bg-card px-5 py-4 space-y-3">
      {/* Heading row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-primary/8 flex items-center justify-center shrink-0">
            <Shield className="h-4 w-4 text-primary/70" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground leading-tight">
              Approvals
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[30ch]">
              {agreementName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground tabular-nums">
            {stats.approved}/{stats.total}
          </span>
          <Badge variant="secondary" className="text-xs font-semibold">
            {stats.percentage}%
          </Badge>
        </div>
      </div>

      {/* Progress bar */}
      <ApprovalProgressBar percentage={stats.percentage} />

      {/* Status summary */}
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-foreground">{outstandingLabel}</p>

        {/* Count pills */}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {stats.approved > 0 ? (
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[rgb(29,111,66)] shrink-0" />
              <span className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{stats.approved}</span> Approved
              </span>
            </div>
          ) : null}
          {stats.waiting > 0 ? (
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
              <span className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{stats.waiting}</span> Waiting to approve
              </span>
            </div>
          ) : null}
          {stats.notSent > 0 ? (
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-400 shrink-0" />
              <span className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{stats.notSent}</span> Not yet sent
              </span>
            </div>
          ) : null}
        </div>

        {/* Provvy guidance line — one specific nudge, not a paragraph of rationale */}
        {guidanceLine ? (
          <p className="text-xs text-muted-foreground/80 leading-relaxed pt-0.5">
            {guidanceLine}
          </p>
        ) : null}
      </div>
    </div>
  );
}
