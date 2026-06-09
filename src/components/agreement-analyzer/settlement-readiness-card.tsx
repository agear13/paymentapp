import { Progress } from '@/components/ui/progress';
import {
  readinessLabel,
  readinessTone,
} from '@/lib/agreement-analyzer/format-report-items';
import type { PublicAgreementReportJson } from '@/lib/agreement-analyzer/report-types';

type SettlementReadinessCardProps = {
  score: number;
  readiness: PublicAgreementReportJson['settlementReadiness'];
};

const toneClasses = {
  high: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  medium: 'text-amber-700 bg-amber-50 border-amber-200',
  low: 'text-rose-700 bg-rose-50 border-rose-200',
} as const;

export function SettlementReadinessCard({ score, readiness }: SettlementReadinessCardProps) {
  const tone = readinessTone(score);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Settlement readiness
          </p>
          <h2 className="text-2xl font-semibold text-slate-900">{readiness.summary}</h2>
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${toneClasses[tone]}`}
          >
            {readinessLabel(score)}
          </span>
        </div>

        <div className="min-w-[220px] space-y-2">
          <div className="flex items-end justify-between">
            <span className="text-4xl font-bold text-slate-900">{score}</span>
            <span className="pb-1 text-sm text-slate-500">out of 100</span>
          </div>
          <Progress value={score} className="h-3" />
        </div>
      </div>

      {readiness.factors.length > 0 ? (
        <ul className="mt-5 space-y-2 border-t border-slate-100 pt-5">
          {readiness.factors.map((factor) => (
            <li key={factor} className="flex gap-2 text-sm text-slate-700">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
              <span>{factor}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
