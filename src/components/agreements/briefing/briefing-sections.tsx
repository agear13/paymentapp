'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleDot,
  Mail,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { AgreementBriefingSnapshot, BriefingObligationGroup } from '@/lib/agreements/agreement-briefing.model';
import type {
  AgreementIntelligenceOutput,
  AgreementParticipantAction,
} from '@/lib/agreements/intelligence/agreement-intelligence.types';
import { BriefingSectionShell } from '@/components/agreements/briefing/briefing-section-shell';
import { BriefingScoreRing } from '@/components/agreements/briefing/briefing-score-ring';
import { IntelligenceBadge } from '@/components/provvypay/intelligence-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { OperationalAuditTimeline } from '@/components/operations/operational-audit-timeline';
import { ReleaseConfidenceSummary } from '@/components/operations/release-confidence-summary';
import { ProjectFundingSourcesPanel } from '@/components/projects/project-funding-sources-panel';
import type { ReleaseConfidenceSnapshot } from '@/lib/operations/explainability';
import type { OperationalAuditEntry } from '@/lib/operations/audit/operational-audit';
import { trackParticipantActionClick, trackRecommendationCtaClick } from '@/lib/agreements/validation/agreement-intelligence-analytics';
import {
  projectCommercialRolesPath,
  projectObligationsPath,
  projectParticipantsPath,
  projectPayoutsPath,
} from '@/lib/projects/project-routes';
import { PAYOUTS_SETTLEMENTS_HREF } from '@/lib/navigation/operator-nav';
import { cn } from '@/lib/utils';

const OBLIGATION_GROUP_ORDER: BriefingObligationGroup[] = [
  'blocked',
  'in_progress',
  'pending',
  'completed',
];

const OBLIGATION_GROUP_LABELS: Record<BriefingObligationGroup, string> = {
  blocked: 'Blocked',
  in_progress: 'In progress',
  pending: 'Pending',
  completed: 'Completed',
};

type BriefingSectionsProps = {
  snapshot: AgreementBriefingSnapshot;
  projectId: string;
  currency: string;
  releaseConfidence: ReleaseConfidenceSnapshot;
  auditEntries: OperationalAuditEntry[];
  activityEntries: OperationalAuditEntry[];
  onTreasuryChange: () => void;
};

