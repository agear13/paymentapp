import { ProvvyOrb } from '@/components/jarvis/provvy-orb';

export function AssessmentProvvyIdentity({
  supportingLine,
  className = '',
}: {
  supportingLine?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-start gap-3 ${className}`.trim()}>
      <ProvvyOrb state="idle" size="xs" className="landing-advisor-orb mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
          PROVVY
        </p>
        {supportingLine ? (
          <p className="mt-0.5 text-[12px] leading-snug text-ink-soft">{supportingLine}</p>
        ) : null}
      </div>
    </div>
  );
}
