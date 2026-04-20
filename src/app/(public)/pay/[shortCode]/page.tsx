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
import { CryptoPublicPaymentContent } from '@/components/public/crypto-public-payment-content';
import { ManualBankPublicPaymentContent } from '@/components/public/manual-bank-public-payment-content';
import { InvoiceOnlyPageContent } from '@/components/public/invoice-only-page-content';
import { PaymentLinkExpired } from '@/components/public/payment-link-expired';
import { PaymentLinkCanceled } from '@/components/public/payment-link-canceled';
import { PaymentLinkNotFound } from '@/components/public/payment-link-not-found';
import { PaymentLinkPaid } from '@/components/public/payment-link-paid';
import { PaymentStatusMonitor } from '@/components/public/payment-status-monitor';
import { isValidShortCode } from '@/lib/short-code';

interface PaymentLinkData {
  id: string;
  shortCode: string;
  status: 'DRAFT' | 'OPEN' | 'PAID_UNVERIFIED' | 'REQUIRES_REVIEW' | 'PAID' | 'EXPIRED' | 'CANCELED';
  amount: string;
  currency: string;
  description: string;
  invoiceReference: string | null;
  invoiceDate?: string | null;
  customerName: string | null;
  dueDate: string | null;
  expiresAt: string | null;
  createdAt: string;
  merchant: {
    name: string;
    logoUrl: string | null;
  };
  availablePaymentMethods: {
    stripe: boolean;
    hedera: boolean;
    wise?: boolean;
    crypto?: boolean;
    manualBank?: boolean;
  };
  paymentMethod?: string | null;
  cryptoNetwork?: string | null;
  cryptoAddress?: string | null;
  cryptoCurrency?: string | null;
  cryptoMemo?: string | null;
  cryptoInstructions?: string | null;
  manualBankRecipientName?: string | null;
  manualBankCurrency?: string | null;
  manualBankDestinationType?: string | null;
  manualBankBankName?: string | null;
  manualBankAccountNumber?: string | null;
  manualBankIban?: string | null;
  manualBankSwiftBic?: string | null;
  manualBankRoutingSortCode?: string | null;
  manualBankWiseReference?: string | null;
  manualBankRevolutHandle?: string | null;
  manualBankInstructions?: string | null;
  attachmentUrl?: string | null;
  attachmentFilename?: string | null;
  attachmentMimeType?: string | null;
  wiseTransferId?: string | null;
  wiseStatus?: string | null;
  invoiceOnlyMode?: boolean;
  hederaCheckoutMode?: string | null;
  hederaWalletAddress?: string | null;
  availableFxSnapshots?: Array<{ tokenType: string; rate: number; capturedAt: string }>;
  fxSnapshot: unknown;
  lastEvent: unknown;
}

type LoadingState = 'loading' | 'found' | 'not_found' | 'error';

export default function PayPage() {
  const params = useParams();
  const shortCode = params.shortCode as string;

  const [loadingState, setLoadingState] = useState<LoadingState>('loading');
  const [paymentLink, setPaymentLink] = useState<PaymentLinkData | null>(null);
  const [enableStatusMonitor, setEnableStatusMonitor] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Client-side validation: check format before making request
    if (!shortCode) {
      setLoadingState('error');
      setErrorMessage('No payment link code provided');
      return;
    }

    if (!isValidShortCode(shortCode)) {
      // Invalid format - show error without making request
      setLoadingState('error');
      setErrorMessage('Invalid payment link format');
      console.warn(`[PayPage] Invalid short code format: "${shortCode}"`);
      return;
    }

    // AbortController for cleanup on unmount or shortCode change
    const abortController = new AbortController();
    
    const fetchPaymentLink = async () => {
      try {
        setLoadingState('loading');
        setErrorMessage(null);

        const response = await fetch(`/api/public/pay/${shortCode}`, {
          signal: abortController.signal,
        });
        
        // Parse response (even on error to get error details)
        const result = await response.json();

        if (!response.ok) {
          // Handle different error statuses
          if (response.status === 404) {
            setLoadingState('not_found');
          } else if (response.status === 400) {
            setLoadingState('error');
            setErrorMessage(result.error || 'Invalid request');
          } else {
            setLoadingState('error');
            setErrorMessage(result.error || 'Failed to load payment link');
          }
          console.warn(`[PayPage] API error ${response.status}:`, result.error);
          return; // STOP - do not retry
        }

        setPaymentLink(result.data);
        setLoadingState('found');
      } catch (error: any) {
        // Only log if not aborted (AbortError is expected on unmount)
        if (error.name !== 'AbortError') {
          console.error('[PayPage] Failed to fetch payment link:', error);
          setLoadingState('error');
          setErrorMessage('Network error - please check your connection');
        }
      }
    };

    fetchPaymentLink();

    // Cleanup: abort fetch if component unmounts or shortCode changes
    return () => {
      abortController.abort();
    };
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

  // Error state (with optional custom message)
  if (loadingState === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50 p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Unable to Load Payment Link</h1>
          <p className="text-slate-600 mb-4">
            {errorMessage || 'An error occurred while loading this payment link.'}
          </p>
          <p className="text-sm text-slate-500">
            Payment Link: <span className="font-mono">{shortCode}</span>
          </p>
        </div>
      </div>
    );
  }

  // Check if expired based on expiry date
  const isExpired = paymentLink.expiresAt && new Date(paymentLink.expiresAt) < new Date();
  
  // Expired state
  if (paymentLink.status === 'EXPIRED' || isExpired) {
    return <PaymentLinkExpired paymentLink={paymentLink} />;
  }

  // Canceled state
  if (paymentLink.status === 'CANCELED') {
    return <PaymentLinkCanceled paymentLink={paymentLink} />;
  }

  // Paid state (final)
  if (paymentLink.status === 'PAID') {
    return <PaymentLinkPaid paymentLink={paymentLink} />;
  }

  // Manual transfer submit: recorded from payer submission (verify-after-send; no merchant approval gate)
  if (paymentLink.status === 'PAID_UNVERIFIED' || paymentLink.status === 'REQUIRES_REVIEW') {
    return (
      <PaymentLinkPaid
        paymentLink={paymentLink}
        variant={paymentLink.paymentMethod === 'MANUAL_BANK' ? 'manual_submitted' : 'crypto_submitted'}
      />
    );
  }

  // Draft - should not be publicly accessible
  if (paymentLink.status === 'DRAFT') {
    return <PaymentLinkNotFound shortCode={shortCode} />;
  }

  // Open state — invoice-only (no checkout UI)
  if (paymentLink.invoiceOnlyMode === true) {
    return <InvoiceOnlyPageContent paymentLink={paymentLink} />;
  }

  // Open state — manual crypto (any wallet): instructions + confirmation only
  if (paymentLink.paymentMethod === 'CRYPTO') {
    return (
      <>
        <CryptoPublicPaymentContent shortCode={shortCode} paymentLink={paymentLink} />
        <PaymentStatusMonitor
          paymentLinkId={paymentLink.id}
          shortCode={shortCode}
          initialStatus={paymentLink.status}
        />
      </>
    );
  }

  // Open state — manual bank transfer: instructions + confirmation only
  if (paymentLink.paymentMethod === 'MANUAL_BANK') {
    return (
      <>
        <ManualBankPublicPaymentContent shortCode={shortCode} paymentLink={paymentLink} />
        <PaymentStatusMonitor
          paymentLinkId={paymentLink.id}
          shortCode={shortCode}
          initialStatus={paymentLink.status}
        />
      </>
    );
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













