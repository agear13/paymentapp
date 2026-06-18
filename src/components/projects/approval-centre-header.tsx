'use client';

/**
 * Approval Centre Header
 *
 * Answers the first two operational questions within five seconds:
 *   1. Where am I?
 *   2. What is preventing this agreement from becoming payment-ready?
 *
 * Two distinct states:
 *
 *   State A — Approvals outstanding
 *     Progress bar + counts + "X approvals outstanding" primary message
 *     Expandable "Why approvals matter" section
 *
 *   State B — All approvals complete
 *     ✓ success strip + automatically surfaces the next Commercial OS bottleneck
 *     (e.g. "Connect Stripe" when paymentProviderConnected is false)
 *     The Approval Centre never goes silent — it always points forward.
 *
 * All state derives from CommercialCapabilities (persisted backend truth).
 * No estimated time: no real telemetry exists to base it on.
 * No independent completion inference.
 */

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, ChevronDown, ChevronRight, Shield, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { CommercialCapabilities } from '@/components/workflow/commercial-decision-engine';
import { deriveAgreementLifecycleState } from '@/lib/operations/lifecycle/agreement-lifecycle';
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

/* ─── Why approvals matter ──────────────────────────────────────────────────── */

function WhyApprovalsSection() {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="border-t border-border/20 pt-3">
      <button
        type="button"
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        Why do approvals matter?
      </button>

      {open ? (
        <div className="mt-2.5 space-y-1.5">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Commercial agreements must be approved before any of the following can occur:
          </p>
          {[
            'Revenue attribution begins for each participant',
            'Referral commissions accrue against sales',
            'Settlement becomes available for release',
            'Participant payouts can be released',
          ].map((reason) => (
            <div key={reason} className="flex items-start gap-2">
              <CheckCircle2 className="h-3 w-3 text-primary/60 shrink-0 mt-0.5" />
              <span className="text-xs text-muted-foreground">{reason}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ─── Next bottleneck CTA (State B) ────────────────────────────────────────── */

type NextBottleneck = {
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
  estimatedMinutes: number;
};

function deriveNextBottleneck(
  caps: CommercialCapabilities,
  projectId: string
): NextBottleneck | null {
  const base = `/dashboard/projects/${encodeURIComponent(projectId)}`;

  if (!caps.paymentProviderConnected) {
    return {
      title: 'Connect a payment provider',
      description:
        'Connecting a payment provider enables customer payments, revenue tracking, and settlement.',
      ctaLabel: 'Connect Stripe',
      href: '/dashboard/settings/merchant#payment-provider',
      estimatedMinutes: 2,
    };
  }

  if (!caps.revenueFlowing) {
    return {
      title: 'Agreement is payment-ready',
      description: 'Revenue can now flow. Share your payment links to begin collecting.',
      ctaLabel: 'View agreement',
      href: `${base}/overview`,
      estimatedMinutes: 1,
    };
  }

  if (caps.settlementReady) {
    return {
      title: 'Payouts are ready to release',
      description: 'Revenue has been collected. Review obligations and release participant payouts.',
      ctaLabel: 'Release payouts',
      href: `${base}/payouts`,
      estimatedMinutes: 2,
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

  const caps = commercialCapabilities;
  const approvalsComplete = caps?.approvalsComplete ?? false;
  const nextBottleneck =
    approvalsComplete && caps ? deriveNextBottleneck(caps, projectId) : null;

  /* ─── STATE B: All approvals complete ─── */

  if (approvalsComplete) {
    return (
      <div className="rounded-xl border border-[rgba(29,111,66,0.3)] bg-[rgba(29,111,66,0.04)] px-5 py-4 space-y-4">
        {/* Success header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-[rgba(29,111,66,0.15)] flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-4.5 w-4.5 text-[rgb(29,111,66)]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[rgb(29,111,66)] leading-tight">
                All approvals collected
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Agreement is now payment-ready.
              </p>
            </div>
          </div>
          <Badge className="shrink-0 bg-[rgb(29,111,66)] hover:bg-[rgb(29,111,66)] text-white text-xs">
            {stats.total}/{stats.total}
          </Badge>
        </div>

        {/* Progress bar (full) */}
        <ApprovalProgressBar percentage={100} />

        {/* Next bottleneck — always surface forward progress */}
        {nextBottleneck ? (
          <div className="border-t border-[rgba(29,111,66,0.15)] pt-3.5 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Next step
            </p>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-foreground">{nextBottleneck.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">
                  {nextBottleneck.description}
                </p>
                {nextBottleneck.estimatedMinutes > 0 ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    Estimated setup:{' '}
                    <span className="font-medium text-foreground">
                      {nextBottleneck.estimatedMinutes} min
                    </span>
                  </p>
                ) : null}
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
      ? 'Waiting on 1 participant'
      : `${stats.pending} approvals outstanding`;

  return (
    <div className="rounded-xl border border-border/60 bg-card px-5 py-4 space-y-4">
      {/* Heading row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-primary/8 flex items-center justify-center shrink-0">
            <Shield className="h-4 w-4 text-primary/70" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground leading-tight">
              Approval Centre
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

      {/* Counts + primary message */}
      <div className="space-y-2.5">
        {/* Outstanding message */}
        <p className="text-sm font-medium text-foreground">{outstandingLabel}</p>

        {/* Count pills */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
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
                <span className="font-semibold text-foreground">{stats.waiting}</span>{' '}
                Waiting for approval
              </span>
            </div>
          ) : null}
          {stats.notSent > 0 ? (
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-400 shrink-0" />
              <span className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{stats.notSent}</span> Ready to
                send
              </span>
            </div>
          ) : null}
        </div>

        {/* Subtext */}
        <p className="text-xs text-muted-foreground leading-relaxed">
          Commercial agreements must be approved before commissions accrue, payouts can be released
          and settlement can begin.
        </p>
      </div>

      {/* Why section */}
      <WhyApprovalsSection />
    </div>
  );
}
