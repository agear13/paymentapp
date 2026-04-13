/**
 * Manual crypto payment (any network): instructions + payer confirmation flow.
 * No wallet connection UI.
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
import { AlertTriangle, Copy, Check, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PublicPaymentLinkAttachment } from '@/components/public/public-payment-link-attachment';

const COMMON_NETWORKS = [
  'Bitcoin',
  'Ethereum',
  'Solana',
  'Polygon',
  'Arbitrum',
  'Base',
  'BSC / BNB Chain',
  'Avalanche C-Chain',
  'Optimism',
  'Tron',
  'Hedera',
];

export interface CryptoPublicPaymentContentProps {
  shortCode: string;
  paymentLink: {
    id: string;
    shortCode: string;
    amount: string;
    currency: string;
    description: string;
    invoiceReference: string | null;
    customerName: string | null;
    dueDate: string | null;
    expiresAt: string | null;
    merchant: { name: string; logoUrl: string | null };
    cryptoNetwork: string | null;
    cryptoAddress: string | null;
    cryptoCurrency: string | null;
    cryptoMemo: string | null;
    cryptoInstructions: string | null;
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

export function CryptoPublicPaymentContent({
  shortCode,
  paymentLink,
}: CryptoPublicPaymentContentProps) {
  const { toast } = useToast();
  const [showForm, setShowForm] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [payerNetwork, setPayerNetwork] = React.useState('');
  const [payerAmountSent, setPayerAmountSent] = React.useState(paymentLink.amount);
  const [payerCurrency, setPayerCurrency] = React.useState(
    () => paymentLink.cryptoCurrency?.trim() || paymentLink.currency || ''
  );
  const [payerWalletAddress, setPayerWalletAddress] = React.useState('');
  const [payerTxHash, setPayerTxHash] = React.useState('');

  const network = paymentLink.cryptoNetwork?.trim() || '';
  const address = paymentLink.cryptoAddress?.trim() || '';
  const asset = paymentLink.cryptoCurrency?.trim() || '';
  const memo = paymentLink.cryptoMemo?.trim();
  const instructions = paymentLink.cryptoInstructions?.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payerNetwork.trim() || !payerAmountSent.trim() || !payerWalletAddress.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Network, amount sent, and your wallet address are required.',
        variant: 'destructive',
      });
      return;
    }
    const currencyTrim = payerCurrency.trim();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/pay/${shortCode}/crypto-confirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payerNetwork: payerNetwork.trim(),
          payerAmountSent: payerAmountSent.trim(),
          payerWalletAddress: payerWalletAddress.trim(),
          payerCurrency: currencyTrim || null,
          payerTxHash: payerTxHash.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || 'Could not submit confirmation');
      }
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

            <Alert variant="destructive" className="border-amber-200 bg-amber-50 text-amber-950">
              <AlertTriangle className="h-4 w-4 text-amber-700" />
              <AlertTitle className="text-amber-900">Match the network exactly</AlertTitle>
              <AlertDescription className="text-amber-900/90">
                Sending on the wrong network can result in permanent loss of funds. Verify the network name matches
                your wallet before you send.
              </AlertDescription>
            </Alert>

            <div className="rounded-lg border bg-slate-50/80 p-4 space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Pay with crypto</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                  <dt className="text-muted-foreground">Network</dt>
                  <dd className="font-medium text-slate-900 break-all">{network || '—'}</dd>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                  <dt className="text-muted-foreground">Asset / currency</dt>
                  <dd className="font-medium text-slate-900">{asset || '—'}</dd>
                </div>
                {memo ? (
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                    <dt className="text-muted-foreground">Memo / tag</dt>
                    <dd className="font-mono text-xs break-all sm:text-right">{memo}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-muted-foreground mb-1">Wallet address</dt>
                  <dd className="font-mono text-xs break-all bg-white border rounded-md p-3 text-slate-900">
                    {address || '—'}
                  </dd>
                  {address ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => copyWithToast(toast, 'Address', address)}
                    >
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                      Copy address
                    </Button>
                  ) : null}
                </div>
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
                  onClick={() =>
                    copyWithToast(toast, 'Amount', `${paymentLink.amount} ${paymentLink.currency}`)
                  }
                >
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  Copy amount
                </Button>
              </div>

              {instructions ? (
                <div>
                  <p className="text-sm font-medium text-slate-800 mb-1">Additional instructions</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{instructions}</p>
                </div>
              ) : null}
            </div>

            {submitted ? (
              <Alert>
                <Check className="h-4 w-4" />
                <AlertTitle>Payment submitted successfully</AlertTitle>
                <AlertDescription>
                  Your payment details were recorded and the merchant has been notified. You can close this page; no
                  further action is required from you.
                </AlertDescription>
              </Alert>
            ) : !showForm ? (
              <Button type="button" className="w-full sm:w-auto" onClick={() => setShowForm(true)}>
                I’ve sent payment
              </Button>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 border rounded-lg p-4 bg-white">
                <h3 className="font-semibold text-slate-900">Confirm your payment</h3>
                <p className="text-sm text-muted-foreground">
                  Tell us what you sent so we can match your transaction to this invoice.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="payerNetwork">Network you used *</Label>
                  <Input
                    id="payerNetwork"
                    value={payerNetwork}
                    onChange={(e) => setPayerNetwork(e.target.value)}
                    placeholder="Must match the network you sent on"
                    list="crypto-network-suggestions"
                    required
                  />
                  <datalist id="crypto-network-suggestions">
                    {COMMON_NETWORKS.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payerAmountSent">Amount sent *</Label>
                  <Input
                    id="payerAmountSent"
                    value={payerAmountSent}
                    onChange={(e) => setPayerAmountSent(e.target.value)}
                    placeholder="e.g. 0.05 ETH"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payerCurrency">Asset / currency you sent</Label>
                  <Input
                    id="payerCurrency"
                    value={payerCurrency}
                    onChange={(e) => setPayerCurrency(e.target.value)}
                    placeholder="e.g. ETH, USDC (defaults to invoice asset if left blank)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Helps verify your payment matches the requested asset.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payerWalletAddress">Your wallet address *</Label>
                  <Input
                    id="payerWalletAddress"
                    value={payerWalletAddress}
                    onChange={(e) => setPayerWalletAddress(e.target.value)}
                    placeholder="Address you sent from"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payerTxHash">Transaction hash (optional)</Label>
                  <Input
                    id="payerTxHash"
                    value={payerTxHash}
                    onChange={(e) => setPayerTxHash(e.target.value)}
                    placeholder="Explorer link or tx id"
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
