'use client';

import * as React from 'react';
import {
  computeXeroReadiness,
  EMPTY_XERO_READINESS,
  type XeroReadinessInput,
  type XeroReadinessMappingsPayload,
  type XeroReadinessResult,
} from '@/lib/commercial-os/xero-readiness';
import {
  computePaymentLinkRailSetup,
  toPaymentLinkRailSnapshot,
} from '@/lib/payment-links/setup-status';
import type { MerchantPaymentRails } from '@/lib/xero/xero-setup-guidance';
import {
  buildMerchantPaymentRailsFromSetup,
} from '@/lib/commercial-os/merchant-payment-rails';
import { fetchMerchantDedicatedRailDefaults } from '@/lib/payment-links/merchant-dedicated-rail-defaults';

type MerchantSettingsRow = {
  stripe_account_id?: string | null;
  hedera_account_id?: string | null;
  wise_enabled?: boolean | null;
  wise_profile_id?: string | null;
  evm_wallet_enabled?: boolean | null;
  evm_wallet_address?: string | null;
  evm_supported_networks?: string[] | null;
  evm_supported_tokens?: string[] | null;
  _features?: {
    wiseGloballyEnabled?: boolean;
    evmGloballyEnabled?: boolean;
  };
};

function merchantRailsFromSettings(
  settings: MerchantSettingsRow | null,
  dedicatedDefaults?: { manualBank: unknown | null; crypto: unknown | null } | null
): MerchantPaymentRails {
  if (!settings) {
    return buildMerchantPaymentRailsFromSetup(
      computePaymentLinkRailSetup(null, {
        wisePayments: false,
        evmWalletPayments: false,
      }),
      dedicatedDefaults
    );
  }

  const snapshot = toPaymentLinkRailSnapshot({
    stripeAccountId: settings.stripe_account_id,
    hederaAccountId: settings.hedera_account_id,
    wiseEnabled: settings.wise_enabled ?? false,
    wiseProfileId: settings.wise_profile_id,
    evmWalletEnabled: settings.evm_wallet_enabled,
    evmWalletAddress: settings.evm_wallet_address,
    evmSupportedNetworks: settings.evm_supported_networks,
    evmSupportedTokens: settings.evm_supported_tokens,
  });

  const railSetup = computePaymentLinkRailSetup(snapshot, {
    wisePayments: settings._features?.wiseGloballyEnabled ?? false,
    evmWalletPayments: settings._features?.evmGloballyEnabled ?? false,
  });

  return buildMerchantPaymentRailsFromSetup(railSetup, dedicatedDefaults);
}

type CommercialReadinessContextValue = XeroReadinessResult & {
  refresh: () => Promise<void>;
  organizationId: string | null;
};

const CommercialReadinessContext = React.createContext<CommercialReadinessContextValue | null>(
  null
);

type CommercialReadinessProviderProps = {
  organizationId: string | null;
  children: React.ReactNode;
};

async function fetchCommercialReadiness(
  organizationId: string
): Promise<Omit<XeroReadinessResult, 'loading'>> {
  const [merchantRes, statusRes, mappingsRes, accountsRes, queueRes, dedicatedDefaultsRes] =
    await Promise.all([
    fetch(`/api/merchant-settings?organizationId=${encodeURIComponent(organizationId)}`, {
      cache: 'no-store',
    }),
    fetch(`/api/xero/status?organization_id=${encodeURIComponent(organizationId)}`, {
      cache: 'no-store',
    }),
    fetch(`/api/settings/xero-mappings?organization_id=${encodeURIComponent(organizationId)}`, {
      cache: 'no-store',
    }),
    fetch(`/api/xero/accounts?organization_id=${encodeURIComponent(organizationId)}`, {
      cache: 'no-store',
    }),
    fetch(`/api/xero/sync/stats?organization_id=${encodeURIComponent(organizationId)}`, {
      cache: 'no-store',
    }),
    fetchMerchantDedicatedRailDefaults(organizationId).catch(() => ({
      manualBank: null,
      crypto: null,
    })),
  ]);

  const merchantRows = merchantRes.ok ? ((await merchantRes.json()) as MerchantSettingsRow[]) : [];
  const merchantRails = merchantRailsFromSettings(merchantRows[0] ?? null, dedicatedDefaultsRes);

  const status = statusRes.ok
    ? ((await statusRes.json()) as {
        connected?: boolean;
        tenantId?: string | null;
        connectedAt?: string | null;
        operatorMessage?: string | null;
      })
    : { connected: false };

  const mappingsPayload = mappingsRes.ok
    ? ((await mappingsRes.json()) as { data?: XeroReadinessMappingsPayload | null })
    : { data: null };

  let chartAccountCodes: Set<string> | null = null;
  let chartLoaded = false;
  if (accountsRes.ok && status.connected) {
    const accountsBody = (await accountsRes.json()) as { data?: Array<{ code: string }> };
    chartAccountCodes = new Set(
      (accountsBody.data ?? []).map((account) => account.code).filter(Boolean)
    );
    chartLoaded = true;
  }

  let pendingCount = 0;
  let hasRecentFailures = false;
  let recentSyncs: XeroReadinessInput['queue']['recentSyncs'] = [];
  if (queueRes.ok) {
    const queueBody = (await queueRes.json()) as {
      pendingCount?: number;
      recentSyncs?: XeroReadinessInput['queue']['recentSyncs'];
    };
    pendingCount = queueBody.pendingCount ?? 0;
    recentSyncs = queueBody.recentSyncs ?? [];
    hasRecentFailures = recentSyncs.some((sync) => sync.status === 'FAILED');
  }

  return computeXeroReadiness({
    status,
    mappings: mappingsPayload.data ?? null,
    chartAccountCodes,
    chartLoaded,
    queue: { pendingCount, hasRecentFailures, recentSyncs },
    merchantRails,
  });
}

export function CommercialReadinessProvider({
  organizationId,
  children,
}: CommercialReadinessProviderProps) {
  const [loading, setLoading] = React.useState(true);
  const [readiness, setReadiness] = React.useState<Omit<XeroReadinessResult, 'loading'>>(
    EMPTY_XERO_READINESS
  );
  const loadGenerationRef = React.useRef(0);

  const load = React.useCallback(async () => {
    const generation = ++loadGenerationRef.current;

    if (!organizationId) {
      setReadiness(EMPTY_XERO_READINESS);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await fetchCommercialReadiness(organizationId);
      if (generation !== loadGenerationRef.current) return;
      setReadiness(result);
    } catch {
      if (generation !== loadGenerationRef.current) return;
      setReadiness(EMPTY_XERO_READINESS);
    } finally {
      if (generation === loadGenerationRef.current) {
        setLoading(false);
      }
    }
  }, [organizationId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const value = React.useMemo<CommercialReadinessContextValue>(
    () => ({
      ...readiness,
      loading,
      refresh: load,
      organizationId,
    }),
    [readiness, loading, load, organizationId]
  );

  return (
    <CommercialReadinessContext.Provider value={value}>{children}</CommercialReadinessContext.Provider>
  );
}

export function useCommercialReadiness(): CommercialReadinessContextValue {
  const context = React.useContext(CommercialReadinessContext);
  if (!context) {
    throw new Error('useCommercialReadiness must be used within CommercialReadinessProvider');
  }
  return context;
}

/** Returns null only outside Commercial OS workspace (no provider ancestor). */
export function useCommercialReadinessOptional(): CommercialReadinessContextValue | null {
  return React.useContext(CommercialReadinessContext);
}
