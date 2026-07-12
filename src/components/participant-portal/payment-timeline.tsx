'use client';

import type { PortalPaymentTimelineItem } from '@/lib/participant-portal/participant-portal-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Props = {
  items: PortalPaymentTimelineItem[];
};

function statusBadge(status: PortalPaymentTimelineItem['status']): string {
  switch (status) {
    case 'complete':
      return 'Complete';
    case 'active':
      return 'In progress';
    case 'waiting':
      return 'Waiting';
    default:
      return 'Pending';
  }
}

export function PaymentTimeline({ items }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Payment Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Payment timing will become available once the organiser finalises settlement.
          </p>
        ) : (
          <ol className="space-y-4">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 border-l-2 border-muted pl-4 ml-1"
              >
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {item.dateLabel}
                  </p>
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.detail ? (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
                  ) : null}
                </div>
                <span
                  className={cn(
                    'text-xs font-medium shrink-0',
                    item.status === 'complete' && 'text-emerald-700',
                    item.status === 'active' && 'text-amber-700',
                    (item.status === 'pending' || item.status === 'waiting') && 'text-muted-foreground'
                  )}
                >
                  {statusBadge(item.status)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
