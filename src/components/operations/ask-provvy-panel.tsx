'use client';

import * as React from 'react';
import { ArrowRight, MessageCircle, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCompactCurrency } from '@/lib/formatters/format-currency';
import type { AttentionItem } from '@/lib/operations/severity';
import type { OperationalKPIs } from '@/lib/operations/reducer/types';
import type { ReleaseConfidenceSnapshot } from '@/lib/operations/explainability/types';
import { PRODUCT_TERMINOLOGY } from '@/lib/product/product-terminology';
import type { AgreementHealthSnapshot } from '@/lib/agreements/health/agreement-health.types';

type AskProvvyPanelProps = {
  snapshots: AgreementHealthSnapshot[];
  attentionItems: AttentionItem[];
  releaseConfidence: ReleaseConfidenceSnapshot | null;
  kpis: OperationalKPIs | null | undefined;
};

/* ─── Suggested prompts with deterministic answers ─── */

type ProvvyQuery = {
  id: string;
  question: string;
  deriveAnswer: (data: AskProvvyPanelProps) => string;
};

const QUERIES: ProvvyQuery[] = [
  {
    id: 'blocking-payouts',
    question: 'What projects are blocking payouts?',
    deriveAnswer: ({ snapshots }) => {
      const blocking = snapshots.filter(
        (s) => s.category === 'at_risk' || s.category === 'attention_required'
      );
      if (blocking.length === 0) {
        return 'No projects are currently blocking payouts. Everything is on track.';
      }
      const names = blocking.map((s) => s.agreementName);
      const nameList = names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
      return `${nameList} ${blocking.length === 1 ? 'is' : 'are'} not yet ready for settlement. The primary issue${blocking.length === 1 ? '' : 's'}: ${blocking.map((s) => s.categoryReason.toLowerCase()).filter(Boolean).join('; ') || `review the ${PRODUCT_TERMINOLOGY.projectLower} for details`}.`;
    },
  },
  {
    id: 'who-hasnt-approved',
    question: "Who hasn't approved yet?",
    deriveAnswer: ({ kpis, releaseConfidence }) => {
      const blocked = releaseConfidence?.blockedParticipantCount ?? 0;
      const total = kpis?.participantCount ?? 0;
      const approved = kpis?.approvedAgreementCount ?? 0;
      if (blocked === 0 && total > 0) {
        return 'All participants have approved their agreements. Everyone is ready.';
      }
      if (total === 0) {
        return 'No participants have been added yet. Add participants to send them agreements for approval.';
      }
      const pending = total - approved;
      return `${pending} of ${total} participant${pending === 1 ? '' : 's'} still need${pending === 1 ? 's' : ''} to approve. Once everyone approves, payouts can be released.`;
    },
  },
  {
    id: 'money-to-release',
    question: 'How much money can I release today?',
    deriveAnswer: ({ releaseConfidence }) => {
      const ready = releaseConfidence?.readyToRelease ?? 0;
      const currency = releaseConfidence?.currency ?? 'AUD';
      const collected = releaseConfidence?.collectedRevenue ?? 0;
      if (ready > 0) {
        return `${formatCompactCurrency(ready, currency)} is ready to release right now. You can start a payout batch immediately from the project's Money section.`;
      }
      if (collected > 0) {
        const held = releaseConfidence?.heldBack ?? 0;
        const reserved = releaseConfidence?.reservedObligations ?? 0;
        if (held > 0) {
          return `${formatCompactCurrency(collected, currency)} has been collected but ${formatCompactCurrency(held, currency)} is on hold. Complete outstanding approvals to unlock the funds.`;
        }
        if (reserved > 0) {
          return `${formatCompactCurrency(collected, currency)} has been collected. ${formatCompactCurrency(reserved, currency)} is reserved for obligations and awaiting final confirmation before release.`;
        }
        return `${formatCompactCurrency(collected, currency)} has been collected. Complete remaining approvals to move it to release-ready.`;
      }
      return 'No revenue has been collected yet. Revenue flows in once customer payments begin.';
    },
  },
  {
    id: 'ready-for-payments',
    question: 'Which projects are ready for payments?',
    deriveAnswer: ({ snapshots }) => {
      const ready = snapshots.filter(
        (s) => s.category === 'excellent' || s.score >= 80
      );
      if (ready.length === 0) {
        return `No ${PRODUCT_TERMINOLOGY.projectsLower} are fully ready for payments yet. Review the outstanding tasks on each ${PRODUCT_TERMINOLOGY.projectLower} to move them forward.`;
      }
      const names = ready.map((s) => s.agreementName);
      const nameList = names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
      return `${nameList} ${ready.length === 1 ? 'is' : 'are'} ready for payments. You can begin the payout process from ${ready.length === 1 ? 'its' : 'their'} Money section.`;
    },
  },
  {
    id: 'missing-participants',
    question: 'Show me projects missing participants.',
    deriveAnswer: ({ snapshots, attentionItems }) => {
      const participantIssues = attentionItems.filter((i) =>
        /participant|invite|approval/i.test(i.title + ' ' + i.explanation)
      );
      if (participantIssues.length === 0) {
        return `All ${PRODUCT_TERMINOLOGY.projectsLower} have their participants configured. No invitations are outstanding.`;
      }
      const affectedAgreements = [
        ...new Set(participantIssues.map((i) => i.projectName).filter(Boolean)),
      ] as string[];
      if (affectedAgreements.length === 0) {
        return `${participantIssues.length} participant ${participantIssues.length === 1 ? 'action needs' : 'actions need'} your attention. Open each ${PRODUCT_TERMINOLOGY.projectLower} to see who to invite.`;
      }
      return `${affectedAgreements.join(', ')} ${affectedAgreements.length === 1 ? 'has' : 'have'} outstanding participant actions — invitations or approvals still needed.`;
    },
  },
  {
    id: 'why-not-ready',
    question: "Why isn't my primary project ready?",
    deriveAnswer: ({ snapshots, attentionItems }) => {
      const primary = [...snapshots].sort((a, b) => a.score - b.score)[0];
      if (!primary) {
        return `There aren't any ${PRODUCT_TERMINOLOGY.projectsLower} yet. ${PRODUCT_TERMINOLOGY.createProject} and I'll guide you through it.`;
      }
      if (primary.category === 'excellent') {
        return `${primary.agreementName} is already ready — no blockers. You can proceed to release payouts.`;
      }
      const relatedItems = attentionItems.filter(
        (i) =>
          i.projectName &&
          (i.projectName.toLowerCase() === primary.agreementName.toLowerCase() ||
            primary.agreementName.toLowerCase().includes(i.projectName.toLowerCase()))
      );
      const topBlocker =
        relatedItems[0]?.title ??
        primary.reducesScore[0] ??
        primary.categoryReason;
      return `${primary.agreementName} is not ready because: ${topBlocker.toLowerCase()}. Resolving this will advance it towards settlement.`;
    },
  },
];

