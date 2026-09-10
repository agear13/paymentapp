import { Badge } from '@/components/ui/badge';
import { payoutRailLabel } from '@/lib/payouts/payout-rail-presentation';
import { cn } from '@/lib/utils';

export function PayoutRailBadge({
  railId,
  className,
}: {
  railId?: string | null;
  className?: string;
}) {
  const label = payoutRailLabel(railId);
  const tone =
    railId === 'manual' || !railId
      ? 'outline'
      : railId === 'hedera'
        ? 'info'
        : railId === 'cregis'
          ? 'secondary'
          : 'outline';

  return (
    <Badge variant={tone} className={cn('font-normal', className)}>
      {label}
    </Badge>
  );
}
