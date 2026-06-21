import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MarketingEmptyStateContent } from '@/lib/marketing-labs/empty-states';

type MarketingEmptyStateProps = {
  content: MarketingEmptyStateContent;
  onCta?: () => void;
  ctaHref?: string;
  className?: string;
};

export function MarketingEmptyState({ content, onCta, ctaHref, className }: MarketingEmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-start rounded-xl border border-dashed bg-muted/20 px-6 py-10 animate-in fade-in duration-300',
        className
      )}
    >
      <h3 className="text-base font-semibold tracking-tight">{content.title}</h3>
      <p className="mt-2 max-w-lg text-sm text-muted-foreground">{content.description}</p>
      <p className="mt-4 max-w-lg text-sm text-foreground/80">
        <span className="font-medium">Why it matters: </span>
        {content.whyItMatters}
      </p>
      <p className="mt-3 max-w-lg text-sm text-primary/90">{content.nextStep}</p>
      {content.ctaLabel && (onCta || ctaHref) ? (
        ctaHref ? (
          <Button variant="outline" size="sm" className="mt-5" asChild>
            <a href={ctaHref}>
              {content.ctaLabel}
              <ArrowRight className="ml-2 size-3.5" />
            </a>
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="mt-5" onClick={onCta}>
            {content.ctaLabel}
            <ArrowRight className="ml-2 size-3.5" />
          </Button>
        )
      ) : null}
    </div>
  );
}

/** @deprecated Pass `content` from MARKETING_EMPTY_STATES instead. */
export function MarketingEmptyStateLegacy({ message, className }: { message: string; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center',
        className
      )}
    >
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
