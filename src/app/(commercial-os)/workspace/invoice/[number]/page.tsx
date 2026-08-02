'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { WorkspaceInvoiceDetailScreen } from '@/components/journey/lovable/workspace-invoice-detail-screen';

export default function WorkspaceInvoiceDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const rawNumber = params?.number;
  const invoiceNumber =
    typeof rawNumber === 'string'
      ? decodeURIComponent(rawNumber)
      : Array.isArray(rawNumber)
        ? decodeURIComponent(rawNumber[0] ?? '')
        : '';
  const paymentLinkId = searchParams?.get('id');

  return (
    <WorkspaceInvoiceDetailScreen
      invoiceNumber={invoiceNumber}
      paymentLinkId={paymentLinkId}
    />
  );
}
