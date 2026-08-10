'use client';

import Link from 'next/link';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

type CommercialOsCreateInvoiceGateProps = {
  children: React.ReactNode;
  /** @deprecated No longer blocks invoice creation — kept for call-site compatibility. */
  fullPage?: boolean;
};

/** Pass-through wrapper — invoice creation no longer requires accounting integration. */
export function CommercialOsCreateInvoiceGate({ children }: CommercialOsCreateInvoiceGateProps) {
  return <>{children}</>;
}

type CommercialOsCreateInvoiceLinkProps = {
  href?: string;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
};

/** Direct link to invoice creation (accounting connection is optional). */
export function CommercialOsCreateInvoiceLink({
  href = COMMERCIAL_OS_ROUTES.createInvoice,
  className,
  children,
  onClick,
}: CommercialOsCreateInvoiceLinkProps) {
  if (onClick) {
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
