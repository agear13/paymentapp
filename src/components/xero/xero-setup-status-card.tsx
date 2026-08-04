'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCommercialReadiness } from '@/hooks/use-commercial-readiness';

type XeroSetupStatusCardProps = {
  variant?: 'default' | 'commercial';
};

export function XeroSetupStatusCard({ variant = 'commercial' }: XeroSetupStatusCardProps) {
  const readiness = useCommercialReadiness();
  const isCommercial = variant === 'commercial';

  return (
    <div
      className={
        isCommercial
          ? 'rounded-2xl border border-border bg-card p-5 shadow-card'
          : 'rounded-lg border bg-card p-5'
      }
      id="guided-xero-health-check"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Setup status</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {readiness.loading
              ? 'Checking your Xero setup…'
              : readiness.statusDetail}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void readiness.refresh()}
          disabled={readiness.loading}
          className={isCommercial ? 'rounded-xl' : undefined}
        >
          {readiness.loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Refresh
        </Button>
      </div>

      <div className="mt-4 rounded-lg bg-muted/40 px-3 py-2">
        <p className="text-xs text-muted-foreground">Current status</p>
        <p className="text-sm font-semibold">{readiness.statusLabel}</p>
      </div>

      {readiness.loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="mt-4 space-y-4">
          {readiness.blockers.length > 0 ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                To do
              </p>
              <ul className="mt-2 space-y-2">
                {readiness.blockers.map((item) => (
                  <li
                    key={item}
                    className="rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {readiness.recommendations.length > 0 ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Optional
              </p>
              <ul className="mt-2 space-y-2">
                {readiness.recommendations.map((item) => (
                  <li
                    key={item}
                    className="rounded-lg border border-border/60 px-3 py-2 text-sm text-muted-foreground"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {readiness.blockers.length === 0 && readiness.recommendations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing else required — you can create invoices in Provvy.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
