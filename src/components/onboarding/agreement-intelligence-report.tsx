'use client';

import * as React from 'react';
import { AlertTriangle, Check, ChevronDown, Sparkles } from 'lucide-react';
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

type AgreementIntelligenceReportProps = {
  insight: AgreementIntelligenceInsight;
  editableSection?: React.ReactNode;
  onEditDraft?: () => void;
  reviewMode?: boolean;
  hideConfidence?: boolean;
  /** Use certainty labels and outcome-first copy (onboarding). */
  assistantMode?: boolean;
  className?: string;
  analyzing?: boolean;
};

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
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const structure = insight.commercialStructure;
  const isTemplateDraft = insight.isTemplateDraft === true;
  const isFromTemplate = insight.creationSource === 'template';
  const useAssistant = assistantMode || hideConfidence || reviewMode || isFromTemplate;
  const outcomeHighlights = deriveAgreementOutcomeHighlights(insight);
  const readinessLabel = readinessCertaintyLabel(insight.readinessScore);

  const reportTitle = useAssistant
    ? "We've prepared your agreement"
    : 'Agreement summary';
  const reportSubtext = useAssistant
    ? 'Review what we found — approve when it looks right.'
    : 'Participants, commercial terms, and payment readiness for this agreement.';
  const showInlineEditing = Boolean(editableSection) && !reviewMode;
  const showReportSubtext = !reviewMode && !useAssistant;

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
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-3">
              {!isFromTemplate && !isTemplateDraft ? <IntelligenceBadge pulse={analyzing} /> : null}
              <div>
                <p className="text-lg sm:text-xl font-semibold tracking-tight">{reportTitle}</p>
                {showReportSubtext ? (
                  <p className="text-sm text-muted-foreground mt-2 max-w-xl leading-relaxed">
                    {reportSubtext}
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

          {structure ? (
            <ReportSection title="Commercial Structure">
              <div className="surface-agreement-card px-4 py-4 space-y-1">
                <MetricRow label="Agreement" value={insight.agreementType} />
                {insight.agreementOwner ? (
                  <MetricRow label="Agreement Owner" value={insight.agreementOwner} />
                ) : null}
                <MetricRow label="Participants" value={structure.participantCount} />
                <MetricRow label="Deliverables" value={structure.deliverableCount} />
                <MetricRow label="Operational Obligations" value={structure.operationalObligationCount} />
                <MetricRow label="Compensation Obligations" value={structure.compensationTermCount} />
                <MetricRow label="Settlement Events" value={structure.settlementEventCount} />
                <MetricRow label="Revenue Share Agreements" value={structure.revenueShareAgreementCount} />
                <MetricRow label="Fixed Payment Agreements" value={structure.fixedPaymentAgreementCount} />
                {structure.milestonePaymentCount > 0 ? (
                  <MetricRow label="Milestone Payments" value={structure.milestonePaymentCount} />
                ) : null}
                {structure.conditionalPaymentCount > 0 ? (
                  <MetricRow label="Conditional Payments" value={structure.conditionalPaymentCount} />
                ) : null}
                {structure.estimatedFixedCommitment > 0 ? (
                  <MetricRow
                    label="Estimated Fixed Commitment"
                    value={`$${structure.estimatedFixedCommitment.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`}
                  />
                ) : null}
              </div>
              {(insight.settlementBlockers?.length ?? 0) > 0 ? (
                <div className="mt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Outstanding Settlement Blockers
                  </p>
                  <ul className="space-y-1.5">
                    {insight.settlementBlockers!.map((blocker) => (
                      <li key={blocker} className="flex items-start gap-2 text-sm text-amber-950">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                        {blocker}
                      </li>
                    ))}
                  </ul>
                </div>
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

          {insight.commercialSummary ? (
            <ReportSection title="Commercial Summary">
              <div className="surface-settlement px-4 py-4">
                <p className="text-sm leading-relaxed">{insight.commercialSummary}</p>
              </div>
            </ReportSection>
          ) : null}

          {insight.agreementOwner ? (
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

          {insight.commercialStructureOverview && insight.commercialStructureOverview.length > 0 ? (
            <ReportSection title="Commercial Terms">
              <ul className="space-y-2">
                {insight.commercialStructureOverview.map((term) => (
                  <li key={term} className="flex items-center gap-2.5 text-sm">
                    <Check className="h-4 w-4 text-[rgb(124,92,255)] shrink-0" />
                    {term}
                  </li>
                ))}
              </ul>
            </ReportSection>
          ) : insight.commercialTermsFound.length > 0 ? (
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

          {insight.participantCards && insight.participantCards.length > 0 ? (
            <ReportSection title="Participant Summary">
              <div className="grid gap-3">
                {insight.participantCards.map((card) => (
                  <div
                    key={card.participantId}
                    className="rounded-lg border border-[rgba(124,92,255,0.12)] bg-white/80 px-4 py-3 space-y-2"
                  >
                    <div>
                      <p className="font-semibold">{card.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {card.serviceCategory ?? card.role}
                      </p>
                    </div>
                    {card.operationalObligations.length > 0 ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Deliverables
                        </p>
                        <ul className="mt-1 space-y-0.5 text-sm">
                          {card.operationalObligations.map((item) => (
                            <li key={item}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {card.compensationTerms.length > 0 ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Compensation
                        </p>
                        <ul className="mt-1 space-y-0.5 text-sm">
                          {card.compensationTerms.map((item) => (
                            <li key={item}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {card.settlementSchedule.length > 0 ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Payments
                        </p>
                        <ul className="mt-1 space-y-0.5 text-sm">
                          {card.settlementSchedule.map((item) => (
                            <li key={item}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </ReportSection>
          ) : (
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

          {insight.obligationsIdentified.length > 0 ? (
            <ReportSection title={isTemplateDraft ? 'Default obligations' : 'Payment obligations'}>
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

          {insight.settlementSchedule && insight.settlementSchedule.length > 0 ? (
            <ReportSection title="Payment schedule">
              <div className="space-y-3">
                {insight.settlementSchedule.map((entry) => (
                  <div
                    key={entry.participantId}
                    className="rounded-lg border border-[rgba(124,92,255,0.1)] bg-white/80 px-3 py-3"
                  >
                    <p className="font-medium text-sm">{entry.participantName}</p>
                    {entry.compensationSummary.length > 0 ? (
                      <ul className="mt-1 text-sm text-muted-foreground">
                        {entry.compensationSummary.map((line) => (
                          <li key={line}>• {line}</li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-2">
                      Settlement
                    </p>
                    <ul className="text-sm">
                      {entry.settlementTriggers.map((trigger) => (
                        <li key={trigger}>• {trigger}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </ReportSection>
          ) : null}

          {insight.potentialGaps.length > 0 ? (
            <ReportSection title={useAssistant ? 'Next steps' : 'Items to complete'}>
              <ul className="space-y-2 mt-1">
                {insight.potentialGaps.map((gap) => (
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
