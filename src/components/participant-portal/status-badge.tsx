'use client';

import { cn } from '@/lib/utils';
import type { PortalAgreementStatus } from '@/lib/participant-portal/participant-portal-data';

const STATUS_STYLES: Record<
  PortalAgreementStatus,
  { dot: string; badge: string }
> = {
  approved: {
    dot: 'bg-emerald-500',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  awaiting_acceptance: {
    dot: 'bg-amber-500',
    badge: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  not_sent: {
    dot: 'bg-blue-500',
    badge: 'border-blue-200 bg-blue-50 text-blue-800',
  },
  draft: {
    dot: 'bg-muted-foreground/40',
    badge: 'border-border bg-muted/50 text-muted-foreground',
  },
};

type Props = {
  label: string;
  status: PortalAgreementStatus;
  className?: string;
};

export function PortalStatusBadge({ label, status, className }: Props) {
  const styles = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium',
        styles.badge,
        className
      )}
    >
      <span className={cn('h-2 w-2 rounded-full shrink-0', styles.dot)} aria-hidden />
      {label}
    </span>
  );
}
