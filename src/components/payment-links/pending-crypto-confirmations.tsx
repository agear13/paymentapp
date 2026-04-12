/**
 * Dashboard: pending payer-submitted crypto confirmations (approve / reject).
 */

'use client';

import * as React from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Loader2, Link2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export type PendingCryptoRow = {
  id: string;
  payerNetwork: string;
  payerAmountSent: string;
  payerWalletAddress: string;
  payerTxHash: string | null;
  createdAt: string;
  paymentLink: {
    id: string;
    shortCode: string;
    description: string;
    amount: number;
    currency: string;
    status: string;
    invoiceReference: string | null;
  };
};

interface PendingCryptoConfirmationsProps {
  organizationId: string | null;
  onChanged?: () => void;
}

export function PendingCryptoConfirmations({
  organizationId,
  onChanged,
}: PendingCryptoConfirmationsProps) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<PendingCryptoRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [acting, setActing] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/payment-links/crypto-confirmations?organizationId=${organizationId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setRows(json.data || []);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load pending confirmations';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [organizationId, toast]);

  React.useEffect(() => {
    load();
  }, [load]);

  const review = async (id: string, action: 'approve' | 'reject') => {
    setActing(id);
    try {
      const res = await fetch(`/api/payment-links/crypto-confirmations/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Request failed');
      toast({
        title: action === 'approve' ? 'Payment confirmed' : 'Confirmation rejected',
        description: json.message || 'Done.',
      });
      await load();
      onChanged?.();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Action failed';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setActing(null);
    }
  };

  if (!organizationId) return null;

  if (loading && rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending crypto confirmations</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) return null;

  return (
    <Card className="border-amber-200/80 bg-amber-50/40">
      <CardHeader>
        <CardTitle className="text-base">Pending crypto confirmations</CardTitle>
        <CardDescription>
          Customers said they sent crypto. Verify on-chain, then confirm or reject. Approving marks the invoice paid.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((r) => (
          <div
            key={r.id}
            className="rounded-lg border bg-background p-4 text-sm space-y-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{r.paymentLink.description}</p>
                <p className="text-muted-foreground">
                  {r.paymentLink.amount} {r.paymentLink.currency}
                  {r.paymentLink.invoiceReference ? ` · ${r.paymentLink.invoiceReference}` : ''}
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/pay/${r.paymentLink.shortCode}`} target="_blank" rel="noopener noreferrer">
                  <Link2 className="h-3.5 w-3.5 mr-1" />
                  Open pay page
                </Link>
              </Button>
            </div>
            <dl className="grid gap-1 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Submitted</dt>
                <dd>{format(new Date(r.createdAt), 'PPp')}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Network (payer)</dt>
                <dd className="break-all">{r.payerNetwork}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Amount sent (payer)</dt>
                <dd>{r.payerAmountSent}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Wallet (payer)</dt>
                <dd className="break-all font-mono">{r.payerWalletAddress}</dd>
              </div>
              {r.payerTxHash ? (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Tx hash</dt>
                  <dd className="break-all font-mono">{r.payerTxHash}</dd>
                </div>
              ) : null}
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={acting === r.id}
                onClick={() => review(r.id, 'approve')}
              >
                {acting === r.id ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Working…
                  </>
                ) : (
                  'Confirm payment'
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={acting === r.id}
                onClick={() => review(r.id, 'reject')}
              >
                Reject
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