/* ─── Component ─── */

/**
 * Ask Provvy — intelligent workspace query panel.
 * Answers come from the Commercial Graph deterministically — no external AI call needed.
 * Feels like querying your business, not chatting with a bot.
 */
export function AskProvvyPanel(props: AskProvvyPanelProps) {
  const [activeQuery, setActiveQuery] = React.useState<string | null>(null);
  const [customInput, setCustomInput] = React.useState('');
  const [customSubmitted, setCustomSubmitted] = React.useState(false);

  const activeAnswer = React.useMemo(() => {
    if (!activeQuery) return null;
    const query = QUERIES.find((q) => q.id === activeQuery);
    return query ? query.deriveAnswer(props) : null;
  }, [activeQuery, props]);

  function handleCustomSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (customInput.trim()) setCustomSubmitted(true);
  }

  return (
    <section aria-label="Ask Provvy" className="space-y-2.5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageCircle className="h-3.5 w-3.5 text-[rgb(124,92,255)]" aria-hidden />
        <h2 className="text-sm font-semibold text-foreground">Ask Provvy</h2>
        <span className="text-xs text-muted-foreground">— query your business</span>
      </div>

      <div className="rounded-xl border border-[rgba(124,92,255,0.15)] bg-gradient-to-b from-[rgba(124,92,255,0.03)] to-white overflow-hidden">

        {/* Answer pane */}
        {activeAnswer ? (
          <div className="px-5 py-4 border-b border-[rgba(124,92,255,0.1)] space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[rgb(124,92,255)]">
              {QUERIES.find((q) => q.id === activeQuery)?.question}
            </p>
            <p className="text-sm text-foreground/90 leading-relaxed">{activeAnswer}</p>
            <button
              type="button"
              onClick={() => setActiveQuery(null)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Ask something else
            </button>
          </div>
        ) : null}

        {/* Suggested prompts */}
        {!activeAnswer ? (
          <div className="px-5 py-4 space-y-3">
            <p className="text-xs text-muted-foreground">Suggested questions:</p>
            <div className="grid gap-1.5">
              {QUERIES.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setActiveQuery(q.id)}
                  className={cn(
                    'text-left text-sm px-3 py-2 rounded-lg border transition-all duration-100',
                    'border-border/50 hover:border-[rgba(124,92,255,0.3)] hover:bg-[rgba(124,92,255,0.04)]',
                    'text-foreground/75 hover:text-foreground',
                    'flex items-center justify-between gap-2 group'
                  )}
                >
                  <span>{q.question}</span>
                  <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/40 group-hover:text-[rgb(124,92,255)] transition-colors" />
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Custom input */}
        <div className="border-t border-[rgba(124,92,255,0.1)] px-5 py-3.5">
          {customSubmitted ? (
            <p className="text-sm text-muted-foreground py-1">
              I'll help with that shortly. For now, try a suggested question above.
            </p>
          ) : (
            <form onSubmit={handleCustomSubmit} className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" aria-hidden />
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="Ask about your business…"
                className={cn(
                  'flex-1 text-sm bg-transparent outline-none',
                  'text-foreground placeholder:text-muted-foreground/40',
                  'py-0.5'
                )}
              />
              {customInput.trim() ? (
                <button
                  type="submit"
                  className="text-xs font-medium text-[rgb(124,92,255)] hover:text-[rgb(108,78,235)] transition-colors"
                >
                  Ask
                </button>
              ) : null}
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
