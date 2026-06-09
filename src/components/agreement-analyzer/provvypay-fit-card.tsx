import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { AgreementProvvypayFit } from '@/lib/agreement-analyzer/extraction/extraction-types';
import { readinessLabel } from '@/lib/agreement-analyzer/format-report-items';

type ProvvypayFitCardProps = {
  fit: AgreementProvvypayFit;
};

const bandToneClasses = {
  high: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  medium: 'text-amber-700 bg-amber-50 border-amber-200',
  low: 'text-rose-700 bg-rose-50 border-rose-200',
} as const;

function priorityBandTone(band: AgreementProvvypayFit['priorityBand']): keyof typeof bandToneClasses {
  if (band === 'IDEAL_ICP' || band === 'HIGH') return 'high';
  if (band === 'MEDIUM') return 'medium';
  return 'low';
}

export function ProvvypayFitCard({ fit }: ProvvypayFitCardProps) {
  const tone = priorityBandTone(fit.priorityBand);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Provvypay Fit
          </p>
          <h2 className="text-2xl font-semibold text-slate-900">{fit.headline}</h2>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-700">{fit.summary}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{fit.recommendedUseCase}</Badge>
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${bandToneClasses[tone]}`}
            >
              {fit.fitLabel}
            </span>
          </div>
        </div>

        <div className="min-w-[220px] space-y-2">
          <div className="flex items-end justify-between">
            <span className="text-4xl font-bold text-slate-900">{fit.fitScore}</span>
            <span className="pb-1 text-sm text-slate-500">Provvypay Fit Score</span>
          </div>
          <Progress value={fit.fitScore} className="h-3" />
          <p className="text-sm text-slate-600">{readinessLabel(fit.fitScore)}</p>
          <p className="text-xs text-slate-500">
            Settlement complexity: {fit.settlementComplexityScore}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Why this fits
          </h3>
          <ul className="space-y-2">
            {fit.strengths.map((strength) => (
              <li key={strength} className="flex gap-3 text-sm text-slate-700">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span>{strength}</span>
              </li>
            ))}
          </ul>
        </div>

        {fit.considerations && fit.considerations.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Considerations
            </h3>
            <ul className="space-y-2">
              {fit.considerations.map((consideration) => (
                <li key={consideration} className="flex gap-3 text-sm text-slate-700">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  <span>{consideration}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="mt-6 rounded-lg border border-primary/20 bg-primary/5 px-4 py-4">
        <p className="text-sm font-medium text-slate-900">Recommended Provvypay workflow</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">
          Start with <span className="font-medium">{fit.recommendedUseCase}</span> to automate
          allocation, reconciliation, and payout coordination for agreements with this structure.
        </p>
      </div>
    </section>
  );
}
