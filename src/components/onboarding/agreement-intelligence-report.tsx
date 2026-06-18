'use client';

/**
 * Agreement Intelligence Report
 *
 * Answers three operator questions within five seconds:
 *   1. Did AI understand the agreement?
 *   2. Is anything missing or wrong?
 *   3. Can I approve this?
 *
 * Layout (operator-first):
 *   1. Outcome highlights (certainty badge)
 *   2. Structured commercial summary (facts, not prose)
 *      ↳ AI narrative behind "View summary" — collapsed by default
 *   3. Revenue share summary (if present)
 *   4. Participant review cards — PRIMARY validation surface
 *      Each card: deliverables → compensation → payment events → settlement rules → status
 *   5. Consolidated blockers (single list — no duplication with participant cards)
 *   6. Status / readiness
 *
 * Principles:
 *   - Payment events and settlement rules are distinct.
 *   - Duplicate deliverables/obligations are suppressed.
 *   - Duplicate blocker lists are consolidated.
 *   - Confidence badges appear only for genuinely ambiguous items.
 *   - AI prose is accessible but not primary.
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
  deriveAgreementOutcomeHighlights,
  gapToActionLabel,
  readinessCertaintyLabel,
} from '@/lib/onboarding/onboarding-assistant-copy';
import {
  OnboardingCertaintyBadge,
  OnboardingOutcomeHighlights,
} from '@/components/onboarding/onboarding-certainty-badge';
import type { ParticipantCommercialCard, ParticipantReviewStatus } from '@/lib/ai-extractor/commercial-graph-types';

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
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 pt-5 border-t border-[rgba(124,92,255,0.12)] first:border-t-0 first:pt-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgb(124,92,255)]">
        {title}
      </p>
      {children}
    </section>
  );
}

/* ─── Readiness ring ─────────────────────────────────────────────────────────── */

function ScoreRing({
  value,
  label,
  sublabel,
  variant = 'intelligence',
}: {
  value: number;
  label: string;
  sublabel?: string;
  variant?: 'intelligence' | 'readiness';
}) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const stroke = variant === 'readiness' ? '#1D6F42' : '#7C5CFF';

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="relative h-24 w-24">
        <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100" aria-hidden>
          <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(124,92,255,0.12)" strokeWidth="8" />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold">{value}%</span>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        {sublabel ? <p className="text-[11px] text-muted-foreground mt-0.5">{sublabel}</p> : null}
      </div>
    </div>
  );
}

/* ─── Structured commercial summary ─────────────────────────────────────────── */

function MetricRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between text-sm py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function isDefaultPlaceholder(value: string): boolean {
  return commercialTermIsUntouchedDefault(value);
}

/* ─── Revenue share summary ──────────────────────────────────────────────────── */

