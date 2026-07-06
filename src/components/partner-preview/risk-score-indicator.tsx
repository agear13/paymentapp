import { cn } from '@/lib/utils';
import type { RiskLabel } from '@/lib/data/mock-partner-preview';

interface RiskScoreIndicatorProps {
  score: number;
  label: RiskLabel;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

function getRiskColors(label: RiskLabel) {
  switch (label) {
    case 'Healthy':
      return { stroke: 'stroke-green-500', text: 'text-green-600', bg: 'text-green-600' };
    case 'Attention':
      return { stroke: 'stroke-amber-500', text: 'text-amber-600', bg: 'text-amber-600' };
    case 'High Risk':
      return { stroke: 'stroke-red-500', text: 'text-red-600', bg: 'text-red-600' };
  }
}

export function RiskScoreIndicator({
  score,
  label,
  size = 'md',
  showLabel = true,
}: RiskScoreIndicatorProps) {
  const colors = getRiskColors(label);
  const dim = size === 'sm' ? 40 : 52;
  const r = 15.9;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex items-center gap-2">
      <div className="relative" style={{ width: dim, height: dim }}>
        <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
          <circle
            cx="18"
            cy="18"
            r={r}
            fill="none"
            className="stroke-muted"
            strokeWidth="3"
          />
          <circle
            cx="18"
            cy="18"
            r={r}
            fill="none"
            className={cn(colors.stroke, 'transition-all duration-700')}
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center font-bold',
            colors.text,
            size === 'sm' ? 'text-[10px]' : 'text-xs'
          )}
        >
          {score}
        </span>
      </div>
      {showLabel && (
        <span className={cn('text-xs font-medium', colors.bg)}>{label}</span>
      )}
    </div>
  );
}
