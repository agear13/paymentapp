'use client';

import { useEffect, useMemo, useState } from 'react';
import { useWorkspaceActivation } from '@/hooks/use-workspace-activation';
import { useCommercialReadinessOptional } from '@/hooks/use-commercial-readiness';
import { useOrganization } from '@/hooks/use-organization';
import {
  buildPaymentsSetupReadiness,
  type PaymentsSetupReadiness,
} from '@/lib/commercial-os/payments-settlement-readiness';
import {
  computePaymentLinkRailSetup,
  toPaymentLinkRailSnapshot,
} from '@/lib/payment-links/setup-status';
import {
  fetchMerchantDedicatedRailDefaults,
  isManualBankDefaultsComplete,
} from '@/lib/payment-links/merchant-dedicated-rail-defaults';

type MerchantSettingsRow = {
  display_name?: string | null;
  stripe_account_id?: string | null;
  hedera_account_id?: string | null;
  wise_enabled?: boolean | null;
  wise_profile_id?: string | null;
  evm_wallet_enabled?: boolean | null;
  evm_wallet_address?: string | null;
  evm_supported_networks?: string[] | null;
  _features?: {
    wiseGloballyEnabled?: boolean;
    evmGloballyEnabled?: boolean;
    wiseAutoSettlementAvailable?: boolean;
  };
};

export function usePaymentsSettlementReadiness(): {
  loading: boolean;
  merchantRow: MerchantSettingsRow | null;
  railSetup: ReturnType<typeof computePaymentLinkRailSetup> | null;
  readiness: PaymentsSetupReadiness;
  manualBankConfigured: boolean;
  refreshKey: number;
  refresh: () => void;
} {
  const { activation, loading: activationLoading } = useWorkspaceActivation();
  const commercialReadiness = useCommercialReadinessOptional();
  const { organizationId } = useOrganization();
  const [merchantRow, setMerchantRow] = useState<MerchantSettingsRow | null>(null);
  const [manualBankConfigured, setManualBankConfigured] = useState(false);
  const [merchantLoading, setMerchantLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    if (!organizationId) {
      setMerchantRow(null);
      setManualBankConfigured(false);
      setMerchantLoading(false);
      return;
    }

    let cancelled = false;
    setMerchantLoading(true);

    void (async () => {
      try {
        const [settingsRes, dedicated] = await Promise.all([
          fetch(`/api/merchant-settings?organizationId=${encodeURIComponent(organizationId)}`, {
            cache: 'no-store',
          }),
          fetchMerchantDedicatedRailDefaults(organizationId).catch(() => ({
            manualBank: null,
            crypto: null,
          })),
        ]);

        if (cancelled) return;

        if (settingsRes.ok) {
          const rows = (await settingsRes.json()) as MerchantSettingsRow[];
          setMerchantRow(rows[0] ?? null);
        } else {
          setMerchantRow(null);
        }

        setManualBankConfigured(
          dedicated.manualBank ? isManualBankDefaultsComplete(dedicated.manualBank) : false
        );
      } finally {
        if (!cancelled) setMerchantLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [organizationId, refreshKey]);

  const railSetup = useMemo(() => {
    if (!merchantRow) return null;
    const snapshot = toPaymentLinkRailSnapshot({
      stripeAccountId: merchantRow.stripe_account_id,
      hederaAccountId: merchantRow.hedera_account_id,
      wiseEnabled: merchantRow.wise_enabled ?? false,
      wiseProfileId: merchantRow.wise_profile_id,
      evmWalletEnabled: merchantRow.evm_wallet_enabled,
      evmWalletAddress: merchantRow.evm_wallet_address,
      evmSupportedNetworks: merchantRow.evm_supported_networks,
    });
    return computePaymentLinkRailSetup(snapshot, {
      wisePayments: merchantRow._features?.wiseGloballyEnabled ?? false,
      evmWalletPayments: merchantRow._features?.evmGloballyEnabled ?? false,
      wiseAutoSettlementAvailable: merchantRow._features?.wiseAutoSettlementAvailable ?? false,
    });
  }, [merchantRow]);

  const readiness = useMemo(
    () =>
      buildPaymentsSetupReadiness({
        activation,
        railSetup,
        brandingConfigured: Boolean(merchantRow?.display_name?.trim()),
        accountingConnected: commercialReadiness?.connection.connected ?? false,
        manualBankConfigured,
      }),
    [activation, railSetup, merchantRow, commercialReadiness, manualBankConfigured]
  );

  const loading =
    activationLoading || merchantLoading || (commercialReadiness?.loading ?? false);

  return {
    loading,
    merchantRow,
    railSetup,
    readiness,
    manualBankConfigured,
    refreshKey,
    refresh,
  };
}
