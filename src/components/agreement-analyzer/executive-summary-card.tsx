import type { AgreementExecutiveSummary } from '@/lib/agreement-analyzer/extraction/extraction-types';

type ExecutiveSummaryCardProps = {
  summary: AgreementExecutiveSummary;
};

export function ExecutiveSummaryCard({ summary }: ExecutiveSummaryCardProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-50 shadow-sm">
      <div className="border-b border-slate-200 bg-white/80 px-6 py-4">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Executive Summary
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          {summary.headline}
        </h2>
      </div>

      <div className="space-y-6 px-6 py-6">
        <p className="text-base leading-relaxed text-slate-700">{summary.summary}</p>

        {summary.keyFindings.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Key Findings
            </h3>
            <ul className="space-y-2">
              {summary.keyFindings.map((finding) => (
                <li key={finding} className="flex gap-3 text-sm text-slate-700">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-900" />
                  <span>{finding}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4">
          <h3 className="text-sm font-semibold text-amber-900">Operational Impact</h3>
          <p className="mt-2 text-sm leading-relaxed text-amber-950">
            {summary.operationalImpact}
          </p>
        </div>
      </div>
    </section>
  );
}
