'use client';

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  buildCustomerFacingUrl,
  CUSTOMER_FACING_MISCONFIG_MESSAGE,
  getPaymentLinkUrl,
} from '@/lib/runtime/customer-facing-url';

type CustomerFacingOriginContextValue = {
  origin: string;
  configured: boolean;
  infrastructureOverride: boolean;
};

const CustomerFacingOriginContext = React.createContext<CustomerFacingOriginContextValue>({
  origin: '',
  configured: false,
  infrastructureOverride: false,
});

export function CustomerFacingOriginProvider({
  origin,
  configured,
  infrastructureOverride,
  children,
}: {
  origin: string;
  configured: boolean;
  infrastructureOverride: boolean;
  children: React.ReactNode;
}) {
  const value = React.useMemo(
    () => ({
      origin,
      configured,
      infrastructureOverride,
    }),
    [origin, configured, infrastructureOverride]
  );

  return (
    <CustomerFacingOriginContext.Provider value={value}>{children}</CustomerFacingOriginContext.Provider>
  );
}

export function useCustomerFacingOrigin() {
  return React.useContext(CustomerFacingOriginContext);
}

export function usePaymentLinkUrl(shortCode: string | null | undefined): string {
  const { origin, configured, infrastructureOverride } = useCustomerFacingOrigin();

  return React.useMemo(() => {
    if (!shortCode?.trim()) return '';
    try {
      const sharedOptions = { infrastructureOverride: infrastructureOverride || undefined };
      if (configured && origin) {
        return getPaymentLinkUrl(shortCode, { origin, ...sharedOptions });
      }
      return getPaymentLinkUrl(shortCode, {
        runtimeOrigin: typeof window !== 'undefined' ? window.location.origin : undefined,
        ...sharedOptions,
      });
    } catch {
      return '';
    }
  }, [configured, infrastructureOverride, origin, shortCode]);
}

export function useBuildCustomerFacingUrl() {
  const { origin, configured, infrastructureOverride } = useCustomerFacingOrigin();

  return React.useCallback(
    (path: string) => {
      const sharedOptions = { infrastructureOverride: infrastructureOverride || undefined };
      if (configured && origin) {
        return buildCustomerFacingUrl(path, { origin, ...sharedOptions });
      }
      return buildCustomerFacingUrl(path, {
        runtimeOrigin: typeof window !== 'undefined' ? window.location.origin : undefined,
        ...sharedOptions,
      });
    },
    [configured, infrastructureOverride, origin]
  );
}

export function CustomerFacingDomainWarning() {
  const { configured } = useCustomerFacingOrigin();
  if (configured) return null;

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Customer-facing domain misconfigured</AlertTitle>
      <AlertDescription>{CUSTOMER_FACING_MISCONFIG_MESSAGE}</AlertDescription>
    </Alert>
  );
}
