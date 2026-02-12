'use client';

import { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';

interface Attribution {
  id: string;
  created_at: string;
  landing_path: string | null;
  user_agent: string | null;
}

interface AnalyticsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  advocateId: string;
  advocateName: string;
  clicks: number;
  conversions: number;
}

export function AnalyticsDrawer({
  open,
  onOpenChange,
  advocateId,
  advocateName,
  clicks,
  conversions,
}: AnalyticsDrawerProps) {
  const [attributions, setAttributions] = useState<Attribution[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !advocateId) return;
    setLoading(true);
    fetch(`/api/referrals/advocates/${advocateId}/analytics`)
      .then((r) => r.json())
      .then((data) => {
        if (data.attributions) {
          setAttributions(data.attributions);
        }
      })
      .catch(() => setAttributions([]))
      .finally(() => setLoading(false));
  }, [open, advocateId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Analytics: {advocateName}</SheetTitle>
          <SheetDescription>
            {clicks} clicks, {conversions} conversions so far. Last 10 attributions:
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : attributions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No attributions yet.</p>
          ) : (
            <div className="space-y-2">
              {attributions.map((a) => (
                <div
                  key={a.id}
                  className="rounded border p-2 text-sm"
                >
                  <div className="font-medium">
                    {new Date(a.created_at).toLocaleString()}
                  </div>
                  <div className="text-muted-foreground truncate">
                    {a.landing_path || '/'}
                  </div>
                  {a.user_agent && (
                    <div className="text-xs text-muted-foreground truncate mt-1">
                      {a.user_agent.slice(0, 80)}...
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
