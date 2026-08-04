'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  buildXeroGuidedSetupSteps,
  xeroHasPaymentRails,
  type XeroGuidedSetupContext,
} from '@/lib/xero/xero-guided-setup-config';
import type { MerchantPaymentRails } from '@/lib/xero/xero-setup-guidance';
import type { GuidedSetupStep } from '@/lib/commercial-os/guided-setup';

export type XeroHealthCheckItem = {
  id: string;
  label: string;
  ok: boolean;
  detail?: string;
};

export type XeroGuidedSetupState = {
  loading: boolean;
  steps: GuidedSetupStep[];
  healthChecks: XeroHealthCheckItem[];
  context: XeroGuidedSetupContext;
};

const DEFAULT_CONTEXT: XeroGuidedSetupContext = {
  merchantRails: {
    stripeEnabled: false,
    wiseEnabled: false,
    stablecoinSettlementsEnabled: false,
  },
  missingClearingCount: 0,
  pendingPaymentCount: 0,
  hasPaymentRails: false,
};

export function useXeroGuidedSetupState(
  organizationId: string,
  merchantRails: MerchantPaymentRails
): XeroGuidedSetupState & { refresh: () => void } {
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState<GuidedSetupStep[]>([]);
  const [healthChecks, setHealthChecks] = useState<XeroHealthCheckItem[]>([]);
  const [context, setContext] = useState<XeroGuidedSetupContext>({
    ...DEFAULT_CONTEXT,
    merchantRails,
    hasPaymentRails: xeroHasPaymentRails(merchantRails),
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, mappingsRes, queueRes, accountsRes] = await Promise.all([
        fetch(`/api/xero/status?organization_id=${encodeURIComponent(organizationId)}`, {
          cache: 'no-store',
        }),
        fetch(`/api/settings/xero-mappings?organization_id=${encodeURIComponent(organizationId)}`, {
          cache: 'no-store',
        }),
        fetch('/api/xero/queue/process-now', { cache: 'no-store' }),
        fetch(`/api/xero/accounts?organization_id=${encodeURIComponent(organizationId)}`, {
          cache: 'no-store',
        }),
      ]);

      const status = statusRes.ok
        ? ((await statusRes.json()) as {
            connected?: boolean;
            tenantId?: string;
            operatorMessage?: string;
          })
        : { connected: false };

      const mappingsPayload = mappingsRes.ok
        ? ((await mappingsRes.json()) as {
            data?: {
              xero_revenue_account_id?: string | null;
              xero_receivable_account_id?: string | null;
              xero_stripe_clearing_account_id?: string | null;
            } | null;
          })
        : { data: null };

      const queuePayload = queueRes.ok
        ? ((await queueRes.json()) as { pendingCount?: number })
        : { pendingCount: 0 };

      let missingClearingCount = 0;
      if (accountsRes.ok && status.connected) {
        const accountsBody = (await accountsRes.json()) as { data?: Array<{ name: string }> };
        const accountNames = new Set(
          (accountsBody.data ?? []).map((a) => a.name.toLowerCase())
        );
        if (merchantRails.stripeEnabled && !accountNames.has('stripe clearing')) {
          missingClearingCount += 1;
        }
        if (merchantRails.stablecoinSettlementsEnabled) {
          for (const name of ['hbar clearing', 'usdc clearing', 'usdt clearing', 'audd clearing']) {
            if (!accountNames.has(name)) missingClearingCount += 1;
          }
        }
      }

      const connected = Boolean(status.connected);
      const hasTenant = Boolean(status.tenantId?.trim());
      const revenueMapped = Boolean(mappingsPayload.data?.xero_revenue_account_id?.trim());
      const receivableMapped = Boolean(mappingsPayload.data?.xero_receivable_account_id?.trim());
      const stripeMapped = Boolean(mappingsPayload.data?.xero_stripe_clearing_account_id?.trim());
      const accountsLoaded = accountsRes.ok && connected;
      const mappingsConfigured = revenueMapped && receivableMapped;
      const pendingPaymentCount = queuePayload.pendingCount ?? 0;

      const ctx: XeroGuidedSetupContext = {
        merchantRails,
        missingClearingCount,
        pendingPaymentCount,
        hasPaymentRails: xeroHasPaymentRails(merchantRails),
      };

      setContext(ctx);
      setSteps(buildXeroGuidedSetupSteps(ctx));
      setHealthChecks([
        {
          id: 'connected',
          label: 'Connected',
          ok: connected,
          detail: connected ? undefined : status.operatorMessage ?? 'Connect Xero to continue.',
        },
        {
          id: 'organisation',
          label: 'Organisation selected',
          ok: connected && hasTenant,
          detail:
            connected && !hasTenant
              ? 'Select your Xero business organisation.'
              : undefined,
        },
        {
          id: 'accounts',
          label: 'Accounts loaded',
          ok: accountsLoaded,
          detail: accountsLoaded ? undefined : 'Could not load your Xero chart of accounts.',
        },
        {
          id: 'mapping',
          label: 'Mapping configured',
          ok: mappingsConfigured,
          detail: mappingsConfigured
            ? undefined
            : 'Revenue and Accounts Receivable mappings are required.',
        },
        {
          id: 'invoices',
          label: 'Ready to push invoices',
          ok: connected && mappingsConfigured,
          detail:
            connected && !mappingsConfigured
              ? 'Complete account mappings first.'
              : undefined,
        },
        {
          id: 'payments',
          label: 'Ready to push payments',
          ok: connected && mappingsConfigured && (!merchantRails.stripeEnabled || stripeMapped),
          detail:
            merchantRails.stripeEnabled && !stripeMapped
              ? 'Stripe clearing account mapping is recommended.'
              : undefined,
        },
      ]);
    } catch {
      setSteps(buildXeroGuidedSetupSteps({ ...DEFAULT_CONTEXT, merchantRails }));
      setHealthChecks([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId, merchantRails]);

  useEffect(() => {
    void load();
  }, [load]);

  return { loading, steps, healthChecks, context, refresh: load };
}
