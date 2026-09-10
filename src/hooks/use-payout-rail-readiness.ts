'use client';

import * as React from 'react';
import { useOrganization } from '@/hooks/use-organization';
import {
  EMPTY_PAYOUT_RAIL_READINESS,
  type PayoutRailReadinessSnapshot,
} from '@/lib/payouts/payout-rail-readiness';

export function usePayoutRailReadiness(): PayoutRailReadinessSnapshot {
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const [readiness, setReadiness] = React.useState<PayoutRailReadinessSnapshot>(
    EMPTY_PAYOUT_RAIL_READINESS
  );

  React.useEffect(() => {
    if (orgLoading) return;
    if (!organizationId) {
      setReadiness(EMPTY_PAYOUT_RAIL_READINESS);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/payouts/rails/readiness');
        if (!response.ok) return;
        const data = (await response.json()) as Partial<PayoutRailReadinessSnapshot>;
        if (cancelled) return;
        setReadiness({
          merchantHederaReady: data.merchantHederaReady === true,
          merchantCregisReady: data.merchantCregisReady === true,
          merchantAirwallexReady: data.merchantAirwallexReady === true,
        });
      } catch {
        if (!cancelled) setReadiness(EMPTY_PAYOUT_RAIL_READINESS);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [organizationId, orgLoading]);

  return readiness;
}
