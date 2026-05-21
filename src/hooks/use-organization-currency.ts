'use client';

import * as React from 'react';
import { useOrganization } from '@/hooks/use-organization';

const FALLBACK_CURRENCY = 'AUD';

/**
 * Resolves the organization's default currency from merchant settings.
 */
export function useOrganizationCurrency(): {
  currency: string;
  isLoading: boolean;
} {
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const [currency, setCurrency] = React.useState(FALLBACK_CURRENCY);
  const [settingsLoading, setSettingsLoading] = React.useState(true);

  React.useEffect(() => {
    if (orgLoading) return;

    if (!organizationId) {
      setCurrency(FALLBACK_CURRENCY);
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
        const code = settings[0]?.default_currency?.trim().toUpperCase();
        if (!cancelled) {
          setCurrency(code && code.length === 3 ? code : FALLBACK_CURRENCY);
        }
      } catch {
        if (!cancelled) setCurrency(FALLBACK_CURRENCY);
      } finally {
        if (!cancelled) setSettingsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [organizationId, orgLoading]);

  return {
    currency,
    isLoading: orgLoading || settingsLoading,
  };
}
