/**
 * Dashboard: assisted crypto verification — confidence, issues, optional merchant actions (no approval gate).
 */

'use client';

import * as React from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ExternalLink, Link2, Loader2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { buildExplorerUrl } from '@/lib/payments/crypto-confirmation-verification';

export type CryptoVerificationRow = {
  id: string;
  status: string;
  payerNetwork: string;
  payerAmountSent: string;
  payerWalletAddress: string;
  payerCurrency: string | null;
  payerTxHash: string | null;
  verificationStatus: string | null;
  matchConfidence: string | null;
  verificationIssues: string[];
  merchantInvestigationFlag: boolean;
  merchantAcknowledgedAt: string | null;
  createdAt: string;
  paymentLink: {
    id: string;
    shortCode: string;
    description: string;
    amount: number;
    currency: string;
    status: string;
    invoiceReference: string | null;
    cryptoNetwork: string | null;
    cryptoAddress: string | null;
    cryptoCurrency: string | null;
  };
};

interface PendingCryptoConfirmationsProps {
  organizationId: string | null;
  onChanged?: () => void;
}

function confidenceBadge(conf: string | null) {
  if (conf === 'HIGH') return <Badge className="bg-emerald-600 hover:bg-emerald-600">High confidence</Badge>;
  if (conf === 'MEDIUM') return <Badge variant="secondary">Medium confidence</Badge>;
  if (conf === 'LOW') return <Badge variant="destructive">Low confidence</Badge>;
  return <Badge variant="outline">—</Badge>;
}

export function PendingCryptoConfirmations({
  organizationId,
  onChanged,
}: PendingCryptoConfirmationsProps) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<CryptoVerificationRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState(false);
  const [acting, setActing] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch(`/api/payment-links/crypto-confirmations?organizationId=${organizationId}`);
      const json = (await res.json().catch(() => ({}))) as { data?: unknown; error?: string };
      if (!res.ok) {
        setRows([]);
        setLoadError(true);
        return;
      }
      const list = json.data;
      setRows(Array.isArray(list) ? (list as CryptoVerificationRow[]) : []);
    } catch {
      setRows([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, action: 'mark_valid' | 'flag_investigate' | 'acknowledge') => {
    setActing(`${id}:${action}`);
    try {
      const res = await fetch(`/api/payment-links/crypto-confirmations/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Request failed');
      toast({ title: 'Updated', description: json.message || 'Done.' });
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

  if (loadError && rows.length === 0 && !loading) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Crypto payment activity</CardTitle>
          <CardDescription>Could not load payer submissions right now.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading && rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Crypto payment activity</CardTitle>
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Crypto payment activity</CardTitle>
        <CardDescription>
          Payer submissions are recorded automatically. High-confidence matches need no action; flagged items are
          highlighted for your review.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((r) => {
          const rowBusy = acting != null && acting.split(':')[0] === r.id;
          const explorer =
            r.payerTxHash && r.paymentLink.cryptoNetwork
              ? buildExplorerUrl(r.paymentLink.cryptoNetwork, r.payerTxHash)
              : r.payerTxHash
                ? buildExplorerUrl(r.payerNetwork, r.payerTxHash)
                : null;
          const verifiedUi =
            r.verificationStatus === 'VERIFIED' && r.matchConfidence === 'HIGH' && r.verificationIssues.length === 0;

          return (
            <div key={r.id} className="rounded-lg border p-4 text-sm space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{r.paymentLink.description}</p>
                  <p className="text-muted-foreground">
                    Invoice {r.paymentLink.shortCode} · {r.paymentLink.amount} {r.paymentLink.currency}
                    <Badge variant="outline" className="ml-2 text-xs">
                      {r.paymentLink.status}
                    </Badge>
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/pay/${r.paymentLink.shortCode}`} target="_blank" rel="noopener noreferrer">
                    <Link2 className="h-3.5 w-3.5 mr-1" />
                    Pay page
                  </Link>
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {confidenceBadge(r.matchConfidence)}
                {r.verificationStatus ? (
                  <Badge variant="outline">{r.verificationStatus === 'VERIFIED' ? 'Checks OK' : 'Flagged'}</Badge>
                ) : null}
                {verifiedUi ? (
                  <span className="text-emerald-700 text-xs font-medium">Verified payment (no action required)</span>
                ) : null}
                {r.merchantInvestigationFlag ? (
                  <Badge variant="destructive">Investigation</Badge>
                ) : null}
                {r.merchantAcknowledgedAt ? (
                  <span className="text-xs text-muted-foreground">
                    Acknowledged {format(new Date(r.merchantAcknowledgedAt), 'PP')}
                  </span>
                ) : null}
              </div>

              {r.verificationIssues.length > 0 ? (
                <ul className="list-disc pl-5 text-amber-900/90 text-xs space-y-0.5 bg-amber-50 border border-amber-200 rounded-md py-2">
                  {r.verificationIssues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              ) : null}

              <dl className="grid gap-1 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Submitted</dt>
                  <dd>{format(new Date(r.createdAt), 'PPp')}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Payer network</dt>
                  <dd className="break-all">{r.payerNetwork}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Amount sent</dt>
                  <dd>{r.payerAmountSent}</dd>
                </div>
                {r.payerCurrency ? (
                  <div>
                    <dt className="text-muted-foreground">Payer asset</dt>
                    <dd>{r.payerCurrency}</dd>
                  </div>
                ) : null}
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Payer wallet</dt>
                  <dd className="break-all font-mono">{r.payerWalletAddress}</dd>
                </div>
                {r.payerTxHash ? (
                  <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                    <dt className="text-muted-foreground w-full">Transaction</dt>
                    <dd className="break-all font-mono">{r.payerTxHash}</dd>
                    {explorer ? (
                      <Button variant="link" className="h-auto p-0 text-xs" asChild>
                        <a href={explorer} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 mr-1 inline" />
                          Block explorer
                        </a>
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </dl>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={rowBusy}
                  onClick={() => act(r.id, 'acknowledge')}
                >
                  {acting === `${r.id}:acknowledge` ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Acknowledge
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={rowBusy}
                  onClick={() => act(r.id, 'flag_investigate')}
                >
                  {acting === `${r.id}:flag_investigate` ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Flag / investigate
                </Button>
                <Button size="sm" disabled={rowBusy} onClick={() => act(r.id, 'mark_valid')}>
                  {acting === `${r.id}:mark_valid` ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Mark as valid (→ Paid)
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
