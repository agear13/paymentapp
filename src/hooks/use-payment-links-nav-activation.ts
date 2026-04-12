'use client';

/**
 * Fetches Payment Links main-nav activation for progressive sidebar (standard + admin dashboard).
 * Rabbit Hole pilot should not use this hook — that shell uses a different sidebar.
 */

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { useOrganization } from '@/hooks/use-organization';
import { useToast } from '@/hooks/use-toast';
import type { DashboardProductProfile } from '@/lib/auth/admin-shared';

export type PaymentLinksNavActivation = {
  /** True = show Reports, Ledger, Transactions, Admin Operations in main nav */
  showAdvancedMainNav: boolean;
  /** Resolved from API; null while loading */
  activated: boolean | null;
};

const REVEAL_SESSION_KEY = 'payment-links-nav-reveal-toast-shown';

export function usePaymentLinksNavActivation(
  productProfile: DashboardProductProfile
): PaymentLinksNavActivation {
  const { organizationId } = useOrganization();
  const pathname = usePathname();
  const { toast } = useToast();
  const [activated, setActivated] = React.useState<boolean | null>(null);
  const prevActivated = React.useRef<boolean | null>(null);

  const applies =
    productProfile === 'standard' || productProfile === 'admin';

  React.useEffect(() => {
    if (!applies || !organizationId) {
      setActivated(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/payment-links/nav-activation?organizationId=${encodeURIComponent(organizationId)}`
        );
        if (!res.ok) {
          throw new Error('nav-activation failed');
        }
        const data = (await res.json()) as { activated?: boolean };
        if (!cancelled) {
          setActivated(data.activated === true);
        }
      } catch {
        if (!cancelled) {
          setActivated(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applies, organizationId, pathname]);

  React.useEffect(() => {
    if (!applies || !organizationId || activated !== true) {
      prevActivated.current = activated;
      return;
    }

    if (prevActivated.current === false && activated === true) {
      try {
        const key = `${REVEAL_SESSION_KEY}:${organizationId}`;
        if (!sessionStorage.getItem(key)) {
          toast({
            title: 'More financial tools are now available',
            description:
              'Reports, Ledger, Transactions, and Admin Operations are now in the sidebar.',
          });
          sessionStorage.setItem(key, '1');
        }
      } catch {
        /* sessionStorage unavailable */
      }
    }
    prevActivated.current = activated;
  }, [activated, applies, organizationId, toast]);

  if (!applies) {
    return { showAdvancedMainNav: true, activated: true };
  }

  const showAdvancedMainNav = activated === true;

  return { showAdvancedMainNav, activated };
}