function RevenueShareSummarySection({
  rows,
}: {
  rows: NonNullable<AgreementIntelligenceInsight['revenueShareSummary']>;
}) {
  if (rows.length === 0) return null;
  return (
    <ReportSection title="Revenue Share Agreements">
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            key={row.participantId}
            className="rounded-lg border border-[rgba(124,92,255,0.12)] bg-white/80 px-3 py-2.5"
          >
            <p className="font-semibold text-sm">{row.participantName}</p>
            <p className="text-sm font-medium text-[rgb(124,92,255)] mt-0.5">
              {row.percentage}%
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{row.revenueBasis}</p>
            {row.referralCode ? (
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                Code: {row.referralCode}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </ReportSection>
  );
}

/* ─── Review status badge ────────────────────────────────────────────────────── */

function ReviewStatusBadge({ status }: { status: ParticipantReviewStatus }) {
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
        Needs review
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200/60">
      <AlertTriangle className="h-3 w-3" />
      Missing info
    </span>
  );
}

/* ─── Payment event card ─────────────────────────────────────────────────────── */

function PaymentEventCard({ event }: { event: NonNullable<ParticipantCommercialCard['paymentEvents']>[number] }) {
  return (
    <div className="rounded-md border border-[rgba(124,92,255,0.1)] bg-[rgba(124,92,255,0.025)] px-3 py-2.5 space-y-1">
      {event.due ? (
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-[rgb(124,92,255)] shrink-0" />
          <p className="text-xs text-muted-foreground">Due: <span className="font-medium text-foreground">{event.due}</span></p>
        </div>
      ) : null}
      <ul className="space-y-0.5">
        {event.pays.map((item) => (
          <li key={item} className="flex items-start gap-1.5 text-sm">
            <Check className="h-3.5 w-3.5 text-[rgb(124,92,255)] shrink-0 mt-0.5" />
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

/* ─── Participant review card ────────────────────────────────────────────────── */

function ParticipantReviewCard({
  card,
  isTemplate,
}: {
  card: ParticipantCommercialCard;
  isTemplate: boolean;
}) {
  const [expanded, setExpanded] = React.useState(
    card.reviewStatus !== 'ready'
  );

  const hasPaymentEvents = card.paymentEvents.length > 0;
  const hasSettlementRules = card.settlementRules.length > 0;
  const hasLowConfidence = card.lowConfidenceItems.length > 0;

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
              'h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold',
              card.reviewStatus === 'ready'
                ? 'bg-[rgba(124,92,255,0.1)] text-[rgb(124,92,255)]'
                : 'bg-muted text-muted-foreground'
            )}
            aria-hidden
          >
            {(card.name[0] ?? '?').toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-snug truncate">{card.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {card.serviceCategory ?? card.role}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ReviewStatusBadge status={card.reviewStatus} />
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded ? (
        <div className="px-4 pb-4 space-y-3 border-t border-[rgba(0,0,0,0.05)]">
          {/* Deliverables */}
          {card.operationalObligations.length > 0 ? (
            <div className="pt-3">
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

          {/* Compensation */}
          {card.compensationTerms.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Compensation
              </p>
              <ul className="space-y-0.5">
                {card.compensationTerms.map((item) => {
                  const isLow = card.lowConfidenceItems.includes(item);
                  return (
                    <li key={item} className="flex items-start gap-1.5 text-sm">
                      <Check
                        className={cn(
                          'h-3.5 w-3.5 shrink-0 mt-0.5',
                          isLow ? 'text-amber-500' : 'text-[rgb(124,92,255)]'
                        )}
                      />
                      <span className={isLow ? 'text-amber-900' : undefined}>{item}</span>
                      {isLow ? (
                        <span className="ml-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">
                          Review
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {/* Payment Events */}
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

          {/* Settlement Rules */}
          {hasSettlementRules ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Settlement Rules
              </p>
              <ul className="space-y-0.5">
                {card.settlementRules.map((rule) => (
                  <li key={rule} className="text-sm text-muted-foreground">• {rule}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Low confidence warning */}
          {hasLowConfidence && !isTemplate ? (
            <div className="flex items-start gap-2 rounded-md border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
              <Info className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span>
                {card.lowConfidenceItems.length === 1
                  ? 'One compensation term was extracted with medium confidence'
                  : `${card.lowConfidenceItems.length} compensation terms were extracted with medium or low confidence`}
                . Review before approving.
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
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
  const [summaryOpen, setSummaryOpen] = React.useState(false);
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  const structure = insight.commercialStructure;
  const isTemplateDraft = insight.isTemplateDraft === true;
  const isFromTemplate = insight.creationSource === 'template';
  const useAssistant = assistantMode || hideConfidence || reviewMode || isFromTemplate;
  const outcomeHighlights = deriveAgreementOutcomeHighlights(insight);
  const readinessLabel = readinessCertaintyLabel(insight.readinessScore);
  const showInlineEditing = Boolean(editableSection) && !reviewMode;

  /* ── Consolidate blockers — single list, no duplication ── */
  const consolidatedBlockers = React.useMemo(() => {
    const seen = new Set<string>();
    const all: string[] = [];
    // Settlement blockers first (more specific), then potential gaps
    for (const b of insight.settlementBlockers ?? []) {
      const key = b.toLowerCase();
      if (!seen.has(key)) { seen.add(key); all.push(b); }
    }
    for (const g of insight.potentialGaps) {
      const key = g.toLowerCase();
      if (!seen.has(key)) { seen.add(key); all.push(g); }
    }
    return all;
  }, [insight.settlementBlockers, insight.potentialGaps]);

  const hasParticipantCards = (insight.participantCards?.length ?? 0) > 0;

  const reportTitle = useAssistant
    ? "We've prepared your agreement"
    : 'Agreement summary';

  return (
    <div className={cn('space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-700', className)}>
      {useAssistant && outcomeHighlights.length > 0 ? (
        <OnboardingOutcomeHighlights items={outcomeHighlights} />
      ) : null}

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

      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border border-[rgba(124,92,255,0.18)] bg-gradient-to-br from-[rgba(124,92,255,0.08)] via-white to-[rgba(124,92,255,0.04)] shadow-lg shadow-[rgba(124,92,255,0.08)]',
          analyzing && 'animate-shimmer'
        )}
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#7C5CFF] via-[#9B7CFF] to-[#7C5CFF]" />

        <div className="p-6 sm:p-8 space-y-6">
          {/* ── Header ── */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-3">
              {!isFromTemplate && !isTemplateDraft ? <IntelligenceBadge pulse={analyzing} /> : null}
              <div>
                <p className="text-lg sm:text-xl font-semibold tracking-tight">{reportTitle}</p>
                {!useAssistant ? (
                  <p className="text-sm text-muted-foreground mt-2 max-w-xl leading-relaxed">
                    Review what the AI found — approve when it looks right.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-foreground">{insight.agreementName}</p>
                {isFromTemplate && !isTemplateDraft ? (
                  <span
                    className={cn(
                      'text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full',
                      insight.isCustomisedDraft
                        ? 'bg-[rgba(124,92,255,0.1)] text-[rgb(124,92,255)]'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {insight.isCustomisedDraft ? 'Customised Draft' : 'Draft Agreement'}
                  </span>
                ) : null}
              </div>
            </div>

            <div className={cn('flex shrink-0', useAssistant ? 'justify-end' : 'gap-6')}>
              {!hideConfidence && !useAssistant ? (
                <ScoreRing
                  value={insight.agreementTypeConfidence}
                  label="Agreement quality"
                  sublabel="Structure"
                />
              ) : null}
              {useAssistant ? (
                <OnboardingCertaintyBadge
                  label={readinessLabel}
                  sublabel="Approve when ready"
                />
              ) : (
                <ScoreRing
                  value={insight.readinessScore}
                  label="Readiness"
                  sublabel={insight.readinessScore >= 75 ? 'Ready to continue' : 'Needs attention'}
                  variant="readiness"
                />
              )}
            </div>
          </div>

          {/* ── Commercial Summary (structured facts first, AI prose collapsed) ── */}
          {structure ? (
            <ReportSection title="Commercial Summary">
              <div className="surface-agreement-card px-4 py-4 space-y-1">
                <MetricRow label="Agreement" value={insight.agreementType} />
                {insight.agreementOwner ? (
                  <MetricRow label="Agreement Owner" value={insight.agreementOwner} />
                ) : null}
                <MetricRow label="Participants" value={structure.participantCount} />
                {structure.estimatedFixedCommitment > 0 ? (
                  <MetricRow
                    label="Estimated Fixed Spend"
                    value={`$${structure.estimatedFixedCommitment.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`}
                  />
                ) : null}
                {structure.revenueShareAgreementCount > 0 ? (
                  <MetricRow label="Revenue Share Agreements" value={structure.revenueShareAgreementCount} />
                ) : null}
                {structure.instalmentPaymentCount > 0 ? (
                  <MetricRow label="Instalment Plans" value={structure.instalmentPaymentCount} />
                ) : null}
                {structure.conditionalPaymentCount > 0 ? (
                  <MetricRow label="Conditional Bonuses" value={structure.conditionalPaymentCount} />
                ) : null}
                {structure.variableRevenueBases.length > 0 ? (
                  <div className="pt-1 border-t border-border/30 mt-1">
                    <p className="text-xs text-muted-foreground mb-1">Revenue Sources</p>
                    <ul className="space-y-0.5">
                      {structure.variableRevenueBases.map((rb) => (
                        <li key={rb} className="text-sm text-foreground flex items-center gap-1.5">
                          <span className="h-1 w-1 rounded-full bg-[rgb(124,92,255)] shrink-0" />
                          {rb}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {consolidatedBlockers.length > 0 ? (
                  <div className="pt-1 border-t border-border/30 mt-1">
                    <p className="text-xs text-muted-foreground mb-1">Outstanding Blockers</p>
                    <ul className="space-y-1">
                      {consolidatedBlockers.map((blocker) => (
                        <li key={blocker} className="flex items-start gap-1.5 text-sm text-amber-950">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                          {useAssistant ? gapToActionLabel(blocker) : blocker}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              {/* AI narrative — collapsed by default */}
              {insight.commercialSummary ? (
                <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen}>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-xs text-[rgb(124,92,255)] hover:underline mt-1"
                    >
                      <Sparkles className="h-3 w-3" />
                      {summaryOpen ? 'Hide AI summary' : 'View AI summary'}
                      {summaryOpen ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="surface-settlement px-4 py-3">
                      <p className="text-sm leading-relaxed text-muted-foreground">{insight.commercialSummary}</p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ) : null}
            </ReportSection>
          ) : (
            <ReportSection title={isTemplateDraft ? 'Template structure' : 'Commercial Agreement Detected'}>
              <div className="surface-agreement-card px-4 py-4 flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-base">{insight.agreementType}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isTemplateDraft
                      ? `${insight.participantsFound.length} participant${insight.participantsFound.length === 1 ? '' : 's'} — add names and settlement details`
                      : `${insight.participantsFound.length} participant${insight.participantsFound.length === 1 ? '' : 's'} in this agreement`}
                  </p>
                </div>
                {!isTemplateDraft && !isFromTemplate ? (
                  <Sparkles className="h-5 w-5 text-[rgb(124,92,255)] shrink-0" />
                ) : null}
              </div>
            </ReportSection>
          )}

          {/* ── Revenue Share Summary ── */}
          {(insight.revenueShareSummary?.length ?? 0) > 0 ? (
            <RevenueShareSummarySection rows={insight.revenueShareSummary!} />
          ) : null}

          {/* ── Agreement Owner (when not shown in structure) ── */}
          {insight.agreementOwner && !structure ? (
            <ReportSection title="Agreement Owner">
              <div className="surface-agreement-card px-4 py-3">
                <p className="font-medium">{insight.agreementOwner}</p>
                {insight.agreementOwnerResponsibilities?.length ? (
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {insight.agreementOwnerResponsibilities.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </ReportSection>
          ) : null}

          {/* ── Participant Review Cards (primary validation surface) ── */}
          {hasParticipantCards ? (
            <ReportSection title="Participant Review">
              <p className="text-xs text-muted-foreground -mt-1">
                Validate one participant at a time. Cards in amber or red need your attention before approving.
              </p>
              <div className="grid gap-2.5">
                {insight.participantCards!.map((card) => (
                  <ParticipantReviewCard
                    key={card.participantId}
                    card={card}
                    isTemplate={isFromTemplate}
                  />
                ))}
              </div>
            </ReportSection>
          ) : (
            /* Fallback: plain participant list when no cards available */
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
            </ReportSection>
          )}

          {/* ── Commercial Terms fallback (when no participant cards) ── */}
          {!hasParticipantCards && insight.commercialTermsFound.length > 0 ? (
            <ReportSection title={isTemplateDraft ? 'Default commercial terms' : 'Commercial Terms'}>
              <ul className="grid gap-2 sm:grid-cols-2">
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
                    <Check
                      className={cn(
                        'h-4 w-4 shrink-0',
                        isDefaultPlaceholder(term)
                          ? 'text-muted-foreground'
                          : 'text-[rgb(124,92,255)]'
                      )}
                    />
                    {term}
                  </li>
                ))}
              </ul>
            </ReportSection>
          ) : null}

          {/* ── Operational obligations: only when participant cards are NOT shown ── */}
          {!hasParticipantCards && insight.obligationsIdentified.length > 0 ? (
            <ReportSection title={isTemplateDraft ? 'Default obligations' : 'Obligations'}>
              <ul className="space-y-2">
                {insight.obligationsIdentified.map((obligation) => (
                  <li
                    key={obligation}
                    className={cn(
                      'flex items-start gap-2.5 text-sm',
                      isDefaultPlaceholder(obligation) && 'text-muted-foreground'
                    )}
                  >
                    <Check
                      className={cn(
                        'h-4 w-4 shrink-0 mt-0.5',
                        isDefaultPlaceholder(obligation)
                          ? 'text-muted-foreground'
                          : 'text-[rgb(124,92,255)]'
                      )}
                    />
                    {obligation}
                  </li>
                ))}
              </ul>
            </ReportSection>
          ) : null}

          {/* ── Status ── */}
          <ReportSection title={useAssistant ? 'Status' : 'Agreement Readiness Score'}>
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

      {/* ── Inline editing (when outside review mode) ── */}
      {showInlineEditing ? (
        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="outline" className="w-full justify-between h-11">
              Review and edit agreement details
              <ChevronDown
                className={cn('h-4 w-4 transition-transform', detailsOpen && 'rotate-180')}
              />
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
