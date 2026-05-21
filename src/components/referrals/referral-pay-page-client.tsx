'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, Loader2 } from 'lucide-react';
import { ReferralCheckoutBranding } from '@/components/referrals/referral-checkout-branding';
import { ReferralPaymentMethodDialog } from '@/components/referrals/referral-payment-method-dialog';
import type { ReferralPaymentRail } from '@/lib/referrals/referral-payment-rails';
import { customerRailLabel, defaultReferralPaymentRails } from '@/lib/referrals/referral-payment-rails';

interface Props {
  referralCode: string;
  checkoutConfig?: Record<string, unknown> | null;
  /** When true, omit page chrome (used inside commission landing). */
  embedded?: boolean;
  merchantDisplayName?: string;
  merchantLogoUrl?: string | null;
  paymentRails?: ReferralPaymentRail[];
}

export function ReferralPayPageClient({
  referralCode,
  checkoutConfig,
  embedded = false,
  merchantDisplayName = 'Merchant checkout',
  merchantLogoUrl,
  paymentRails = defaultReferralPaymentRails(),
}: Props) {
  const config = (checkoutConfig as Record<string, unknown>) || {};
  const defaultAmount = Number(config.amount) || 100;
  const defaultCurrency = String(config.currency || 'AUD').toUpperCase().slice(0, 3);
  const defaultDescription = String(config.description || 'Service payment');

  const [amount, setAmount] = useState<string>(String(defaultAmount));
  const [currency, setCurrency] = useState(defaultCurrency);
  const [description, setDescription] = useState(defaultDescription);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [methodDialogOpen, setMethodDialogOpen] = useState(false);

  const submitCheckout = async (rail: ReferralPaymentRail) => {
    setError('');
    const amountNum = parseFloat(amount);
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/referral/${referralCode}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountNum,
          currency: currency || 'AUD',
          description: description || undefined,
          paymentRail: rail,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || data.message || 'Checkout failed');
        return;
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      setError('No checkout URL returned');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
      setMethodDialogOpen(false);
    }
  };

  const onPayClick = () => {
    if (paymentRails.length === 0) return;
    if (paymentRails.length === 1) {
      void submitCheckout(paymentRails[0]);
      return;
    }
    setMethodDialogOpen(true);
  };

  if (paymentRails.length === 0) {
    return null;
  }

  const payLabel =
    paymentRails.length === 1
      ? `Pay with ${customerRailLabel(paymentRails[0]).toLowerCase()}`
      : 'Continue to checkout';

  const form = (
    <Card className={embedded ? 'border shadow-sm' : 'w-full max-w-md shadow-sm'}>
      {!embedded ? (
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-5 w-5" />
            Pay a custom amount
          </CardTitle>
          <CardDescription>Enter your payment details to continue to secure checkout.</CardDescription>
        </CardHeader>
      ) : null}
      <CardContent className={embedded ? 'pt-6' : undefined}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100"
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Input
              id="currency"
              type="text"
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
              placeholder="AUD"
              maxLength={3}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What you are paying for"
              disabled={loading}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button className="w-full" onClick={onPayClick} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Redirecting to checkout…
              </>
            ) : (
              payLabel
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (embedded) {
    return (
      <>
        {form}
        <ReferralPaymentMethodDialog
          open={methodDialogOpen}
          onOpenChange={setMethodDialogOpen}
          rails={paymentRails}
          loading={loading}
          onSelect={(rail) => void submitCheckout(rail)}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4 gap-8">
      {merchantDisplayName ? (
        <ReferralCheckoutBranding
          displayName={merchantDisplayName}
          logoUrl={merchantLogoUrl}
          className="w-full max-w-md"
        />
      ) : null}
      {form}
      <ReferralPaymentMethodDialog
        open={methodDialogOpen}
        onOpenChange={setMethodDialogOpen}
        rails={paymentRails}
        loading={loading}
        onSelect={(rail) => void submitCheckout(rail)}
      />
    </div>
  );
}
