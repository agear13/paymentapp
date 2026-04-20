/**
 * Dashboard: manual bank transfer submissions for verify-after-send pilot flow.
 */

'use client';

import * as React from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Link2, Loader2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

export type ManualBankVerificationRow = {
  id: string;
  status: string;
  payerAmountSent: string;
  payerCurrency: string | null;
  payerDestination: string | null;
  payerPaymentMethodUsed: string | null;
  payerReference: string | null;
  payerProofDetails: string | null;
  payerNote: string | null;
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
    destinationType: string | null;
    recipientName: string | null;
    paymentCurrency: string | null;
  };
};

function confidenceBadge(conf: string | null) {
  if (conf === 'HIGH') return <Badge className="bg-emerald-600 hover:bg-emerald-600">High confidence</Badge>;
  if (conf === 'MEDIUM') return <Badge variant="secondary">Medium confidence</Badge>;
  if (conf === 'LOW') return <Badge variant="destructive">Low confidence</Badge>;
  return <Badge variant="outline">—</Badge>;
}

interface PendingManualBankConfirmationsProps {
  organizationId: string | null;
  onChanged?: () => void;
}

export function PendingManualBankConfirmations({
  organizationId,
  onChanged,
}: PendingManualBankConfirmationsProps) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<ManualBankVerificationRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [acting, setActing] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/payment-links/manual-bank-confirmations?organizationId=${organizationId}`);
      const json = (await res.json().catch(() => ({}))) as { data?: unknown };
      const list = json.data;
      setRows(Array.isArray(list) ? (list as ManualBankVerificationRow[]) : []);
    } catch {
      setRows([]);
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
      const res = await fetch(`/api/payment-links/manual-bank-confirmations/${id}/review`, {
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
  if (loading && rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manual bank payment activity</CardTitle>
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
        <CardTitle className="text-base">Manual bank payment activity</CardTitle>
        <CardDescription>
          Payer submissions are recorded automatically. Mark valid to finalize Paid, or flag for investigation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((r) => {
          const rowBusy = acting != null && acting.split(':')[0] === r.id;
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

              <dl className="grid gap-1 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Submitted</dt>
                  <dd>{format(new Date(r.createdAt), 'PPp')}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Amount sent</dt>
                  <dd>{r.payerAmountSent}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Method used</dt>
                  <dd>{r.payerPaymentMethodUsed || '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Submitted currency</dt>
                  <dd>{r.payerCurrency || '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Submitted destination</dt>
                  <dd>{r.payerDestination || '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Payer reference</dt>
                  <dd>{r.payerReference || '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Destination type</dt>
                  <dd>{r.paymentLink.destinationType || '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Recipient</dt>
                  <dd>{r.paymentLink.recipientName || '—'}</dd>
                </div>
                {r.payerProofDetails ? (
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground">Proof details</dt>
                    <dd className="whitespace-pre-wrap">{r.payerProofDetails}</dd>
                  </div>
                ) : null}
                {r.payerNote ? (
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground">Payer note</dt>
                    <dd className="whitespace-pre-wrap">{r.payerNote}</dd>
                  </div>
                ) : null}
              </dl>
              <div className="flex flex-wrap items-center gap-2">
                {confidenceBadge(r.matchConfidence)}
                {r.verificationStatus ? (
                  <Badge variant="outline">{r.verificationStatus === 'VERIFIED' ? 'Checks OK' : 'Flagged'}</Badge>
                ) : null}
              </div>
              {r.verificationIssues.length > 0 ? (
                <ul className="list-disc pl-5 text-amber-900/90 text-xs space-y-0.5 bg-amber-50 border border-amber-200 rounded-md py-2">
                  {r.verificationIssues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              ) : null}

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
                  {r.paymentLink.status === 'PAID_UNVERIFIED' ? 'Confirm payment' : 'Acknowledge'}
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
                  {r.paymentLink.status === 'REQUIRES_REVIEW' ? 'Reject / investigate' : 'Mark as incorrect'}
                </Button>
                <Button size="sm" disabled={rowBusy} onClick={() => act(r.id, 'mark_valid')}>
                  {acting === `${r.id}:mark_valid` ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {r.paymentLink.status === 'REQUIRES_REVIEW' ? 'Confirm anyway (→ Paid)' : 'Confirm payment (→ Paid)'}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

