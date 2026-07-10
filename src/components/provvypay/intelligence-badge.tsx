import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRODUCT_TERMINOLOGY } from '@/lib/product/product-terminology';

type IntelligenceBadgeProps = {
  label?: string;
  className?: string;
  pulse?: boolean;
};

export function IntelligenceBadge({
  label = PRODUCT_TERMINOLOGY.projectIntelligence,
  className,
  pulse = false,
}: IntelligenceBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-[rgba(124,92,255,0.25)] bg-[rgba(124,92,255,0.08)] px-3 py-1 text-xs font-semibold text-[rgb(124,92,255)]',
        pulse && 'animate-intelligence-pulse',
        className
      )}
    >
      <Sparkles className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