export function BriefingSummarySection({
  snapshot,
  projectId,
}: Pick<BriefingSectionsProps, 'snapshot' | 'projectId'>) {
  return (
    <BriefingSectionShell
      id="briefing-summary"
      title="Agreement Summary"
      description="Commercial relationship status and coordination phase for this agreement."
      variant="intelligence"
    >
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
        <div className="space-y-4 min-w-0 flex-1">
          <IntelligenceBadge />
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{snapshot.agreementName}</h1>
            <p className="text-base text-muted-foreground mt-2">{snapshot.agreementType}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-[rgba(124,92,255,0.1)] text-[rgb(124,92,255)] border-[rgba(124,92,255,0.2)]">
              {snapshot.statusLabel}
            </Badge>
            {snapshot.agreementValue ? <Badge variant="outline">{snapshot.agreementValue}</Badge> : null}
            <Badge variant="outline">Created {snapshot.createdLabel}</Badge>
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <dt className="text-xs text-muted-foreground uppercase tracking-wide">Participants</dt>
              <dd className="text-2xl font-semibold mt-1">{snapshot.participantCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground uppercase tracking-wide">Obligations</dt>
              <dd className="text-2xl font-semibold mt-1">{snapshot.obligationCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground uppercase tracking-wide">Health</dt>
              <dd className="text-lg font-semibold mt-1">{snapshot.healthLabel}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild size="sm">
              <Link href={projectParticipantsPath(projectId)}>
                Manage participants
                <ArrowRight className="ml-2 h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={projectCommercialRolesPath(projectId)}>Plan commercial terms</Link>
            </Button>
          </div>
        </div>
        <BriefingScoreRing
          value={snapshot.settlementReadinessScore}
          label="Settlement readiness"
          sublabel={
            snapshot.settlementTrend === 'attention'
              ? 'Attention needed'
              : snapshot.settlementTrend === 'improving'
                ? 'Improving'
                : 'Stable'
          }
          variant="readiness"
          size="lg"
        />
      </div>
    </BriefingSectionShell>
  );
}

export function BriefingParticipantsSection({
  snapshot,
  projectId,
  participantActions = [],
  agreementName,
}: Pick<BriefingSectionsProps, 'snapshot' | 'projectId'> & {
  participantActions?: AgreementParticipantAction[];
  agreementName?: string;
}) {
  const actionByParticipant = new Map(participantActions.map((a) => [a.participantId, a]));

  return (
    <BriefingSectionShell
      id="briefing-participants"
      title="Participants"
      description="Parties to this agreement — roles, approvals, settlement path, and required actions."
    >
      {snapshot.participants.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          No participants have been identified for this agreement yet. Add participants to begin
          coordination.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {snapshot.participants.map((participant) => {
            const action = actionByParticipant.get(participant.id);
            return (
            <div
              key={participant.id}
              className="relative rounded-xl border border-[rgba(124,92,255,0.12)] bg-white p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(124,92,255,0.08)]">
                  <Users className="h-5 w-5 text-[rgb(124,92,255)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold truncate">{participant.name}</p>
                    {participant.isPrimary ? (
                      <Badge variant="secondary" className="text-[10px]">
                        Primary
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{participant.role}</p>
                  {participant.email ? (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {participant.email}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge variant="outline">{participant.status}</Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        participant.settlementStatus === 'Settlement ready' &&
                          'border-[rgba(29,111,66,0.3)] text-[rgb(29,111,66)] bg-[rgba(223,247,232,0.5)]'
                      )}
                    >
                      {participant.settlementStatus}
                    </Badge>
                  </div>
                  {action ? (
                    <div
                      className={cn(
                        'mt-4 rounded-lg border px-3 py-2.5 text-sm',
                        action.isBlocking
                          ? 'border-amber-500/25 bg-amber-50/60 dark:bg-amber-950/20'
                          : 'border-[rgba(29,111,66,0.15)] bg-[rgba(223,247,232,0.35)]'
                      )}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Required action
                      </p>
                      <p className="font-medium mt-1">{action.requiredAction}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-[10px]">
                          {action.status}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          Priority: {action.priority}
                        </Badge>
                      </div>
                      {action.ctaHref && action.ctaLabel ? (
                        <Button asChild variant="link" size="sm" className="h-auto p-0 mt-2">
                          <Link
                            href={action.ctaHref}
                            onClick={() =>
                              trackParticipantActionClick({
                                projectId,
                                agreementName,
                                participantId: participant.id,
                              })
                            }
                          >
                            {action.ctaLabel}
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
          })}
        </div>
      )}
      <Button asChild variant="outline" size="sm" className="mt-2">
        <Link href={projectParticipantsPath(projectId)}>Open participant workspace</Link>
      </Button>
    </BriefingSectionShell>
  );
}

export function BriefingCommercialTermsSection({
  snapshot,
  projectId,
}: Pick<BriefingSectionsProps, 'snapshot' | 'projectId'>) {
  return (
    <BriefingSectionShell
      id="briefing-terms"
      title="Commercial Terms"
      description="Structured summary of what was agreed — extracted and coordinated by Agreement Intelligence."
      variant="intelligence"
    >
      {snapshot.commercialTerms.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          Commercial terms have not been captured yet. Add roles, budgets, or agreement context to
          complete this briefing.
        </p>
      ) : (
        <dl className="grid gap-3 sm:grid-cols-2">
          {snapshot.commercialTerms.map((term) => (
            <div
              key={term.label}
              className="rounded-lg border border-[rgba(124,92,255,0.1)] bg-white/80 px-4 py-3"
            >
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {term.label}
              </dt>
              <dd className="text-sm font-medium mt-1.5 leading-relaxed">{term.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <Button asChild variant="outline" size="sm">
        <Link href={projectCommercialRolesPath(projectId)}>Edit commercial terms</Link>
      </Button>
    </BriefingSectionShell>
  );
}

export function BriefingObligationsSection({
  snapshot,
  projectId,
}: Pick<BriefingSectionsProps, 'snapshot' | 'projectId'>) {
  const total =
    OBLIGATION_GROUP_ORDER.reduce((n, g) => n + snapshot.obligationsByGroup[g].length, 0);

  return (
    <BriefingSectionShell
      id="briefing-obligations"
      title="Obligations"
      description="Amounts owed under this agreement — funding and approvals determine settlement eligibility."
    >
      {total === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          No obligations have been identified yet. They appear when participants and earnings are
          configured.
        </p>
      ) : (
        <div className="space-y-6">
          {OBLIGATION_GROUP_ORDER.map((group) => {
            const items = snapshot.obligationsByGroup[group];
            if (items.length === 0) return null;
            return (
              <div key={group}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  {OBLIGATION_GROUP_LABELS[group]}
                </p>
                <ul className="space-y-2">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-border/60 bg-background px-4 py-3"
                    >
                      <div>
                        <p className="font-medium text-sm">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.owner}
                          {item.amountLabel ? ` · ${item.amountLabel}` : ''}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          group === 'blocked' && 'border-amber-500/40 text-amber-800',
                          group === 'completed' &&
                            'border-[rgba(29,111,66,0.3)] text-[rgb(29,111,66)]'
                        )}
                      >
                        {item.statusLabel}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
      <Button asChild variant="outline" size="sm">
        <Link href={projectObligationsPath(projectId)}>View all obligations</Link>
      </Button>
    </BriefingSectionShell>
  );
}

export function BriefingApprovalsSection({ snapshot }: Pick<BriefingSectionsProps, 'snapshot'>) {
  return (
    <BriefingSectionShell
      id="briefing-approvals"
      title="Approvals"
      description="Sign-offs required before obligations can settle."
    >
      {snapshot.approvals.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 surface-settlement px-4 py-4 rounded-lg border-0">
          No approvals are required for this agreement. Settlement can proceed when obligations are
          funded.
        </p>
      ) : (
        <ul className="space-y-3">
          {snapshot.approvals.map((approval) => (
            <li
              key={approval.id}
              className="rounded-lg border border-[rgba(124,92,255,0.12)] bg-white px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">{approval.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">Owner: {approval.owner}</p>
                  {approval.history ? (
                    <p className="text-xs text-muted-foreground mt-2">{approval.history}</p>
                  ) : null}
                </div>
                <Badge variant={approval.status === 'approved' ? 'default' : 'outline'}>
                  {approval.statusLabel}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </BriefingSectionShell>
  );
}

export function BriefingSettlementSection({
  snapshot,
  projectId,
  currency,
  releaseConfidence,
  onTreasuryChange,
}: Pick<
  BriefingSectionsProps,
  'snapshot' | 'projectId' | 'currency' | 'releaseConfidence' | 'onTreasuryChange'
>) {
  return (
    <BriefingSectionShell
      id="briefing-settlement"
      title="Settlement Readiness"
      description="Funding, confirmations, and eligibility for settlement under this agreement."
      variant="settlement"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <BriefingScoreRing
              value={snapshot.settlementReadinessScore}
              label="Readiness score"
              sublabel={snapshot.fundingProgressLabel}
              variant="readiness"
            />
            <div className="space-y-1 text-sm">
              <p className="font-medium flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-[rgb(29,111,66)]" />
                Trend: {snapshot.settlementTrend}
              </p>
              <p className="text-muted-foreground">
                {snapshot.participantCount} participant(s) · {snapshot.outstandingObligationCount}{' '}
                outstanding obligation(s)
              </p>
            </div>
          </div>

          {snapshot.readyRequirements.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[rgb(29,111,66)] mb-2">
                Ready
              </p>
              <ul className="space-y-1.5">
                {snapshot.readyRequirements.map((item) => (
                  <li key={item.label} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-[rgb(29,111,66)] shrink-0" />
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {snapshot.blockingIssues.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 mb-2">
                Blocking
              </p>
              <ul className="space-y-1.5">
                {snapshot.blockingIssues.map((item) => (
                  <li key={item.label} className="flex items-start gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No settlement blockers detected.</p>
          )}

          {snapshot.missingRequirements.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Missing
              </p>
              <ul className="space-y-1.5">
                {snapshot.missingRequirements.map((item) => (
                  <li key={item.label} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CircleDot className="h-4 w-4 shrink-0" />
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="space-y-4 rounded-xl border border-[rgba(29,111,66,0.15)] bg-white/60 p-4">
          <ReleaseConfidenceSummary confidence={releaseConfidence} compact calmMode />
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={projectPayoutsPath(projectId)}>Settlement details</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={PAYOUTS_SETTLEMENTS_HREF}>Settlement releases</Link>
            </Button>
          </div>
        </div>
      </div>

      <ProjectFundingSourcesPanel
        projectId={projectId}
        defaultCurrency={currency}
        onTreasuryChange={onTreasuryChange}
      />
    </BriefingSectionShell>
  );
}

export function BriefingActivitySection({
  activityEntries,
}: Pick<BriefingSectionsProps, 'activityEntries'>) {
  return (
    <BriefingSectionShell
      id="briefing-activity"
      title="Business Story"
      description="Business milestones as this agreement progresses — approvals, payments, obligations, and settlement."
      variant="activity"
    >
      <OperationalAuditTimeline
        entries={activityEntries}
        maxItems={16}
        emptyMessage="Business activity will appear here as this agreement progresses."
      />
    </BriefingSectionShell>
  );
}

export function BriefingAuditSection({ auditEntries }: Pick<BriefingSectionsProps, 'auditEntries'>) {
  return (
    <BriefingSectionShell
      id="briefing-audit"
      title="Audit History"
      description="Immutable record of agreement, approval, and settlement events."
      variant="activity"
    >
      <OperationalAuditTimeline
        entries={auditEntries}
        maxItems={20}
        emptyMessage="Business history will populate as activity is recorded for this agreement."
      />
    </BriefingSectionShell>
  );
}

export function BriefingIntelligencePanel({
  intelligence,
  projectId,
  agreementName,
  onRecommendationCtaClick,
}: {
  intelligence: Pick<
    AgreementIntelligenceOutput,
    'snapshot' | 'primaryRecommendation' | 'settlementBlockers' | 'health'
  >;
  projectId?: string;
  agreementName?: string;
  onRecommendationCtaClick?: () => void;
}) {
  const { snapshot, primaryRecommendation, settlementBlockers, health } = intelligence;
  const criticalBlocker = settlementBlockers.find((b) => b.severity === 'blocking') ?? settlementBlockers[0];

  const items = [
    { label: 'Agreement health', value: `${health.score} · ${health.categoryLabel}`, accent: 'intelligence' as const },
    { label: 'Health trend', value: health.trend.label, accent: 'default' as const },
    {
      label: 'Settlement readiness',
      value: `${snapshot.settlementReadinessScore}%`,
      accent: 'settlement' as const,
    },
    {
      label: 'Outstanding obligations',
      value: String(snapshot.outstandingObligationCount),
      accent: 'default' as const,
    },
    {
      label: 'Pending approvals',
      value: String(snapshot.pendingApprovalCount),
      accent: 'default' as const,
    },
    { label: 'Funding progress', value: snapshot.fundingProgressLabel, accent: 'default' as const },
    {
      label: 'Recent status',
      value: snapshot.statusLabel,
      accent: 'intelligence' as const,
    },
  ];

  return (
    <aside className="space-y-4 lg:sticky lg:top-24 h-fit">
      {primaryRecommendation ? (
        <div className="surface-intelligence p-4 space-y-3 border-2 border-[rgba(124,92,255,0.2)]">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(124,92,255)]">
            Do this next
          </p>
          <p className="text-sm font-semibold leading-snug">{primaryRecommendation.action}</p>
          <Button asChild size="sm" className="w-full">
            <Link
              href={primaryRecommendation.ctaHref}
              onClick={() => {
                onRecommendationCtaClick?.();
                if (projectId) {
                  trackRecommendationCtaClick({
                    projectId,
                    agreementName,
                    recommendationId: primaryRecommendation.action,
                    recommendationAction: primaryRecommendation.action,
                  });
                }
              }}
            >
              {primaryRecommendation.ctaLabel}
              <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      ) : null}

      {criticalBlocker ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
            Critical blocker
          </p>
          <p className="text-sm font-medium">{criticalBlocker.label}</p>
          <p className="text-xs text-muted-foreground">{criticalBlocker.resolution}</p>
        </div>
      ) : null}

      <div className="surface-intelligence p-5 space-y-4">
        <IntelligenceBadge />
        <p className="text-sm font-semibold">Agreement Intelligence</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Live coordination signals for this agreement — updated from participant, obligation, and
          settlement state.
        </p>
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.label}
              className={cn(
                'rounded-lg px-3 py-2.5',
                item.accent === 'intelligence' && 'bg-[rgba(124,92,255,0.06)]',
                item.accent === 'settlement' && 'bg-[rgba(223,247,232,0.6)]',
                item.accent === 'default' && 'bg-white/80 border border-border/50'
              )}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {item.label}
              </p>
              <p className="text-sm font-medium mt-1">{item.value}</p>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
