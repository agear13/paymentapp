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

type AgreementIntelligenceReportProps = {
  insight: AgreementIntelligenceInsight;
  editableSection?: React.ReactNode;
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

export function AgreementIntelligenceReport({
  insight,
  editableSection,
  className,
  analyzing = false,
}: AgreementIntelligenceReportProps) {
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const participantCount = insight.participantsFound.length;
  const participantLabel =
    participantCount === 1
      ? '1 participant identified'
      : `${participantCount} participants identified`;

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
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-3">
              <IntelligenceBadge pulse={analyzing} />
              <div>
                <p className="text-lg sm:text-xl font-semibold tracking-tight">
                  Agreement Intelligence Report
                </p>
                <p className="text-sm text-muted-foreground mt-2 max-w-xl leading-relaxed">
                  Provvypay analyzed your agreement and identified the participants, commercial terms,
                  obligations and settlement requirements.
                </p>
              </div>
              <p className="text-base font-medium text-foreground">{insight.agreementName}</p>
            </div>

            <div className="flex gap-6 shrink-0">
              <ScoreRing
                value={insight.agreementTypeConfidence}
                label="Confidence"
                sublabel="Agreement type"
              />
              <ScoreRing
                value={insight.readinessScore}
                label="Readiness"
                sublabel={insight.readinessScore >= 90 ? 'High readiness' : 'In progress'}
                variant="readiness"
              />
            </div>
          </div>

          <ReportSection title="Commercial Agreement Detected">
            <div className="surface-agreement-card px-4 py-4 flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-base">{insight.agreementType}</p>
                <p className="text-sm text-muted-foreground mt-1">{participantLabel}</p>
              </div>
              <Sparkles className="h-5 w-5 text-[rgb(124,92,255)] shrink-0" />
            </div>
          </ReportSection>

          <ReportSection title="Participants Identified">
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

          {insight.commercialTermsFound.length > 0 ? (
            <ReportSection title="Commercial Terms Identified">
              <ul className="grid gap-2 sm:grid-cols-2">
                {insight.commercialTermsFound.map((term) => (
                  <li
                    key={term}
                    className="flex items-center gap-2.5 rounded-lg border border-[rgba(124,92,255,0.1)] bg-white/80 px-3 py-2 text-sm"
                  >
                    <Check className="h-4 w-4 text-[rgb(124,92,255)] shrink-0" />
                    {term}
                  </li>
                ))}
              </ul>
            </ReportSection>
          ) : null}

          {insight.obligationsIdentified.length > 0 ? (
            <ReportSection title="Obligations Identified">
              <ul className="space-y-2">
                {insight.obligationsIdentified.map((obligation) => (
                  <li key={obligation} className="flex items-start gap-2.5 text-sm">
                    <Check className="h-4 w-4 text-[rgb(124,92,255)] shrink-0 mt-0.5" />
                    {obligation}
                  </li>
                ))}
              </ul>
            </ReportSection>
          ) : null}

          {insight.potentialGaps.length > 0 ? (
            <ReportSection title="Potential Gaps">
              <p className="text-xs text-muted-foreground">
                Missing information that may prevent settlement — not errors.
              </p>
              <ul className="space-y-2 mt-2">
                {insight.potentialGaps.map((gap) => (
                  <li
                    key={gap}
                    className="flex items-start gap-2.5 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-sm text-amber-950"
                  >
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    {gap}
                  </li>
                ))}
              </ul>
            </ReportSection>
          ) : null}

          <ReportSection title="Agreement Readiness Score">
            <div className="surface-settlement px-4 py-4">
              <p className="text-sm leading-relaxed">{insight.readinessExplanation}</p>
            </div>
          </ReportSection>
        </div>
      </div>

      {editableSection ? (
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
