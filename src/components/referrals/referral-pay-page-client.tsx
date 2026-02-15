'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, Loader2 } from 'lucide-react';

interface CheckoutConfig {
  amount?: number;
  currency?: string;
  description?: string;
  title?: string;
}

interface Props {
  referralCode: string;
  checkoutConfig?: CheckoutConfig | null;
}

export function ReferralPayPageClient({ referralCode, checkoutConfig }: Props) {
  const config = (checkoutConfig as Record<string, unknown>) || {};
  const defaultAmount = Number(config.amount) || 100;
  const defaultCurrency = String(config.currency || 'AUD').toUpperCase().slice(0, 3);
  const defaultDescription = String(config.description || `Payment via referral ${referralCode}`);

  const [amount, setAmount] = useState<string>(String(defaultAmount));
  const [currency, setCurrency] = useState(defaultCurrency);
  const [description, setDescription] = useState(defaultDescription);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePayNow = async () => {
    setError('');
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
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
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Pay Now
          </CardTitle>
          <CardDescription>
            Complete your payment via referral code <strong>{referralCode}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
              placeholder="Payment description"
              disabled={loading}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <Button
            className="w-full"
            onClick={handlePayNow}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Redirecting to checkout…
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4" />
                Pay Now
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
