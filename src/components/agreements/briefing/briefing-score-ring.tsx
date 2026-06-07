import { cn } from '@/lib/utils';

type BriefingScoreRingProps = {
  value: number;
  label: string;
  sublabel?: string;
  variant?: 'intelligence' | 'readiness';
  size?: 'md' | 'lg';
  className?: string;
};

export function BriefingScoreRing({
  value,
  label,
  sublabel,
  variant = 'intelligence',
  size = 'md',
  className,
}: BriefingScoreRingProps) {
  const radius = size === 'lg' ? 52 : 42;
  const dimension = size === 'lg' ? 'h-32 w-32' : 'h-24 w-24';
  const textSize = size === 'lg' ? 'text-2xl' : 'text-xl';
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const stroke = variant === 'readiness' ? '#1D6F42' : '#7C5CFF';
  const viewBox = size === 'lg' ? '0 0 120 120' : '0 0 100 100';
  const center = size === 'lg' ? 60 : 50;

  return (
    <div className={cn('flex flex-col items-center gap-2 text-center', className)}>
      <div className={cn('relative', dimension)}>
        <svg className={cn(dimension, '-rotate-90')} viewBox={viewBox} aria-hidden>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="rgba(124,92,255,0.12)"
            strokeWidth="8"
          />
          <circle
            cx={center}
            cy={center}
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
          <span className={cn('font-bold', textSize)}>{value}%</span>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        {sublabel ? <p className="text-[11px] text-muted-foreground mt-0.5">{sublabel}</p> : null}
      </div>
    </div>
  );
}
