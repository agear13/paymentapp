'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  submitCryptoConfirmationReview,
  submitManualBankConfirmationReview,
  type CryptoConfirmationRow,
  type ManualBankConfirmationRow,
  type PaymentConfirmationReviewAction,
} from '@/lib/payment-links/payment-link-merchant-actions';

type InvoicePaymentReviewPanelProps = {
  invoiceStatus: string;
  paymentMethod: string | null | undefined;
  cryptoConfirmation: CryptoConfirmationRow | null;
  manualBankConfirmation: ManualBankConfirmationRow | null;
  onReviewComplete: () => void | Promise<void>;
};

function needsMerchantReview(status: string): boolean {
  return status === 'PAID_UNVERIFIED' || status === 'REQUIRES_REVIEW';
}

export function InvoicePaymentReviewPanel({
  invoiceStatus,
  paymentMethod,
  cryptoConfirmation,
  manualBankConfirmation,
  onReviewComplete,
}: InvoicePaymentReviewPanelProps) {
  const { toast } = useToast();
  const [acting, setActing] = React.useState<PaymentConfirmationReviewAction | null>(null);

  if (!needsMerchantReview(invoiceStatus)) {
    return null;
  }

  const isCrypto = paymentMethod?.toUpperCase() === 'CRYPTO';
  const isManualBank = paymentMethod?.toUpperCase() === 'MANUAL_BANK';
  const confirmation = isCrypto ? cryptoConfirmation : isManualBank ? manualBankConfirmation : null;

  if (!confirmation) {
    return null;
  }

  const runReview = async (action: PaymentConfirmationReviewAction) => {
    setActing(action);
    try {
      const result = isCrypto
        ? await submitCryptoConfirmationReview(confirmation.id, action)
        : await submitManualBankConfirmationReview(confirmation.id, action);
      toast({
        title:
          action === 'mark_valid'
            ? 'Payment verified'
            : action === 'flag_investigate'
              ? 'Payment rejected'
              : 'Updated',
        description: result.message ?? 'Invoice updated.',
      });
      await onReviewComplete();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Review failed';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setActing(null);
    }
  };

  return (
    <section
      className="rounded-2xl border border-amber-500/35 bg-amber-500/[0.06] p-6 shadow-card"
      aria-label="Review payment"
    >
      <h2 className="text-[13.5px] font-semibold text-foreground">Review payment</h2>
      <p className="mt-2 text-sm text-ink-soft">
        A customer reported payment for this invoice. Verify the funds before Provvy finalises settlement
        and Xero reconciliation.
      </p>

      {isCrypto && cryptoConfirmation ? (
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {cryptoConfirmation.payerAmountSent ? (
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">Amount sent</dt>
              <dd>{cryptoConfirmation.payerAmountSent}</dd>
            </div>
          ) : null}
          {cryptoConfirmation.payerCurrency ? (
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">Asset</dt>
              <dd>{cryptoConfirmation.payerCurrency}</dd>
            </div>
          ) : null}
          {cryptoConfirmation.payerTxHash ? (
            <div className="sm:col-span-2">
              <dt className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">Transaction</dt>
              <dd className="break-all font-mono text-xs">{cryptoConfirmation.payerTxHash}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {isManualBank && manualBankConfirmation ? (
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">Amount sent</dt>
            <dd>{manualBankConfirmation.payerAmountSent}</dd>
          </div>
          {manualBankConfirmation.payerReference ? (
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">Reference</dt>
              <dd>{manualBankConfirmation.payerReference}</dd>
            </div>
          ) : null}
          {manualBankConfirmation.payerPaymentMethodUsed ? (
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">Method used</dt>
              <dd>{manualBankConfirmation.payerPaymentMethodUsed}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button size="sm" disabled={acting !== null} onClick={() => void runReview('mark_valid')}>
          {acting === 'mark_valid' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Verify payment received
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={acting !== null}
          onClick={() => void runReview('flag_investigate')}
        >
          {acting === 'flag_investigate' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Reject payment
        </Button>
      </div>
    </section>
  );
}
