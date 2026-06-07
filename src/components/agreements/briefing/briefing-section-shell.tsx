import { cn } from '@/lib/utils';

type BriefingSectionShellProps = {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'intelligence' | 'settlement' | 'activity';
  children: React.ReactNode;
  className?: string;
};

const variantClass = {
  default: 'surface-agreement-card',
  intelligence: 'surface-intelligence',
  settlement: 'surface-settlement',
  activity: 'rounded-xl border border-border/50 bg-muted/20',
};

export function BriefingSectionShell({
  id,
  title,
  description,
  variant = 'default',
  children,
  className,
}: BriefingSectionShellProps) {
  return (
    <section
      id={id}
      className={cn('scroll-mt-28 p-6 sm:p-8 space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500', variantClass[variant], className)}
    >
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgb(124,92,255)]">
          {title}
        </p>
        {description ? (
          <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
