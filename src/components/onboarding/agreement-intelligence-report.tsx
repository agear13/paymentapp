'use client';

/**
 * Agreement Intelligence Report — V6
 *
 * Designed as a professional commercial approval tool for finance, operations
 * and legal teams. Operator principle:
 *
 *   "Review, validate and approve an agreement without reading the original."
 *
 * Page flow (Part 10):
 *   1. Agreement hero — single title, owner, confidence, review status
 *   2. Commercial Risk Summary — structured facts + warnings (replaces AI prose)
 *   3. Revenue Share Summary — per-participant, structured fields
 *   4. Participant Review Cards — PRIMARY validation surface
 *      Card order: Commercial Terms → Payment Events → Settlement Rules → Deliverables
 *   5. Outstanding Blockers — grouped by type, no duplication
 *   6. AI Narrative — collapsed, supporting material only
 *   7. Status / readiness
 */

import * as React from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Eye,
  Info,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { IntelligenceBadge } from '@/components/provvypay/intelligence-badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { AgreementIntelligenceInsight } from '@/lib/onboarding/agreement-intelligence-insights';
import { OnboardingTemplateDraftBanner } from '@/components/onboarding/onboarding-template-draft-banner';
import { commercialTermIsUntouchedDefault } from '@/lib/onboarding/template-draft-state';
import {
  gapToActionLabel,
  readinessCertaintyLabel,
} from '@/lib/onboarding/onboarding-assistant-copy';
import { OnboardingCertaintyBadge } from '@/components/onboarding/onboarding-certainty-badge';
import type {
  CommercialRiskItem,
  GroupedBlocker,
  ParticipantCommercialCard,
  ParticipantReviewStatus,
  PaymentEventModel,
  ReviewReason,
} from '@/lib/ai-extractor/commercial-graph-types';

/* ─── Props ─────────────────────────────────────────────────────────────────── */

type AgreementIntelligenceReportProps = {
  insight: AgreementIntelligenceInsight;
  editableSection?: React.ReactNode;
  onEditDraft?: () => void;
  reviewMode?: boolean;
  hideConfidence?: boolean;
  assistantMode?: boolean;
  className?: string;
  analyzing?: boolean;
};

/* ─── Section wrapper ────────────────────────────────────────────────────────── */

function ReportSection({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="space-y-3 pt-5 border-t border-[rgba(124,92,255,0.12)] first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgb(124,92,255)]">
          {title}
        </p>
        {action}
      </div>
      {children}
    </section>
  );
}

function isDefaultPlaceholder(value: string): boolean {
  return commercialTermIsUntouchedDefault(value);
}

/* ─── Commercial Risk Summary (Part 8) ──────────────────────────────────────── */

