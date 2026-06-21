'use client';

import { cn } from '@/lib/utils';
import type { MarketingLoadingContext } from '@/lib/marketing-jobs/loading-copy';
import { getMarketingLoadingCopy } from '@/lib/marketing-jobs/loading-copy';

type MarketingContextualLoaderProps = {
  context: MarketingLoadingContext;
  className?: string;
};

export function MarketingContextualLoader({ context, className }: MarketingContextualLoaderProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground animate-in fade-in duration-300',
        className
      )}
      role="status"
      aria-live="polite"
    >
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/40 opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-primary" />
      </span>
      {getMarketingLoadingCopy(context)}
    </div>
  );
}
