'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { commercialOsXeroOAuthReturnPath } from '@/lib/xero/oauth-return-path';
import { formatXeroOAuthError } from '@/lib/xero/xero-customer-messages';
import { useCommercialReadinessOptional } from '@/hooks/use-commercial-readiness';

/**
 * Handles Xero OAuth query params on Commercial OS routes that are not the
 * dedicated accounting setup screens (safety net for allowlisted return paths).
 */
export function XeroOAuthReturnHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const readiness = useCommercialReadinessOptional();
  const handledRef = React.useRef(false);

  React.useEffect(() => {
    const success = searchParams?.get('xero_success');
    const error = searchParams?.get('xero_error');
    if (!success && !error) return;

    const setupPath = commercialOsXeroOAuthReturnPath();
    if (pathname === setupPath || pathname === COMMERCIAL_OS_ROUTES.connected) {
      return;
    }

    if (handledRef.current) return;
    handledRef.current = true;

    if (success === 'connected') {
      void readiness?.refresh();
      router.replace(setupPath);
      return;
    }

    if (error) {
      const customer = formatXeroOAuthError(error);
      toast.error(customer.message, { description: customer.action });
      void readiness?.refresh();
      router.replace(setupPath);
    }
  }, [pathname, readiness, router, searchParams]);

  return null;
}
