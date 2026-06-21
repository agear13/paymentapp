import { cn } from '@/lib/utils';

type MarketingEmptyStateProps = {
  message: string;
  className?: string;
};

export function MarketingEmptyState({ message, className }: MarketingEmptyStateProps) {
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
