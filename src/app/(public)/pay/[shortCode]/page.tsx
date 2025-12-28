/**
 * Public Payment Page
 * Route: /pay/[shortCode]
 * Public-facing payment page for customers to complete payments
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { PaymentPageContent } from '@/components/public/payment-page-content';
import { PaymentLinkExpired } from '@/components/public/payment-link-expired';
import { PaymentLinkCanceled } from '@/components/public/payment-link-canceled';
import { PaymentLinkNotFound } from '@/components/public/payment-link-not-found';
import { PaymentLinkPaid } from '@/components/public/payment-link-paid';
import { PaymentStatusMonitor } from '@/components/public/payment-status-monitor';

interface PaymentLinkData {
  id: string;
  shortCode: string;
  status: 'DRAFT' | 'OPEN' | 'PAID' | 'EXPIRED' | 'CANCELED';
  amount: string;
  currency: string;
  description: string;
  invoiceReference: string | null;
  expiresAt: string | null;
  createdAt: string;
  merchant: {
    name: string;
  };
  availablePaymentMethods: {
    stripe: boolean;
    hedera: boolean;
  };
  fxSnapshot: any;
  lastEvent: any;
}

type LoadingState = 'loading' | 'found' | 'not_found' | 'error';

export default function PayPage() {
  const params = useParams();
  const shortCode = params.shortCode as string;

  const [loadingState, setLoadingState] = useState<LoadingState>('loading');
  const [paymentLink, setPaymentLink] = useState<PaymentLinkData | null>(null);
  const [enableStatusMonitor, setEnableStatusMonitor] = useState(false);

  useEffect(() => {
    const fetchPaymentLink = async () => {
      try {
        setLoadingState('loading');

        const response = await fetch(`/api/public/pay/${shortCode}`);
        const result = await response.json();

        if (!response.ok) {
          if (response.status === 404) {
            setLoadingState('not_found');
          } else {
            setLoadingState('error');
          }
          return;
        }

        setPaymentLink(result.data);
        setLoadingState('found');
      } catch (error) {
        console.error('Failed to fetch payment link:', error);
        setLoadingState('error');
      }
    };

    if (shortCode) {
      fetchPaymentLink();
    }
  }, [shortCode]);

  // Loading state
  if (loadingState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Loading payment details...</p>
        </div>
      </div>
    );
  }

  // Not found state
  if (loadingState === 'not_found' || !paymentLink) {
    return <PaymentLinkNotFound shortCode={shortCode} />;
  }

  // Error state
  if (loadingState === 'error') {
    return <PaymentLinkNotFound shortCode={shortCode} />;
  }

  // Expired state
  if (paymentLink.status === 'EXPIRED') {
    return <PaymentLinkExpired paymentLink={paymentLink} />;
  }

  // Canceled state
  if (paymentLink.status === 'CANCELED') {
    return <PaymentLinkCanceled paymentLink={paymentLink} />;
  }

  // Paid state
  if (paymentLink.status === 'PAID') {
    return <PaymentLinkPaid paymentLink={paymentLink} />;
  }

  // Draft - should not be publicly accessible
  if (paymentLink.status === 'DRAFT') {
    return <PaymentLinkNotFound shortCode={shortCode} />;
  }

  // Open state - show payment page
  return (
    <>
      <PaymentPageContent 
        paymentLink={paymentLink} 
        onPaymentStarted={() => setEnableStatusMonitor(true)}
      />
      {enableStatusMonitor && paymentLink && (
        <PaymentStatusMonitor
          paymentLinkId={paymentLink.id}
          shortCode={shortCode}
          initialStatus={paymentLink.status}
        />
      )}
    </>
  );
}













