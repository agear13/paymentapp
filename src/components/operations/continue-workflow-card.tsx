'use client';

import Link from 'next/link';
import { ArrowRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { OperationalAuditEntry, OperationalAuditEventType } from '@/lib/operations/audit/operational-audit';
import type { AgreementHealthSnapshot } from '@/lib/agreements/health/agreement-health.types';
import type { QueueTask } from '@/components/operations/operational-queue';
import { resolveContinueWorkflowHref } from '@/components/workflow/workflow-navigation';
import { stageFromScore } from '@/components/workflow/workflow-context';

type ContinueWorkflowCardProps = {
  auditEntries: OperationalAuditEntry[];
  snapshots: AgreementHealthSnapshot[];
  queueTasks: QueueTask[];
};

/* ─── Session memory helpers ─── */

/**
 * Translates a completed audit event into a past-tense memory phrase.
 * "Yesterday you finished configuring participant earnings."
 */
const COMPLETED_ACTION_MEMORY: Partial<Record<OperationalAuditEventType, string>> = {
  compensation_updated: 'configuring participant earnings',
  attribution_configured: 'configuring revenue attribution',
  funding_linked: 'configuring revenue collection',
  funding_reserved_against_obligations: 'allocating funds against obligations',
  obligations_generated: 'setting payment obligations',
  obligations_funded: 'funding payment obligations',
  agreement_approved: 'receiving a participant approval',
  agreement_shared: 'sharing the agreement with participants',
  stripe_connected: 'connecting your payment provider',
  payment_rails_connected: 'connecting your payment provider',
  payout_eligible: 'confirming participant payout eligibility',
  release_batch_generated: 'releasing payouts',
  conversation_imported: 'importing your agreement',
};

function relativeTimeLabel(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (minutes < 5) return 'just now';
    if (minutes < 60) return `${minutes} minutes ago`;
    if (hours < 2) return 'about an hour ago';
    if (hours < 24) return `${hours} hours ago`;
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    return 'last week';
  } catch {
    return 'recently';
  }
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Finds the most recently touched project and the last meaningful action performed on it.
 */
function resolveSession(
  entries: OperationalAuditEntry[],
  snapshots: AgreementHealthSnapshot[],
  queueTasks: QueueTask[]
): {
  snapshot: AgreementHealthSnapshot;
  lastActionLabel: string | null;
  lastActionTimestamp: string | null;
  nextTask: QueueTask | null;
} | null {
  // Most recent entry with a projectId
  const recentWithProject = [...entries]
    .filter((e) => Boolean(e.projectId))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const mostRecent = recentWithProject[0];
  if (!mostRecent?.projectId) return null;

  const snapshot = snapshots.find((s) => s.projectId === mostRecent.projectId);
  if (!snapshot) return null;

  // Skip completed agreements
  if (snapshot.category === 'excellent') return null;

  // Find the most meaningful (non-trivial) completed action for this project
  const typesWithMemory = new Set(Object.keys(COMPLETED_ACTION_MEMORY) as OperationalAuditEventType[]);
  const lastMeaningful = recentWithProject
    .filter((e) => e.projectId === mostRecent.projectId && typesWithMemory.has(e.type))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

  const lastActionLabel = lastMeaningful
    ? COMPLETED_ACTION_MEMORY[lastMeaningful.type] ?? null
    : null;
  const lastActionTimestamp = lastMeaningful?.timestamp ?? mostRecent.timestamp;

  // Next pending task for this agreement
  const nextTask =
    queueTasks.find(
      (t) =>
        t.context.toLowerCase().trim() ===
          snapshot.agreementName.toLowerCase().trim() ||
        snapshot.agreementName
          .toLowerCase()
          .includes(t.context.toLowerCase())
    ) ?? null;

  return { snapshot, lastActionLabel, lastActionTimestamp, nextTask };
}

/**
 * Continue Where You Left Off — surfaces the operator's last active agreement
 * with session memory ("Yesterday you finished configuring participant earnings.")
 * Makes the product feel like it remembers exactly where they stopped.
 */
export function ContinueWorkflowCard({
  auditEntries,
  snapshots,
  queueTasks,
}: ContinueWorkflowCardProps) {
  const session = resolveSession(auditEntries, snapshots, queueTasks);
  if (!session) return null;

  const { snapshot, lastActionLabel, lastActionTimestamp, nextTask } = session;

  // Map the agreement's health score to the canonical workflow stage using the
  // same STAGE_COMPLETION thresholds CommercialBrain uses. This avoids calling
  // deriveWorkflowContext with null inputs (which produces an unreliable stage).
  const resolvedHref = nextTask?.ctaHref ?? resolveContinueWorkflowHref(
    snapshot.projectId,
    stageFromScore(snapshot.score)
  );

  const timeLabel = lastActionTimestamp
    ? relativeTimeLabel(lastActionTimestamp)
    : 'recently';

  // Build memory sentence
  const memorySentence = lastActionLabel
    ? `${capitalise(timeLabel)}, you finished ${lastActionLabel}.`
    : `Last worked on ${timeLabel}.`;

  return (
    <div
      className={cn(
        'rounded-xl border border-[rgba(124,92,255,0.18)]',
        'bg-gradient-to-r from-[rgba(124,92,255,0.05)] via-[rgba(124,92,255,0.02)] to-white',
        'px-5 py-4'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Content */}
        <div className="min-w-0 space-y-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[rgb(124,92,255)]">
            Continue where you left off
          </p>

          <div>
            <p className="text-sm font-semibold text-foreground">{snapshot.agreementName}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Clock className="h-3 w-3 text-muted-foreground/60 shrink-0" aria-hidden />
              <p className="text-xs text-muted-foreground">{memorySentence}</p>
            </div>
          </div>

          {nextTask ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Next
              </p>
              <p className="text-sm text-foreground/80 mt-0.5 leading-snug">
                {nextTask.title}
                {nextTask.estimatedMinutes > 0 ? (
                  <span className="text-muted-foreground">
                    {' '}· {nextTask.estimatedMinutes} min
                  </span>
                ) : null}
              </p>
            </div>
          ) : null}
        </div>

        {/* CTA */}
        <Button
          asChild
          size="sm"
          className="shrink-0 h-8 text-xs bg-[rgb(124,92,255)] hover:bg-[rgb(108,78,235)] text-white border-0 mt-0.5"
        >
          <Link href={resolvedHref}>
            Continue
            <ArrowRight className="ml-1.5 h-3 w-3" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
