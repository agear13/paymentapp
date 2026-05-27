'use client';

import * as React from 'react';
import { useOrganization } from '@/hooks/use-organization';
import { resolveCatalogDefaultCurrency } from '@/lib/currency/resolve-catalog-default-currency';
import { useWorkspaceActivation } from '@/hooks/use-workspace-activation';

/**
 * Resolves the organization's default currency from merchant settings.
 */
export function useOrganizationCurrency(): {
  currency: string;
  isLoading: boolean;
} {
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const { activation, loading: activationLoading } = useWorkspaceActivation();
  const [merchantCurrency, setMerchantCurrency] = React.useState<string | null>(null);
  const [settingsLoading, setSettingsLoading] = React.useState(true);

  React.useEffect(() => {
    if (orgLoading) return;

    if (!organizationId) {
      setMerchantCurrency(null);
      setSettingsLoading(false);
      return;
    }

    let cancelled = false;
    setSettingsLoading(true);

    void (async () => {
      try {
        const res = await fetch(
          `/api/merchant-settings?organizationId=${organizationId}`
        );
        if (!res.ok) throw new Error('settings unavailable');
        const settings = (await res.json()) as Array<{ default_currency?: string }>;
        if (!cancelled) {
          setMerchantCurrency(settings[0]?.default_currency ?? null);
        }
      } catch {
        if (!cancelled) setMerchantCurrency(null);
      } finally {
        if (!cancelled) setSettingsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [organizationId, orgLoading]);

  const currency = React.useMemo(
    () =>
      resolveCatalogDefaultCurrency({
        workspaceDefaultCurrency: activation?.defaultCurrency,
        merchantDefaultCurrency: merchantCurrency,
      }),
    [activation?.defaultCurrency, merchantCurrency]
  );

  return {
    currency,
    isLoading: orgLoading || activationLoading || settingsLoading,
  };
}
