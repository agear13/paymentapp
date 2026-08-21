'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Circle } from 'lucide-react';
import { XERO_SETUP_PROGRESS_COPY, type MerchantPaymentRails } from '@/lib/xero/xero-setup-guidance';
import { useCommercialReadinessOptional } from '@/hooks/use-commercial-readiness';
import {
  chartAccountCodeSet,
} from '@/lib/commercial-os/xero-invoice-readiness';
import {
  computeXeroReadiness,
  type XeroReadinessMappingsPayload,
} from '@/lib/commercial-os/xero-readiness';
import {
  computeXeroSetupOverview,
  computeXeroSetupOverviewFromReadiness,
  type XeroSetupOverview,
} from '@/lib/commercial-os/xero-setup-overview';
import { normalizeMerchantPaymentRails } from '@/lib/commercial-os/merchant-payment-rails';

type XeroSetupProgressProps = {
  organizationId: string;
  variant?: 'default' | 'commercial';
  merchantRails?: MerchantPaymentRails;
};

function SetupCheckRow({ complete, label }: { complete: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2.5 text-sm">
      {complete ? (
        <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
      ) : (
        <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden />
      )}
      <span className={complete ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    </li>
  );
}

export function XeroSetupProgress({
  organizationId,
  variant = 'default',
  merchantRails,
}: XeroSetupProgressProps) {
  const readiness = useCommercialReadinessOptional();
  const [fetchedOverview, setFetchedOverview] = useState<XeroSetupOverview | null>(null);
  const [fetchedLoading, setFetchedLoading] = useState(true);

  const rails = useMemo(
    () =>
      normalizeMerchantPaymentRails(
        merchantRails ?? {
          stripeEnabled: true,
          wiseEnabled: false,
          stablecoinSettlementsEnabled: false,
          manualBankEnabled: false,
        }
      ),
    [merchantRails]
  );

  useEffect(() => {
    if (readiness && !readiness.loading) {
      return;
    }
    if (readiness?.loading) {
      return;
    }

    let cancelled = false;

    async function load() {
      setFetchedLoading(true);
      try {
        const [statusRes, mappingsRes, queueRes, accountsRes] = await Promise.all([
          fetch(`/api/xero/status?organization_id=${encodeURIComponent(organizationId)}`, {
            cache: 'no-store',
          }),
          fetch(`/api/settings/xero-mappings?organization_id=${encodeURIComponent(organizationId)}`, {
            cache: 'no-store',
          }),
          fetch(`/api/xero/sync/stats?organization_id=${encodeURIComponent(organizationId)}`, {
            cache: 'no-store',
          }),
          fetch(`/api/xero/accounts?organization_id=${encodeURIComponent(organizationId)}`, {
            cache: 'no-store',
          }),
        ]);

        const status = statusRes.ok
          ? ((await statusRes.json()) as { connected?: boolean; tenantId?: string })
          : { connected: false };
        const mappingsPayload = mappingsRes.ok
          ? ((await mappingsRes.json()) as { data?: XeroReadinessMappingsPayload | null })
          : { data: null };
        const queuePayload = queueRes.ok
          ? ((await queueRes.json()) as { pendingCount?: number })
          : { pendingCount: 0 };
        const accountsPayload = accountsRes.ok
          ? ((await accountsRes.json()) as {
              data?: Array<{ code?: string | null; status?: string | null }>;
            })
          : { data: [] };

        const mappings = mappingsPayload.data ?? null;
        const chartLoaded = Boolean(status.connected) && accountsRes.ok;
        const chartCodes = chartAccountCodeSet(accountsPayload.data ?? []);
        const computed = computeXeroReadiness({
          status,
          mappings,
          chartAccountCodes: chartCodes,
          chartLoaded,
          queue: {
            pendingCount: queuePayload.pendingCount ?? 0,
            hasRecentFailures: false,
          },
          merchantRails: rails,
        });

        if (!cancelled) {
          setFetchedOverview(computeXeroSetupOverviewFromReadiness(computed));
        }
      } catch {
        if (!cancelled) {
          setFetchedOverview(
            computeXeroSetupOverview({
              connected: false,
              tenantSelected: false,
              invoiceReady: false,
              invoiceAccountsConfigured: false,
              fieldStates: {},
              mappings: null,
              merchantRails: rails,
              pendingCount: 0,
              hasRecentFailures: false,
            })
          );
        }
      } finally {
        if (!cancelled) setFetchedLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [organizationId, rails, readiness, readiness?.loading]);

  const overview =
    readiness && !readiness.loading
      ? computeXeroSetupOverviewFromReadiness(readiness)
      : fetchedOverview;
  const loading = readiness ? readiness.loading : fetchedLoading;
  const isCommercial = variant === 'commercial';

  if (loading || !overview) {
    return (
      <div
        className={
          isCommercial
            ? 'rounded-2xl border border-border bg-card p-5 shadow-card'
            : 'rounded-lg border bg-card p-4'
        }
      >
        <p className="text-sm text-muted-foreground">{XERO_SETUP_PROGRESS_COPY.loading}</p>
      </div>
    );
  }

  return (
    <div
      className={
        isCommercial
          ? 'rounded-2xl border border-border bg-card p-5 shadow-card'
          : 'rounded-lg border bg-card p-5'
      }
    >
      <div className="space-y-1">
        <p className="text-sm">
          <span className="text-muted-foreground">{XERO_SETUP_PROGRESS_COPY.invoiceReadiness}: </span>
          <span className="font-medium text-foreground">{overview.invoiceReadinessLabel}</span>
        </p>
        <p className="text-sm">
          <span className="text-muted-foreground">{XERO_SETUP_PROGRESS_COPY.paymentSection}: </span>
          <span className="font-medium text-foreground">{overview.payment.statusLabel}</span>
        </p>
        <p className="text-sm">
          <span className="text-muted-foreground">{XERO_SETUP_PROGRESS_COPY.historicalSection}: </span>
          <span className="font-medium text-foreground">{overview.historical.label}</span>
        </p>
        <p className="pt-1 text-xs text-muted-foreground">
          {overview.invoiceReady
            ? XERO_SETUP_PROGRESS_COPY.invoiceReadyHint
            : XERO_SETUP_PROGRESS_COPY.invoiceNotReadyHint}
        </p>
      </div>

      <div className="mt-5">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {XERO_SETUP_PROGRESS_COPY.invoiceSection}
        </h3>
        <ul className="mt-2 space-y-2">
          {overview.invoiceSteps.map((step) => (
            <SetupCheckRow key={step.id} complete={step.complete} label={step.label} />
          ))}
        </ul>
      </div>

      {overview.payment.totalCount > 0 ? (
        <div className="mt-5">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {XERO_SETUP_PROGRESS_COPY.paymentSection}
          </h3>
          <p className="mt-2 text-sm font-medium text-foreground">{overview.payment.summary}</p>
          <ul className="mt-2 space-y-2">
            {overview.payment.holdings
              .filter((holding) => holding.configured)
              .map((holding) => (
                <SetupCheckRow key={holding.id} complete label={holding.label} />
              ))}
          </ul>
          {overview.payment.unresolvedSummary ? (
            <p className="mt-2 text-sm text-muted-foreground">{overview.payment.unresolvedSummary}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {XERO_SETUP_PROGRESS_COPY.historicalSection}
        </h3>
        <p className="mt-2 text-sm text-foreground">{overview.historical.label}</p>
      </div>
    </div>
  );
}
