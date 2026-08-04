/**
 * Legacy payment links route — redirects into Commercial OS invoice management.
 */

'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

export default function PaymentLinksPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!searchParams) {
      router.replace(COMMERCIAL_OS_ROUTES.invoiceList);
      return;
    }

    const action = searchParams.get('action');
    const invoiceId = searchParams.get('invoiceId') || searchParams.get('open');

    if (action === 'create') {
      router.replace(COMMERCIAL_OS_ROUTES.createInvoice);
      return;
    }

    if (invoiceId?.trim()) {
      router.replace(
        COMMERCIAL_OS_ROUTES.invoiceDetail(invoiceId.trim(), { id: invoiceId.trim() })
      );
      return;
    }

    router.replace(COMMERCIAL_OS_ROUTES.invoiceList);
  }, [router, searchParams]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
      <p className="text-sm">Opening invoices in Commercial OS…</p>
    </div>
  );
}
