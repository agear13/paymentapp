'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Circle } from 'lucide-react';
import {
  computeXeroSetupSteps,
  xeroSetupProgressPercent,
  XERO_SETUP_PROGRESS_COPY,
  type MerchantPaymentRails,
  type XeroSetupStep,
} from '@/lib/xero/xero-setup-guidance';
import { useCommercialReadinessOptional } from '@/hooks/use-commercial-readiness';
import {
  buildMappingFieldStates,
  chartAccountCodeSet,
  settlementAccountsNeedAction,
} from '@/lib/commercial-os/xero-invoice-readiness';
import type { XeroReadinessMappingsPayload } from '@/lib/commercial-os/xero-readiness';
import { normalizeMerchantPaymentRails } from '@/lib/commercial-os/merchant-payment-rails';

type XeroSetupProgressProps = {
  organizationId: string;
  variant?: 'default' | 'commercial';
  merchantRails?: MerchantPaymentRails;
};

type SetupData = {
  connected: boolean;
  tenantId?: string | null;
  revenueMapped: boolean;
  receivableMapped: boolean;
  paymentAccountsConfigured: boolean;
  pendingPaymentCount: number;
};

function stepsFromReadiness(
  readiness: NonNullable<ReturnType<typeof useCommercialReadinessOptional>>
): XeroSetupStep[] {
  return computeXeroSetupSteps({
    connected: readiness.connection.connected,
    tenantId: readiness.connection.tenantSelected ? 'selected' : null,
    revenueMapped:
      readiness.invoiceMappings.revenue.saved && readiness.invoiceMappings.revenue.validInChart,
    receivableMapped:
      readiness.invoiceMappings.receivable.saved &&
      readiness.invoiceMappings.receivable.validInChart,
    paymentAccountsConfigured: !readiness.settlementAccountsNeedAction,
    pendingPaymentCount: readiness.queue.pendingCount,
  });
}

export function XeroSetupProgress({
  organizationId,
  variant = 'default',
  merchantRails,
}: XeroSetupProgressProps) {
  const readiness = useCommercialReadinessOptional();
  const [fetchedSteps, setFetchedSteps] = useState<XeroSetupStep[]>([]);
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
        const fieldStates = buildMappingFieldStates(
          mappings,
          chartLoaded,
          chartCodes,
          rails
        );

        const data: SetupData = {
          connected: Boolean(status.connected),
          tenantId: status.tenantId,
          revenueMapped: fieldStates.xero_revenue_account_id === 'configured',
          receivableMapped: fieldStates.xero_receivable_account_id === 'configured',
          paymentAccountsConfigured: !settlementAccountsNeedAction(
            fieldStates,
            rails,
            mappings
          ),
          pendingPaymentCount: queuePayload.pendingCount ?? 0,
        };

        if (!cancelled) {
          setFetchedSteps(computeXeroSetupSteps(data));
        }
      } catch {
        if (!cancelled) {
          setFetchedSteps(
            computeXeroSetupSteps({
              connected: false,
              revenueMapped: false,
              receivableMapped: false,
              paymentAccountsConfigured: false,
              pendingPaymentCount: 0,
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

  const steps =
    readiness && !readiness.loading ? stepsFromReadiness(readiness) : fetchedSteps;
  const loading = readiness ? readiness.loading : fetchedLoading;
  const percent = xeroSetupProgressPercent(steps);
  const isCommercial = variant === 'commercial';

  if (loading) {
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            className={
              isCommercial
                ? 'text-[15px] font-semibold text-foreground'
                : 'text-sm font-semibold'
            }
          >
            {XERO_SETUP_PROGRESS_COPY.title}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {XERO_SETUP_PROGRESS_COPY.percentComplete(percent)}
          </p>
        </div>
        <div className="h-2 w-32 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-2.5 text-sm">
            {step.complete ? (
              <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden />
            )}
            <span className={step.complete ? 'text-foreground' : 'text-muted-foreground'}>
              {step.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