function CommercialRiskSummarySection({ items }: { items: CommercialRiskItem[] }) {
  if (items.length === 0) return null;
  const facts = items.filter((i) => i.type === 'fact');
  const warnings = items.filter((i) => i.type === 'warning');

  return (
    <ReportSection title="Commercial Risk Summary">
      <div className="surface-agreement-card px-4 py-4 space-y-1">
        {facts.map((item) => (
          <div key={item.text} className="flex items-center gap-2 text-sm py-0.5">
            <Check className="h-3.5 w-3.5 text-[rgb(29,111,66)] shrink-0" />
            <span>{item.text}</span>
          </div>
        ))}
        {warnings.length > 0 ? (
          <div className="border-t border-border/30 pt-2 mt-2 space-y-1">
            {warnings.map((item) => (
              <div key={item.text} className="flex items-start gap-2 text-sm py-0.5 text-amber-900">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </ReportSection>
  );
}

/* ─── Revenue Share Summary (Part 4) ────────────────────────────────────────── */

function RevenueShareSummarySection({
  rows,
}: {
  rows: NonNullable<AgreementIntelligenceInsight['revenueShareSummary']>;
}) {
  if (rows.length === 0) return null;
  return (
    <ReportSection title="Revenue Share Agreements">
      <div className="grid gap-2.5 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            key={row.participantId}
            className="rounded-lg border border-[rgba(124,92,255,0.12)] bg-white/80 px-3 py-3 space-y-1.5"
          >
            <p className="font-semibold text-sm">{row.participantName}</p>
            <p className="text-2xl font-bold text-[rgb(124,92,255)] leading-none">{row.percentage}%</p>
            <div className="space-y-1 text-sm">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Revenue Source</span>
                <p className="mt-0.5">{row.revenueBasis}</p>
              </div>
              {row.referralCode ? (
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Attribution</span>
                  <p className="mt-0.5 font-mono text-sm">Promo Code {row.referralCode}</p>
                </div>
              ) : null}
              {row.settlement ? (
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Settlement</span>
                  <p className="mt-0.5 text-muted-foreground">{row.settlement}</p>
                </div>
              ) : null}
              {row.condition ? (
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Condition</span>
                  <p className="mt-0.5 text-amber-900 text-xs bg-amber-50 rounded px-1.5 py-0.5">{row.condition}</p>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </ReportSection>
  );
}

/* ─── Grouped blockers (Part 7) ─────────────────────────────────────────────── */

function GroupedBlockersList({ blockers }: { blockers: GroupedBlocker[] }) {
  const [expandedTypes, setExpandedTypes] = React.useState<Set<string>>(new Set());

  if (blockers.length === 0) return null;

  const toggle = (type: string) =>
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });

  return (
    <ReportSection title="Outstanding Blockers">
      <p className="text-xs text-muted-foreground -mt-1">
        Complete these before the agreement can settle.
      </p>
      <div className="space-y-2">
        {blockers.map((blocker) => {
          const isExpanded = expandedTypes.has(blocker.type);
          return (
            <div
              key={blocker.type}
              className="rounded-lg border border-amber-200/80 bg-amber-50/50 overflow-hidden"
            >
              <button
                type="button"
                className="w-full flex items-start justify-between gap-2 px-3 py-2.5 text-left"
                onClick={() => toggle(blocker.type)}
              >
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-950">{blocker.title}</p>
                    <p className="text-xs text-amber-800 mt-0.5">{blocker.description}</p>
                  </div>
                </div>
                {blocker.participants.length > 1 ? (
                  isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  )
                ) : null}
              </button>
              {isExpanded && blocker.participants.length > 1 ? (
                <div className="px-3 pb-2.5 border-t border-amber-200/60">
                  <ul className="mt-1.5 space-y-0.5">
                    {blocker.participants.map((p) => (
                      <li key={p} className="text-xs text-amber-800 flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-amber-500" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </ReportSection>
  );
}

/* ─── Review status badge (Part 2/9) ────────────────────────────────────────── */

function ReviewStatusBadge({
  status,
  reasons,
}: {
  status: ParticipantReviewStatus;
  reasons: ReviewReason[];
}) {
  const count = reasons.length;

  if (status === 'ready') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[rgba(29,111,66,0.1)] text-[rgb(29,111,66)]">
        <CheckCircle2 className="h-3 w-3" />
        Ready
      </span>
    );
  }

  if (status === 'needs_review') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60">
        <Eye className="h-3 w-3" />
        Needs Review{count > 0 ? ` (${count})` : ''}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200/60">
      <XCircle className="h-3 w-3" />
      Missing Info{count > 0 ? ` (${count})` : ''}
    </span>
  );
}

/* ─── Payment event card (Part 5 — timeline-driven) ─────────────────────────── */

function PaymentEventCard({
  event,
}: {
  event: PaymentEventModel;
}) {
  return (
    <div className="rounded-md border border-[rgba(124,92,255,0.1)] bg-[rgba(124,92,255,0.025)] px-3 py-2.5 space-y-1">
      {event.due ? (
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-[rgb(124,92,255)] shrink-0" />
          <p className="text-xs font-semibold text-foreground">{event.due}</p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">Timing not captured</p>
      )}
      <ul className="space-y-0.5">
        {event.pays.map((item) => (
          <li key={item} className="flex items-center gap-1.5 text-sm">
            <span className="h-1 w-1 rounded-full bg-[rgb(124,92,255)] shrink-0" />
            {item}
          </li>
        ))}
      </ul>
      {event.condition ? (
        <p className="text-xs text-amber-700 bg-amber-50/80 rounded px-2 py-1 mt-1">
          Condition: {event.condition}
        </p>
      ) : null}
    </div>
  );
}

/* ─── Participant review card (Parts 2, 3, 6, 9) ────────────────────────────── */

function ParticipantReviewCard({
  card,
  isTemplate,
  defaultExpanded,
}: {
  card: ParticipantCommercialCard;
  isTemplate: boolean;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  const hasPaymentEvents = card.paymentEvents.length > 0;
  const hasSettlementRules = card.settlementRules.length > 0;
  const hasFixedPayments = card.fixedPayments.length > 0;
  const hasRevenueShare = card.revenueShareTerms.length > 0;
  const hasConditional = card.conditionalBonuses.length > 0;
  const hasDeliverables = card.operationalObligations.length > 0;
  const hasReasons = card.reviewReasons.length > 0;

  return (
    <div
      className={cn(
        'rounded-lg border overflow-hidden',
        card.reviewStatus === 'ready'
          ? 'border-[rgba(124,92,255,0.12)] bg-white/80'
          : card.reviewStatus === 'needs_review'
            ? 'border-amber-200/80 bg-amber-50/30'
            : 'border-red-200/80 bg-red-50/20'
      )}
    >
      {/* Header row — always visible */}
      <button
        type="button"
        className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <div
            className={cn(
              'h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold mt-0.5',
              card.reviewStatus === 'ready'
                ? 'bg-[rgba(124,92,255,0.1)] text-[rgb(124,92,255)]'
                : 'bg-muted text-muted-foreground'
            )}
            aria-hidden
          >
            {(card.name[0] ?? '?').toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-sm leading-snug">{card.name}</p>
              <ReviewStatusBadge status={card.reviewStatus} reasons={card.reviewReasons} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {card.serviceCategory ?? card.role}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
        )}
      </button>

      {/* Expanded content — card hierarchy: Commercial Terms → Payment Events → Settlement → Deliverables */}
      {expanded ? (
        <div className="px-4 pb-4 space-y-4 border-t border-[rgba(0,0,0,0.05)]">
          {/* Explicit review reasons (Part 2) */}
          {hasReasons && !isTemplate ? (
            <div className="pt-3 flex flex-col gap-1">
              {card.reviewReasons.map((r) => (
                <div key={r.code} className="flex items-center gap-2 text-xs text-amber-900">
                  <Info className="h-3 w-3 text-amber-600 shrink-0" />
                  {r.label}
                </div>
              ))}
            </div>
          ) : null}

          {/* 1. Commercial Terms — Fixed + Revenue Share separated (Part 3) */}
          {(hasFixedPayments || hasRevenueShare || hasConditional) ? (
            <div className={cn('space-y-2', !hasReasons && 'pt-3')}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Commercial Terms
              </p>
              {hasFixedPayments ? (
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Fixed Payments</p>
                  <ul className="space-y-0.5">
                    {card.fixedPayments.map((item) => {
                      const isLow = card.lowConfidenceItems.includes(item);
                      return (
                        <li key={item} className="flex items-start gap-1.5 text-sm">
                          <Check className={cn('h-3.5 w-3.5 shrink-0 mt-0.5', isLow ? 'text-amber-500' : 'text-[rgb(124,92,255)]')} />
                          <span className={isLow ? 'text-amber-900' : undefined}>{item}</span>
                          {isLow ? <span className="ml-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">Review</span> : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {hasRevenueShare ? (
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Revenue Share</p>
                  <ul className="space-y-0.5">
                    {card.revenueShareTerms.map((item) => {
                      const isLow = card.lowConfidenceItems.includes(item);
                      return (
                        <li key={item} className="flex items-start gap-1.5 text-sm">
                          <Check className={cn('h-3.5 w-3.5 shrink-0 mt-0.5', isLow ? 'text-amber-500' : 'text-[rgb(124,92,255)]')} />
                          <span className={isLow ? 'text-amber-900' : undefined}>{item}</span>
                          {isLow ? <span className="ml-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">Review</span> : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {hasConditional ? (
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Conditional Bonus</p>
                  <ul className="space-y-0.5">
                    {card.conditionalBonuses.map((item) => (
                      <li key={item} className="flex items-start gap-1.5 text-sm text-amber-900">
                        <Check className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* 2. Payment Events — timeline-driven (Part 5 / Part 6) */}
          {hasPaymentEvents ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Payment Events
              </p>
              <div className="space-y-2">
                {card.paymentEvents.map((event, i) => (
                  <PaymentEventCard key={i} event={event} />
                ))}
              </div>
            </div>
          ) : null}

          {/* 3. Settlement Rules (Part 6) */}
          {hasSettlementRules ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Settlement Rules
              </p>
              <ul className="space-y-0.5">
                {card.settlementRules.map((rule) => (
                  <li key={rule} className="text-sm text-muted-foreground flex items-start gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-muted-foreground shrink-0 mt-2" />
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* 4. Deliverables (Part 6 — last in hierarchy) */}
          {hasDeliverables ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Deliverables
              </p>
              <ul className="space-y-0.5">
                {card.operationalObligations.map((item) => (
                  <li key={item} className="flex items-start gap-1.5 text-sm">
                    <Check className="h-3.5 w-3.5 text-[rgb(124,92,255)] shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ─── Agreement hero (Part 1 — single hero, no duplication) ─────────────────── */

function AgreementHero({
  insight,
  useAssistant,
  analyzing,
  readinessLabel,
  onEditDraft,
}: {
  insight: AgreementIntelligenceInsight;
  useAssistant: boolean;
  analyzing: boolean;
  readinessLabel: string;
  onEditDraft?: () => void;
}) {
  const isFromTemplate = insight.creationSource === 'template';
  const isTemplateDraft = insight.isTemplateDraft === true;

  // Derive overall review summary from participant cards
  const cards = insight.participantCards ?? [];
  const missingInfoCount = cards.filter((c) => c.reviewStatus === 'missing_info').length;
  const needsReviewCount = cards.filter((c) => c.reviewStatus === 'needs_review').length;
  const readyCount = cards.filter((c) => c.reviewStatus === 'ready').length;

  return (
    <div className="space-y-3">
      {/* Template banner */}
      {isFromTemplate && insight.templateTitle && !isTemplateDraft ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <OnboardingTemplateDraftBanner templateTitle={insight.templateTitle} compact />
          {onEditDraft ? (
            <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={onEditDraft}>
              Edit Draft
            </Button>
          ) : null}
        </div>
      ) : isTemplateDraft && insight.templateTitle ? (
        <OnboardingTemplateDraftBanner templateTitle={insight.templateTitle} />
      ) : null}

      {/* Hero content */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-2">
          {!isFromTemplate && !isTemplateDraft ? (
            <IntelligenceBadge pulse={analyzing} />
          ) : null}
          <div>
            <p className="text-lg sm:text-xl font-semibold tracking-tight">
              {useAssistant ? "We've prepared your agreement" : 'Agreement review'}
            </p>
            {useAssistant ? (
              <p className="text-sm text-muted-foreground mt-1">
                Review each participant — approve when it looks right.
              </p>
            ) : null}
          </div>
          <p className="text-base font-semibold text-foreground">{insight.agreementName}</p>
          {insight.agreementOwner ? (
            <p className="text-sm text-muted-foreground">
              Agreement owner: <span className="font-medium text-foreground">{insight.agreementOwner}</span>
            </p>
          ) : null}
          {insight.agreementType ? (
            <p className="text-xs text-muted-foreground">{insight.agreementType}</p>
          ) : null}
        </div>

        {/* Readiness + participant review status */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          {useAssistant ? (
            <OnboardingCertaintyBadge label={readinessLabel} sublabel="Approve when ready" />
          ) : null}

          {cards.length > 0 ? (
            <div className="flex gap-2 flex-wrap justify-end">
              {readyCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[rgba(29,111,66,0.1)] text-[rgb(29,111,66)]">
                  <CheckCircle2 className="h-3 w-3" />
                  {readyCount} ready
                </span>
              ) : null}
              {needsReviewCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60">
                  <Eye className="h-3 w-3" />
                  {needsReviewCount} needs review
                </span>
              ) : null}
              {missingInfoCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200/60">
                  <XCircle className="h-3 w-3" />
                  {missingInfoCount} missing info
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ─── Main export ────────────────────────────────────────────────────────────── */

export function AgreementIntelligenceReport({
  insight,
  editableSection,
  onEditDraft,
  reviewMode = false,
  hideConfidence = false,
  assistantMode = false,
  className,
  analyzing = false,
}: AgreementIntelligenceReportProps) {
  const [aiSummaryOpen, setAiSummaryOpen] = React.useState(false);
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  const isTemplateDraft = insight.isTemplateDraft === true;
  const isFromTemplate = insight.creationSource === 'template';
  const useAssistant = assistantMode || hideConfidence || reviewMode || isFromTemplate;
  const readinessLabel = readinessCertaintyLabel(insight.readinessScore);
  const showInlineEditing = Boolean(editableSection) && !reviewMode;

  const hasParticipantCards = (insight.participantCards?.length ?? 0) > 0;

  /* ── Consolidated blockers — prefer grouped, fall back to flat list ── */
  const groupedBlockers = insight.groupedBlockers ?? [];
  const flatBlockers = React.useMemo(() => {
    // Only used when no grouped blockers are available (template / manual flows)
    if (groupedBlockers.length > 0) return [];
    const seen = new Set<string>();
    const all: string[] = [];
    for (const b of insight.settlementBlockers ?? []) {
      if (!seen.has(b.toLowerCase())) { seen.add(b.toLowerCase()); all.push(b); }
    }
    for (const g of insight.potentialGaps) {
      if (!seen.has(g.toLowerCase())) { seen.add(g.toLowerCase()); all.push(g); }
    }
    return all;
  }, [groupedBlockers.length, insight.settlementBlockers, insight.potentialGaps]);

  return (
    <div className={cn('space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-700', className)}>
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border border-[rgba(124,92,255,0.18)] bg-gradient-to-br from-[rgba(124,92,255,0.08)] via-white to-[rgba(124,92,255,0.04)] shadow-lg shadow-[rgba(124,92,255,0.08)]',
          analyzing && 'animate-shimmer'
        )}
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#7C5CFF] via-[#9B7CFF] to-[#7C5CFF]" />

        <div className="p-6 sm:p-8 space-y-6">
          {/* ── Part 1: Single hero ── */}
          <AgreementHero
            insight={insight}
            useAssistant={useAssistant}
            analyzing={analyzing}
            readinessLabel={readinessLabel}
            onEditDraft={onEditDraft}
          />

          {/* ── Part 8: Commercial Risk Summary ── */}
          {(insight.commercialRiskSummary?.length ?? 0) > 0 ? (
            <CommercialRiskSummarySection items={insight.commercialRiskSummary!} />
          ) : insight.commercialStructure ? (
            /* Fallback: structured facts from commercialStructure when no risk summary */
            <ReportSection title="Commercial Summary">
              <div className="surface-agreement-card px-4 py-4 space-y-1">
                <div className="flex items-center justify-between text-sm py-1">
                  <span className="text-muted-foreground">Participants</span>
                  <span className="font-medium">{insight.commercialStructure.participantCount}</span>
                </div>
                {insight.commercialStructure.estimatedFixedCommitment > 0 ? (
                  <div className="flex items-center justify-between text-sm py-1">
                    <span className="text-muted-foreground">Estimated Fixed Spend</span>
                    <span className="font-medium">
                      ${insight.commercialStructure.estimatedFixedCommitment.toLocaleString('en-AU', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                ) : null}
                {insight.commercialStructure.revenueShareAgreementCount > 0 ? (
                  <div className="flex items-center justify-between text-sm py-1">
                    <span className="text-muted-foreground">Revenue Share Agreements</span>
                    <span className="font-medium">{insight.commercialStructure.revenueShareAgreementCount}</span>
                  </div>
                ) : null}
                {insight.commercialStructure.conditionalPaymentCount > 0 ? (
                  <div className="flex items-center justify-between text-sm py-1">
                    <span className="text-muted-foreground">Conditional Bonuses</span>
                    <span className="font-medium">{insight.commercialStructure.conditionalPaymentCount}</span>
                  </div>
                ) : null}
              </div>
            </ReportSection>
          ) : null}

          {/* ── Part 4: Revenue Share Summary ── */}
          {(insight.revenueShareSummary?.length ?? 0) > 0 ? (
            <RevenueShareSummarySection rows={insight.revenueShareSummary!} />
          ) : null}

          {/* ── Parts 2, 3, 5, 6, 9: Participant Review Cards ── */}
          {hasParticipantCards ? (
            <ReportSection title="Participant Review">
              <p className="text-xs text-muted-foreground -mt-1">
                Validate one participant at a time. Cards with amber or red status need your attention.
              </p>
              <div className="grid gap-2.5">
                {insight.participantCards!.map((card) => (
                  <ParticipantReviewCard
                    key={card.participantId}
                    card={card}
                    isTemplate={isFromTemplate}
                    defaultExpanded={card.reviewStatus !== 'ready'}
                  />
                ))}
              </div>
            </ReportSection>
          ) : (
            /* Fallback: plain participant list */
            <ReportSection title="Participants">
              <ul className="space-y-2">
                {insight.participantsFound.map((participant) => (
                  <li key={participant.name} className="flex items-center gap-2.5 text-sm">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(124,92,255,0.1)]">
                      <Check className="h-3.5 w-3.5 text-[rgb(124,92,255)]" />
                    </span>
                    <span>
                      {participant.name}
                      {participant.role ? (
                        <span className="text-muted-foreground"> · {participant.role}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
              {/* Commercial terms fallback */}
              {insight.commercialTermsFound.length > 0 ? (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {insight.commercialTermsFound.map((term) => (
                    <li
                      key={term}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm',
                        isDefaultPlaceholder(term)
                          ? 'border-dashed border-[rgba(124,92,255,0.15)] bg-muted/40 text-muted-foreground'
                          : 'border-[rgba(124,92,255,0.1)] bg-white/80'
                      )}
                    >
                      <Check className={cn('h-4 w-4 shrink-0', isDefaultPlaceholder(term) ? 'text-muted-foreground' : 'text-[rgb(124,92,255)]')} />
                      {term}
                    </li>
                  ))}
                </ul>
              ) : null}
            </ReportSection>
          )}

          {/* ── Part 7: Grouped blockers ── */}
          {groupedBlockers.length > 0 ? (
            <GroupedBlockersList blockers={groupedBlockers} />
          ) : flatBlockers.length > 0 ? (
            <ReportSection title="Outstanding Items">
              <ul className="space-y-2">
                {flatBlockers.map((gap) => (
                  <li
                    key={gap}
                    className="flex items-start gap-2.5 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-sm text-amber-950"
                  >
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    {useAssistant ? gapToActionLabel(gap) : gap}
                  </li>
                ))}
              </ul>
            </ReportSection>
          ) : null}

          {/* ── AI narrative — collapsed, supporting material only ── */}
          {insight.commercialSummary ? (
            <ReportSection title="AI Analysis">
              <Collapsible open={aiSummaryOpen} onOpenChange={setAiSummaryOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-xs text-[rgb(124,92,255)] hover:underline"
                  >
                    <Sparkles className="h-3 w-3" />
                    {aiSummaryOpen ? 'Hide AI narrative' : 'View AI narrative'}
                    {aiSummaryOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="surface-settlement px-4 py-3">
                    <p className="text-sm leading-relaxed text-muted-foreground">{insight.commercialSummary}</p>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </ReportSection>
          ) : null}

          {/* ── Status ── */}
          <ReportSection title={useAssistant ? 'Status' : 'Agreement Readiness'}>
            <div className="surface-settlement px-4 py-4 space-y-2">
              {useAssistant ? (
                <p className="text-sm font-medium text-foreground">{readinessLabel}</p>
              ) : null}
              <p className="text-sm leading-relaxed text-muted-foreground">
                {insight.readinessExplanation}
              </p>
              {useAssistant && !isTemplateDraft ? (
                <p className="text-xs text-muted-foreground">
                  Approve this agreement, then we&apos;ll help you set up payments.
                </p>
              ) : null}
            </div>
          </ReportSection>
        </div>
      </div>

      {/* ── Inline editing ── */}
      {showInlineEditing ? (
        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="outline" className="w-full justify-between h-11">
              Review and edit agreement details
              <ChevronDown className={cn('h-4 w-4 transition-transform', detailsOpen && 'rotate-180')} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4 animate-in fade-in slide-in-from-top-1 duration-300">
            {editableSection}
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  );
}
