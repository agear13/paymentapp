'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Copy, Check, Download, CheckCircle2, XCircle } from 'lucide-react';
import { useOrganization } from '@/hooks/use-organization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface Payout {
  id: string;
  userId: string;
  currency: string;
  netAmount: number;
  status: string;
  externalReference?: string;
  paidAt?: string;
  failedReason?: string;
  method?: { type: string; handle?: string; notes?: string };
}

interface Batch {
  id: string;
  currency: string;
  status: string;
  payoutCount: number;
  totalAmount: number;
  createdAt: string;
}

export default function PayoutBatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { organizationId } = useOrganization();
  const [batch, setBatch] = React.useState<Batch | null>(null);
  const [payouts, setPayouts] = React.useState<Payout[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [markPaidPayout, setMarkPaidPayout] = React.useState<Payout | null>(null);
  const [markFailedPayout, setMarkFailedPayout] = React.useState<Payout | null>(null);
  const [externalRef, setExternalRef] = React.useState('');
  const [failedReason, setFailedReason] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    if (!organizationId || !id) return;
    setLoading(true);
    try {
      const [batchRes, payoutsRes] = await Promise.all([
        fetch(`/api/payout-batches/${id}?organizationId=${organizationId}`),
        fetch(`/api/payouts?organizationId=${organizationId}&batchId=${id}`),
      ]);
      const batchData = await batchRes.json();
      const payoutsData = await payoutsRes.json();
      if (!batchRes.ok) throw new Error(batchData.error || 'Failed to fetch batch');
      if (!payoutsRes.ok) throw new Error(payoutsData.error || 'Failed to fetch payouts');

      setBatch(batchData.data || null);
      setPayouts(payoutsData.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [organizationId, id]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const copyPayoutDetails = (p: Payout) => {
    const text = [
      `Payee: ${p.userId}`,
      `Method: ${p.method?.type ?? 'N/A'}`,
      `Handle: ${p.method?.handle ?? 'N/A'}`,
      `Notes: ${p.method?.notes ?? 'N/A'}`,
      `Amount: ${p.currency} ${p.netAmount.toFixed(2)}`,
    ].join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(p.id);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleMarkPaid = async () => {
    if (!markPaidPayout || !externalRef.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/payouts/${markPaidPayout.id}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ external_reference: externalRef.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to mark paid');
      toast.success('Payout marked as paid');
      setMarkPaidPayout(null);
      setExternalRef('');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkFailed = async () => {
    if (!markFailedPayout || !failedReason.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/payouts/${markFailedPayout.id}/mark-failed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ failed_reason: failedReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to mark failed');
      toast.success('Payout marked as failed');
      setMarkFailedPayout(null);
      setFailedReason('');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitBatch = async () => {
    if (!organizationId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/payout-batches/${id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit');
      toast.success('Batch submitted');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = () => {
    window.open(`/api/payout-batches/${id}/export`, '_blank', 'noopener');
  };

  if (loading || !batch) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Batch detail</h1>
        <p className="text-muted-foreground">{loading ? 'Loading...' : 'Batch not found'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/partners/payouts">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Batch {batch.id.slice(0, 8)}</h1>
          <p className="text-muted-foreground">
            {batch.currency} · {batch.payoutCount} payouts · {batch.totalAmount.toFixed(2)} total
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Payouts</CardTitle>
              <CardDescription>
                Mark each payout as paid after transfer. Mark failed to unassign and re-batch.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              {batch.status === 'DRAFT' && (
                <Button size="sm" onClick={handleSubmitBatch} disabled={submitting}>
                  Submit batch
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payee</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Handle / Notes</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-sm">{p.userId.slice(0, 8)}...</TableCell>
                  <TableCell>{p.method?.type ?? '—'}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {p.method?.handle || p.method?.notes || '—'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {p.currency} {p.netAmount.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        p.status === 'PAID'
                          ? 'default'
                          : p.status === 'FAILED'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyPayoutDetails(p)}
                        title="Copy details"
                      >
                        {copiedId === p.id ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      {p.status !== 'PAID' && p.status !== 'FAILED' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setMarkPaidPayout(p)}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Mark paid
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setMarkFailedPayout(p)}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Mark failed
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!markPaidPayout} onOpenChange={(o) => !o && setMarkPaidPayout(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark payout paid</DialogTitle>
            <DialogDescription>
              Enter the external reference (e.g. bank transfer ref, PayPal batch ID).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="extRef">External reference</Label>
              <Input
                id="extRef"
                value={externalRef}
                onChange={(e) => setExternalRef(e.target.value)}
                placeholder="e.g. TRF-12345"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkPaidPayout(null)}>
              Cancel
            </Button>
            <Button onClick={handleMarkPaid} disabled={submitting || !externalRef.trim()}>
              {submitting ? 'Saving...' : 'Mark paid'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!markFailedPayout} onOpenChange={(o) => !o && setMarkFailedPayout(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark payout failed</DialogTitle>
            <DialogDescription>
              Obligation lines will be unassigned for re-batching.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="failReason">Reason (required)</Label>
              <Textarea
                id="failReason"
                value={failedReason}
                onChange={(e) => setFailedReason(e.target.value)}
                placeholder="e.g. Invalid bank details"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkFailedPayout(null)}>
              Cancel
            </Button>
            <Button onClick={handleMarkFailed} disabled={submitting || !failedReason.trim()}>
              {submitting ? 'Saving...' : 'Mark failed'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
