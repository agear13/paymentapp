import { Badge } from '@/components/ui/badge';
import { presentPayoutStatus } from '@/lib/payouts/payout-status-presentation';
import { cn } from '@/lib/utils';

const TONE_VARIANT = {
  draft: 'outline',
  submitted: 'secondary',
  processing: 'warning',
  paid: 'success',
  failed: 'destructive',
} as const;

export function PayoutStatusBadge({
  status,
  railId,
  failedReason,
  className,
}: {
  status?: string | null;
  railId?: string | null;
  failedReason?: string | null;
  className?: string;
}) {
  const presented = presentPayoutStatus({ status, railId, failedReason });

  return (
    <Badge variant={TONE_VARIANT[presented.tone]} className={cn('font-normal', className)}>
      {presented.label}
    </Badge>
  );
}
