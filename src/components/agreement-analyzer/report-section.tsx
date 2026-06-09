import { formatReportItem } from '@/lib/agreement-analyzer/format-report-items';

type ReportSectionProps = {
  title: string;
  description?: string;
  items: unknown[];
  emptyMessage: string;
  variant?: 'default' | 'risk' | 'missing';
};

export function ReportSection({
  title,
  description,
  items,
  emptyMessage,
  variant = 'default',
}: ReportSectionProps) {
  const formatted = items.map(formatReportItem).filter(Boolean);
  const borderClass =
    variant === 'risk'
      ? 'border-amber-200 bg-amber-50/50'
      : variant === 'missing'
        ? 'border-slate-200 bg-slate-50'
        : 'border-slate-200 bg-white';

  return (
    <section className={`rounded-xl border p-5 shadow-sm ${borderClass}`}>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>

      {formatted.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      ) : (
        <ul className="space-y-3">
          {formatted.map((item, index) => (
            <li
              key={`${title}-${index}`}
              className="rounded-lg border border-slate-100 bg-white/80 px-4 py-3 text-sm leading-relaxed text-slate-800"
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
