import { Progress } from '@/components/ui/progress';
import type { AgreementSettlementRiskAssessment } from '@/lib/agreement-analyzer/extraction/extraction-types';

type SettlementRiskCardProps = {
  assessment: AgreementSettlementRiskAssessment;
};

const riskToneClasses = {
  LOW: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  MEDIUM: 'text-amber-700 bg-amber-50 border-amber-200',
  HIGH: 'text-rose-700 bg-rose-50 border-rose-200',
} as const;

export function SettlementRiskCard({ assessment }: SettlementRiskCardProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Settlement Risk Assessment
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${riskToneClasses[assessment.riskLevel]}`}
            >
              {assessment.riskLevel}
            </span>
            <span className="text-sm text-slate-600">
              {assessment.issueCount} issue{assessment.issueCount === 1 ? '' : 's'} identified
            </span>
          </div>
        </div>

        <div className="min-w-[220px] space-y-2">
          <div className="flex items-end justify-between">
            <span className="text-4xl font-bold text-slate-900">{assessment.riskScore}</span>
            <span className="pb-1 text-sm text-slate-500">risk score</span>
          </div>
          <Progress value={assessment.riskScore} className="h-3" />
        </div>
      </div>

      {assessment.issues.length > 0 ? (
        <div className="mt-6 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Issues</h3>
          <ul className="space-y-2">
            {assessment.issues.map((issue) => (
              <li key={issue} className="flex gap-3 text-sm text-slate-700">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-6 text-sm text-slate-600">No specific settlement risk issues were flagged.</p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-sm font-medium text-slate-900">Potential Impact</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            {assessment.potentialImpact}
          </p>
        </div>
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-4">
          <p className="text-sm font-medium text-slate-900">Recommendation</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            {assessment.recommendation}
          </p>
        </div>
      </div>
    </section>
  );
}
