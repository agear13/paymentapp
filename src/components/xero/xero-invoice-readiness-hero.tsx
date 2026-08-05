'use client';

import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { useCommercialReadinessOptional } from '@/hooks/use-commercial-readiness';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { XERO_INVOICE_READINESS_COPY } from '@/lib/xero/xero-setup-guidance';

type XeroInvoiceReadinessHeroProps = {
  variant?: 'default' | 'commercial';
};

export function XeroInvoiceReadinessHero({ variant = 'commercial' }: XeroInvoiceReadinessHeroProps) {
  const readiness = useCommercialReadinessOptional();
  const isCommercial = variant === 'commercial';

  if (!readiness) return null;

  const cardClass = isCommercial
    ? 'rounded-2xl border border-border bg-card p-5 shadow-card'
    : 'rounded-lg border bg-card p-5';

  return (
    <div className={cardClass} id="guided-xero-health-check">
      <p className="text-sm text-muted-foreground">{XERO_INVOICE_READINESS_COPY.heroQuestion}</p>

      {readiness.loading ? (
        <div className="mt-3 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">{XERO_INVOICE_READINESS_COPY.checking}</span>
        </div>
      ) : (
        <>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{readiness.heroAnswer}</p>
          <p className="mt-1 text-sm text-muted-foreground">{readiness.heroSubline}</p>

          {readiness.canCreateInvoice ? (
            <Link
              href={COMMERCIAL_OS_ROUTES.createInvoice}
              className={
                isCommercial
                  ? 'mt-4 inline-flex text-sm font-medium text-primary hover:underline'
                  : 'mt-4 inline-flex text-sm font-medium text-primary hover:underline'
              }
            >
              {XERO_INVOICE_READINESS_COPY.createInvoiceCta}
            </Link>
          ) : null}
        </>
      )}
    </div>
  );
}
