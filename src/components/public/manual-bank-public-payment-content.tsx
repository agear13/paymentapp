/**
 * Manual bank transfer instructions + payer confirmation (send first, verify after).
 */

'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PaymentAmountDisplay } from '@/components/public/payment-amount-display';
import { MerchantBranding } from '@/components/public/merchant-branding';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Check, Copy, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PublicPaymentLinkAttachment } from '@/components/public/public-payment-link-attachment';

export interface ManualBankPublicPaymentContentProps {
  shortCode: string;
  paymentLink: {
    id: string;
    shortCode: string;
    amount: string;
    currency: string;
    description: string;
    invoiceReference: string | null;
    invoiceDate?: string | null;
    customerName: string | null;
    dueDate: string | null;
    expiresAt: string | null;
    merchant: { name: string; logoUrl: string | null };
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
  };
}

async function copyWithToast(
  showToast: ReturnType<typeof useToast>['toast'],
  label: string,
  text: string
) {
  try {
    await navigator.clipboard.writeText(text);
    showToast({ title: 'Copied', description: `${label} copied to clipboard.` });
  } catch {
    showToast({
      title: 'Copy failed',
      description: 'Select and copy manually.',
      variant: 'destructive',
    });
  }
}

export function ManualBankPublicPaymentContent({
  shortCode,
  paymentLink,
}: ManualBankPublicPaymentContentProps) {
  const { toast } = useToast();
  const [showForm, setShowForm] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [payerAmountSent, setPayerAmountSent] = React.useState(paymentLink.amount);
  const [payerCurrency, setPayerCurrency] = React.useState(
    paymentLink.manualBankCurrency?.trim() || paymentLink.currency
  );
  const [payerDestination, setPayerDestination] = React.useState('');
  const [payerMethodUsed, setPayerMethodUsed] = React.useState('');
  const [payerReference, setPayerReference] = React.useState('');
  const [payerProofDetails, setPayerProofDetails] = React.useState('');
  const [payerNote, setPayerNote] = React.useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payerAmountSent.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Amount sent is required.',
        variant: 'destructive',
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/pay/${shortCode}/manual-bank-confirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payerAmountSent: payerAmountSent.trim(),
          payerCurrency: payerCurrency.trim() || null,
          payerDestination: payerDestination.trim() || null,
          payerPaymentMethodUsed: payerMethodUsed.trim() || null,
          payerReference: payerReference.trim() || null,
          payerProofDetails: payerProofDetails.trim() || null,
          payerNote: payerNote.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not submit confirmation');
      setSubmitted(true);
      setShowForm(false);
      toast({
        title: 'Payment submitted',
        description: json.message || 'Payment submitted successfully.',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Submission failed';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const currency = paymentLink.manualBankCurrency?.trim() || paymentLink.currency;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-2xl">
        <Card className="border-0 shadow-xl">
          <CardHeader className="border-b bg-slate-50/50 pb-6">
            <MerchantBranding
              merchantName={paymentLink.merchant.name}
              logoUrl={paymentLink.merchant.logoUrl}
            />
          </CardHeader>
          <CardContent className="pt-8 pb-8 space-y-8">
            <PaymentAmountDisplay
              amount={paymentLink.amount}
              currency={paymentLink.currency}
              description={paymentLink.description}
              invoiceReference={paymentLink.invoiceReference}
              invoiceDate={paymentLink.invoiceDate}
              dueDate={paymentLink.dueDate}
            />

            {paymentLink.attachmentUrl ? (
              <PublicPaymentLinkAttachment
                payShortCode={paymentLink.shortCode}
                attachmentUrl={paymentLink.attachmentUrl}
                attachmentFilename={paymentLink.attachmentFilename}
                attachmentMimeType={paymentLink.attachmentMimeType}
              />
            ) : null}

            <div className="rounded-lg border bg-slate-50/80 p-4 space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Pay by bank transfer</h2>
              <p className="text-sm text-muted-foreground">
                Send funds using the details below. No provider connection is required on this page.
              </p>
              <dl className="space-y-3 text-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                  <dt className="text-muted-foreground">Recipient</dt>
                  <dd className="font-medium text-slate-900 break-all">
                    {paymentLink.manualBankRecipientName || '—'}
                  </dd>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                  <dt className="text-muted-foreground">Destination type</dt>
                  <dd className="font-medium text-slate-900 break-all">
                    {paymentLink.manualBankDestinationType || '—'}
                  </dd>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                  <dt className="text-muted-foreground">Transfer currency</dt>
                  <dd className="font-medium text-slate-900">{currency}</dd>
                </div>
                {paymentLink.manualBankBankName ? (
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                    <dt className="text-muted-foreground">Bank name</dt>
                    <dd className="font-medium text-slate-900">{paymentLink.manualBankBankName}</dd>
                  </div>
                ) : null}
                {paymentLink.manualBankAccountNumber ? (
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                    <dt className="text-muted-foreground">Account number</dt>
                    <dd className="font-mono text-xs break-all">{paymentLink.manualBankAccountNumber}</dd>
                  </div>
                ) : null}
                {paymentLink.manualBankIban ? (
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                    <dt className="text-muted-foreground">IBAN</dt>
                    <dd className="font-mono text-xs break-all">{paymentLink.manualBankIban}</dd>
                  </div>
                ) : null}
                {paymentLink.manualBankSwiftBic ? (
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                    <dt className="text-muted-foreground">SWIFT / BIC</dt>
                    <dd className="font-mono text-xs break-all">{paymentLink.manualBankSwiftBic}</dd>
                  </div>
                ) : null}
                {paymentLink.manualBankRoutingSortCode ? (
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                    <dt className="text-muted-foreground">Routing / sort code</dt>
                    <dd className="font-mono text-xs break-all">{paymentLink.manualBankRoutingSortCode}</dd>
                  </div>
                ) : null}
                {paymentLink.manualBankWiseReference ? (
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                    <dt className="text-muted-foreground">Wise reference</dt>
                    <dd className="font-mono text-xs break-all">{paymentLink.manualBankWiseReference}</dd>
                  </div>
                ) : null}
                {paymentLink.manualBankRevolutHandle ? (
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                    <dt className="text-muted-foreground">Revolut handle</dt>
                    <dd className="font-mono text-xs break-all">{paymentLink.manualBankRevolutHandle}</dd>
                  </div>
                ) : null}
              </dl>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm text-muted-foreground">Invoice amount:</span>
                <span className="font-semibold">
                  {paymentLink.amount} {paymentLink.currency}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => copyWithToast(toast, 'Amount', `${paymentLink.amount} ${paymentLink.currency}`)}
                >
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  Copy amount
                </Button>
              </div>

              {paymentLink.manualBankInstructions ? (
                <Alert>
                  <AlertTitle>Additional instructions</AlertTitle>
                  <AlertDescription className="whitespace-pre-wrap">
                    {paymentLink.manualBankInstructions}
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>

            {submitted ? (
              <Alert>
                <Check className="h-4 w-4" />
                <AlertTitle>Payment submitted successfully</AlertTitle>
                <AlertDescription>
                  Your transfer details were recorded and the merchant has been notified for verification.
                </AlertDescription>
              </Alert>
            ) : !showForm ? (
              <Button type="button" className="w-full sm:w-auto" onClick={() => setShowForm(true)}>
                I’ve sent payment
              </Button>
            ) : (
              <form onSubmit={submit} className="space-y-4 border rounded-lg p-4 bg-white">
                <h3 className="font-semibold text-slate-900">Confirm your transfer</h3>
                <p className="text-sm text-muted-foreground">
                  Submit what you sent. The merchant verifies after the transfer settles.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="payerAmountSent">Amount sent *</Label>
                  <Input
                    id="payerAmountSent"
                    value={payerAmountSent}
                    onChange={(e) => setPayerAmountSent(e.target.value)}
                    placeholder={`e.g. ${paymentLink.amount} ${currency}`}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payerCurrency">Currency submitted (optional)</Label>
                  <Input
                    id="payerCurrency"
                    value={payerCurrency}
                    onChange={(e) => setPayerCurrency(e.target.value)}
                    placeholder={currency}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payerDestination">Destination/recipient you paid (optional)</Label>
                  <Input
                    id="payerDestination"
                    value={payerDestination}
                    onChange={(e) => setPayerDestination(e.target.value)}
                    placeholder={paymentLink.manualBankRecipientName || 'Recipient label used in your transfer app'}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payerMethodUsed">Payment method used (optional)</Label>
                  <Input
                    id="payerMethodUsed"
                    value={payerMethodUsed}
                    onChange={(e) => setPayerMethodUsed(e.target.value)}
                    placeholder="e.g. local bank transfer, Wise app, Revolut"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payerReference">Transfer reference (optional)</Label>
                  <Input
                    id="payerReference"
                    value={payerReference}
                    onChange={(e) => setPayerReference(e.target.value)}
                    placeholder="Reference / transaction id / memo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payerProofDetails">Proof details (optional)</Label>
                  <Textarea
                    id="payerProofDetails"
                    value={payerProofDetails}
                    onChange={(e) => setPayerProofDetails(e.target.value)}
                    rows={3}
                    placeholder="Screenshot note, transfer timestamp, receiver message, etc."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payerNote">Additional note (optional)</Label>
                  <Textarea
                    id="payerNote"
                    value={payerNote}
                    onChange={(e) => setPayerNote(e.target.value)}
                    rows={2}
                    placeholder="Anything else the merchant should know"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Submitting…
                      </>
                    ) : (
                      'Submit confirmation'
                    )}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            <div className="pt-6 border-t text-center">
              <p className="text-xs text-slate-500">
                Powered by <span className="font-semibold">Provvypay</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

