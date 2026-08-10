'use client';

import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCommercialReadiness } from '@/hooks/use-commercial-readiness';

type XeroSetupStatusCardProps = {
  variant?: 'default' | 'commercial';
};

function StatusRow({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 text-sm font-medium text-right">
        {ok === true ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
        ) : ok === false ? (
          <XCircle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
        ) : null}
        {value}
      </span>
    </div>
  );
}

/** Single setup summary — answers connection, invoices, next steps, optional, and historical sync. */
export function XeroSetupStatusCard({ variant = 'commercial' }: XeroSetupStatusCardProps) {
  const readiness = useCommercialReadiness();
  const isCommercial = variant === 'commercial';

  const connected = readiness.connection.connected;
  const canSyncToAccounting = readiness.canSyncToAccounting ?? readiness.canCreateInvoice;

  const optionalItems = readiness.recommendations.filter(
    (item) =>
      !item.includes('past payment') &&
      !item.includes('will sync automatically') &&
      !item.includes('did not sync')
  );

  let historicalSyncLine: string;
  if (readiness.queue.pendingCount > 0) {
    historicalSyncLine = `${readiness.queue.pendingCount} past payment${
      readiness.queue.pendingCount === 1 ? '' : 's'
    } waiting to sync — Provvy will send them automatically.`;
  } else if (readiness.queue.hasRecentFailures) {
    historicalSyncLine =
      'Some past payments did not sync. New invoices are not affected — see Past payments below.';
  } else {
    historicalSyncLine = 'No past payments waiting. New invoices and payments sync automatically.';
  }

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
          <h2 className="text-base font-semibold">Your Xero setup</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {readiness.loading
              ? 'Checking your setup…'
              : canSyncToAccounting
                ? 'Accounting sync is ready — invoices you push will sync automatically.'
                : 'Complete the steps below to enable accounting sync.'}
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

      {readiness.loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="mt-4 divide-y rounded-lg border bg-muted/20 px-4">
          <StatusRow
            label="Xero connection"
            value={connected ? 'Connected' : 'Not connected'}
            ok={connected}
          />
          <StatusRow
            label="Push invoices to accounting"
            value={canSyncToAccounting ? 'Ready' : 'Not yet'}
            ok={canSyncToAccounting}
          />
          <StatusRow label="Past payments to Xero" value={historicalSyncLine} />
        </div>
      )}

      {!readiness.loading && readiness.blockers.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            What to do next
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

      {!readiness.loading && optionalItems.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Optional
          </p>
          <ul className="mt-2 space-y-2">
            {optionalItems.map((item) => (
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

      {!readiness.loading &&
      readiness.blockers.length === 0 &&
      optionalItems.length === 0 &&
      canSyncToAccounting ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Accounting sync is ready. Invoices and payments will sync when you push or receive payment.
        </p>
      ) : null}
    </div>
  );
}
