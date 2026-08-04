'use client';

type CommercialOsNextStepBannerProps = {
  title?: string;
  message: React.ReactNode;
  action?: React.ReactNode;
  tone?: 'default' | 'success' | 'info';
};

const TONE_CLS: Record<NonNullable<CommercialOsNextStepBannerProps['tone']>, string> = {
  default: 'border-primary/20 bg-accent',
  success: 'border-emerald-500/25 bg-emerald-500/[0.06]',
  info: 'border-border bg-card',
};

export function CommercialOsNextStepBanner({
  title = 'Next step',
  message,
  action,
  tone = 'default',
}: CommercialOsNextStepBannerProps) {
  return (
    <section className={`rounded-2xl border p-5 shadow-card ${TONE_CLS[tone]}`}>
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">{title}</div>
      <div className="mt-2 text-[14px] leading-relaxed text-foreground">{message}</div>
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}
