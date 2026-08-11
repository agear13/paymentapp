'use client';

import Link from 'next/link';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { useEntitlements } from '@/hooks/use-entitlements';
import { GatedButton } from '@/components/entitlements/feature-gate';

type CommercialOsCreateInvoiceLinkProps = {
  href?: string;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
};

/** Link to invoice creation — gated on payment_links entitlement when used as button. */
export function CommercialOsCreateInvoiceLink({
  href = COMMERCIAL_OS_ROUTES.createInvoice,
  className,
  children,
  onClick,
}: CommercialOsCreateInvoiceLinkProps) {
  const { loading, isAllowed, pilotBypass } = useEntitlements();
  const allowed = pilotBypass || isAllowed('payment_links');

  if (onClick) {
    if (loading) {
      return (
        <button type="button" className={className} disabled>
          {children}
        </button>
      );
    }
    if (!allowed) {
      return (
        <Link href={COMMERCIAL_OS_ROUTES.createInvoice} className={className}>
          {children}
        </Link>
      );
    }
    return (
      <button type="button" className={className} onClick={onClick}>
        {children}
      </button>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

type CommercialOsCreateInvoiceGateProps = {
  children: React.ReactNode;
  fullPage?: boolean;
};

/** Wraps content that requires payment_links — prefer page-level check on create screen. */
export function CommercialOsCreateInvoiceGate({ children }: CommercialOsCreateInvoiceGateProps) {
  const { loading, isAllowed, pilotBypass } = useEntitlements();

  if (loading) return null;
  if (!pilotBypass && !isAllowed('payment_links')) {
    return (
      <Link href={COMMERCIAL_OS_ROUTES.createInvoice} className="opacity-90">
        {children}
      </Link>
    );
  }

  return <>{children}</>;
}

export { GatedButton as CommercialOsCreateInvoiceGatedButton };
