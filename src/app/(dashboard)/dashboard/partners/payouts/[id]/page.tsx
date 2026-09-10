'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { PAYOUTS_SETTLEMENTS_HREF } from '@/lib/navigation/operator-nav';
import { ArrowLeft, Copy, Check, Download, CheckCircle2, XCircle, Wallet } from 'lucide-react';
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
import { sendTransactionBytesForPayout } from '@/lib/hedera/wallet-client';
import { OperationalActivitySection } from '@/components/operations/operational-activity-section';
import {
  applyGlobalOperationalSync,
  useGlobalOperationalSyncHandlers,
} from '@/hooks/use-global-operational-sync';
import { useReleaseInteractionCapability } from '@/hooks/use-release-interaction-capability';
import { ReleaseInteractionNotice } from '@/components/payouts/release-interaction-notice';
import { PayoutRailBadge } from '@/components/payouts/payout-rail-badge';
import { PayoutStatusBadge } from '@/components/payouts/payout-status-badge';
import { PayoutRailComparison } from '@/components/payouts/payout-rail-comparison';
import { PayoutRailRecommendationCard } from '@/components/payouts/payout-rail-recommendation';
import { PayoutReviewSummary } from '@/components/payouts/payout-review-summary';
import { PayoutTimeline } from '@/components/payouts/payout-timeline';
import {
  formatPayoutDestination,
  formatPayoutRecipient,
} from '@/lib/payouts/payout-rail-presentation';
import { isPayoutRailId } from '@/lib/payouts/rails/types';
import { usePayoutRailReadiness } from '@/hooks/use-payout-rail-readiness';
import { presentPayoutStatus } from '@/lib/payouts/payout-status-presentation';
import { cn } from '@/lib/utils';

interface Payout {
  id: string;
  userId: string;
  currency: string;
  netAmount: number;
  status: string;
  railId?: string;
  destinationKind?: string | null;
  externalReference?: string;
  paidAt?: string;
  failedReason?: string;
  createdAt?: string;
  method?: {
    type: string;
    handle?: string;
    notes?: string;
    hederaAccountId?: string;
    details?: Record<string, unknown> | null;
  };
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
  const pathname = usePathname();
  const id = params?.id ?? '';
  const settlementsListHref = pathname?.includes('/dashboard/payouts/settlements')
    ? PAYOUTS_SETTLEMENTS_HREF
    : '/dashboard/partners/payouts';
  const { organizationId } = useOrganization();
  const railReadiness = usePayoutRailReadiness();
  const releaseInteraction = useReleaseInteractionCapability();
  const [batch, setBatch] = React.useState<Batch | null>(null);
  const [payouts, setPayouts] = React.useState<Payout[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [markPaidPayout, setMarkPaidPayout] = React.useState<Payout | null>(null);
  const [markFailedPayout, setMarkFailedPayout] = React.useState<Payout | null>(null);
  const [externalRef, setExternalRef] = React.useState('');
  const [failedReason, setFailedReason] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [hederaDialogOpen, setHederaDialogOpen] = React.useState(false);
  const [hederaPrepareData, setHederaPrepareData] = React.useState<{
    transactionBase64: string;
    merchantAccountId: string;
    summary: Array<{ userId: string; hederaAccountId: string; amount: string; symbol: string }>;
    includedPayoutIds: string[];
    totalAmount: string;
    tokenSymbol: string;
  } | null>(null);
  const [hederaSigning, setHederaSigning] = React.useState(false);
  const [selectedPayoutId, setSelectedPayoutId] = React.useState<string | null>(null);
  const syncHandlers = useGlobalOperationalSyncHandlers();
  const selectedPayout = payouts.find((payout) => payout.id === selectedPayoutId) ?? payouts[0] ?? null;
  const hasHederaPayouts = payouts.some(
    (payout) =>
      payout.railId === 'hedera' && payout.status !== 'PAID' && payout.status !== 'FAILED'
  );

  const fetchData = React.useCallback(async () => {
    if (!organizationId || !id || !releaseInteraction.canQueryReleaseHistory) return;
    setLoading(true);
    try {
      const [batchRes, payoutsRes] = await Promise.all([
        fetch(`/api/payout-batches/${id}?organizationId=${organizationId}`),
        fetch(`/api/payouts?organizationId=${organizationId}&batchId=${id}`),
      ]);
      const batchData = await batchRes.json();
      const payoutsData = await payoutsRes.json();
      if (batchRes.status === 403 || payoutsRes.status === 403) return;
      if (!batchRes.ok) throw new Error(batchData.error || 'Failed to fetch batch');
      if (!payoutsRes.ok) throw new Error(payoutsData.error || 'Failed to fetch payouts');

      setBatch(batchData.data || null);
      setPayouts(payoutsData.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [organizationId, id, releaseInteraction.canQueryReleaseHistory]);

  React.useEffect(() => {
    if (!releaseInteraction.canQueryReleaseHistory) {
      setBatch(null);
      setPayouts([]);
      setLoading(false);
      return;
    }
    void fetchData();
  }, [fetchData, releaseInteraction.canQueryReleaseHistory]);

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
      applyGlobalOperationalSync(syncHandlers, data);
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
      applyGlobalOperationalSync(syncHandlers, data);
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
      applyGlobalOperationalSync(syncHandlers, data);
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

  const handleExecuteHederaClick = async () => {
    if (!organizationId) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/payout-batches/${id}/hedera/prepare?organizationId=${organizationId}`,
        { method: 'POST' }
      );
      const json = await res.json();
      if (!res.ok) {
        const msg = json.missingPayeeUserIds?.length
          ? `Missing Hedera destination for payee(s): ${json.missingPayeeUserIds.join(', ')}`
          : json.error || 'Failed to prepare';
        throw new Error(msg);
      }
      const data = json.data;
      setHederaPrepareData({
        transactionBase64: data.transactionBase64,
        merchantAccountId: data.merchantAccountId,
        summary: data.summary,
        includedPayoutIds: data.includedPayoutIds ?? [],
        totalAmount: data.totalAmount,
        tokenSymbol: data.tokenSymbol,
      });
      setHederaDialogOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to prepare');
    } finally {
      setSubmitting(false);
    }
  };

  const handleHederaSign = async () => {
    if (!hederaPrepareData || !organizationId) return;
    setHederaSigning(true);
    try {
      const result = await sendTransactionBytesForPayout(
        hederaPrepareData.transactionBase64,
        hederaPrepareData.merchantAccountId
      );
      if (!result.success || !result.transactionId) {
        throw new Error(result.error || 'Signing failed');
      }
      const confirmRes = await fetch(`/api/payout-batches/${id}/hedera/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: result.transactionId,
          organizationId,
          includedPayoutIds: hederaPrepareData.includedPayoutIds,
        }),
      });
      const confirmData = await confirmRes.json();
      if (!confirmRes.ok) throw new Error(confirmData.error || 'Confirm failed');
      toast.success('Batch paid on Hedera');
      setHederaDialogOpen(false);
      setHederaPrepareData(null);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Signing or confirm failed');
    } finally {
      setHederaSigning(false);
    }
  };

  if (!releaseInteraction.canQueryReleaseHistory) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={settlementsListHref}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">Payout release detail</h1>
        </div>
        <ReleaseInteractionNotice state={releaseInteraction} />
      </div>
    );
  }

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
          <Link href={settlementsListHref}>
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
                Select a payout to review the destination, selected rail, and status timeline.
                Mark paid after the transfer, or mark failed to unassign and re-batch.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              {(batch.status === 'DRAFT' || batch.status === 'SUBMITTED') && hasHederaPayouts && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExecuteHederaClick}
                  disabled={submitting || payouts.filter((p) => p.status !== 'PAID' && p.status !== 'FAILED').length === 0}
                >
                  <Wallet className="h-4 w-4 mr-2" />
                  Execute in HashPack (USDC)
                </Button>
              )}
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
                <TableHead>Recipient</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Selected rail</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.map((p) => (
                <TableRow
                  key={p.id}
                  className={cn(
                    'cursor-pointer',
                    selectedPayout?.id === p.id && 'bg-muted/40'
                  )}
                  onClick={() => setSelectedPayoutId(p.id)}
                >
                  <TableCell className="font-mono text-sm">
                    {formatPayoutRecipient(p.userId)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {p.currency} {p.netAmount.toFixed(2)}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {formatPayoutDestination({
                      methodType: p.method?.type,
                      handle: p.method?.handle,
                      hederaAccountId: p.method?.hederaAccountId,
                      details: p.method?.details,
                    })}
                  </TableCell>
                  <TableCell>
                    <PayoutRailBadge railId={p.railId} />
                  </TableCell>
                  <TableCell>
                    <PayoutStatusBadge
                      status={p.status}
                      railId={p.railId}
                      failedReason={p.failedReason}
                    />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.paidAt ? new Date(p.paidAt).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(event) => {
                          event.stopPropagation();
                          copyPayoutDetails(p);
                        }}
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
                            onClick={(event) => {
                              event.stopPropagation();
                              setMarkPaidPayout(p);
                            }}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Mark paid
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              setMarkFailedPayout(p);
                            }}
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

      {selectedPayout ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Payout review</CardTitle>
              <CardDescription>
                {presentPayoutStatus({
                  status: selectedPayout.status,
                  railId: selectedPayout.railId,
                  failedReason: selectedPayout.failedReason,
                }).explanation}{' '}
                Provvy can route payouts across registered rails. Unconfigured rails stay visible
                as coming soon and cannot be executed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <PayoutReviewSummary
                recipient={selectedPayout.userId}
                amount={selectedPayout.netAmount}
                currency={selectedPayout.currency}
                methodType={selectedPayout.method?.type}
                destinationHandle={selectedPayout.method?.handle}
                hederaAccountId={selectedPayout.method?.hederaAccountId}
                destinationDetails={selectedPayout.method?.details}
                railId={selectedPayout.railId}
                merchantHederaReady={railReadiness.merchantHederaReady}
                merchantCregisReady={railReadiness.merchantCregisReady}
                merchantAirwallexReady={railReadiness.merchantAirwallexReady}
                requireAvailableRail={false}
                confirmLabel="Confirm mark paid"
                confirmDisabled={
                  selectedPayout.status === 'PAID' || selectedPayout.status === 'FAILED'
                }
                onConfirm={
                  selectedPayout.status === 'PAID' || selectedPayout.status === 'FAILED'
                    ? undefined
                    : () => setMarkPaidPayout(selectedPayout)
                }
              />
              <PayoutRailRecommendationCard
                currency={selectedPayout.currency}
                methodType={selectedPayout.method?.type}
                destinationHandle={selectedPayout.method?.handle}
                destinationDetails={selectedPayout.method?.details}
                payoutAmount={String(selectedPayout.netAmount)}
                merchantHederaReady={railReadiness.merchantHederaReady}
                merchantCregisReady={railReadiness.merchantCregisReady}
                merchantAirwallexReady={railReadiness.merchantAirwallexReady}
                selectedRailId={
                  selectedPayout.railId && isPayoutRailId(selectedPayout.railId)
                    ? selectedPayout.railId
                    : undefined
                }
              />
              <PayoutRailComparison
                currency={selectedPayout.currency}
                methodType={selectedPayout.method?.type}
                destinationHandle={selectedPayout.method?.handle}
                destinationDetails={selectedPayout.method?.details}
                payoutAmount={String(selectedPayout.netAmount)}
                merchantHederaReady={railReadiness.merchantHederaReady}
                merchantCregisReady={railReadiness.merchantCregisReady}
                merchantAirwallexReady={railReadiness.merchantAirwallexReady}
                selectedRailId={
                  selectedPayout.railId && isPayoutRailId(selectedPayout.railId)
                    ? selectedPayout.railId
                    : undefined
                }
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Payout timeline</CardTitle>
              <CardDescription>
                Canonical states stay Draft → Submitted → Processing → Paid or Failed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PayoutTimeline
                status={selectedPayout.status}
                railId={selectedPayout.railId}
                createdAt={selectedPayout.createdAt}
                paidAt={selectedPayout.paidAt}
                failedReason={selectedPayout.failedReason}
              />
            </CardContent>
          </Card>
        </div>
      ) : null}

      <OperationalActivitySection
        title="Release activity"
        emptyMessage="Payout release and funding events appear here as this batch progresses."
        defaultOpen={false}
      />

      <Dialog open={!!markPaidPayout} onOpenChange={(o) => !o && setMarkPaidPayout(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm payout as paid</DialogTitle>
            <DialogDescription>
              Review the selected rail and destination, then record the external reference.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {markPaidPayout ? (
              <PayoutReviewSummary
                recipient={markPaidPayout.userId}
                amount={markPaidPayout.netAmount}
                currency={markPaidPayout.currency}
                methodType={markPaidPayout.method?.type}
                destinationHandle={markPaidPayout.method?.handle}
                hederaAccountId={markPaidPayout.method?.hederaAccountId}
                destinationDetails={markPaidPayout.method?.details}
                railId={markPaidPayout.railId}
                merchantHederaReady={railReadiness.merchantHederaReady}
                merchantCregisReady={railReadiness.merchantCregisReady}
                merchantAirwallexReady={railReadiness.merchantAirwallexReady}
                requireAvailableRail={false}
              />
            ) : null}
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
              {submitting ? 'Saving...' : 'Confirm paid'}
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

      <Dialog
        open={hederaDialogOpen}
        onOpenChange={(o) => {
          setHederaDialogOpen(o);
          if (!o) setHederaPrepareData(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Execute in HashPack (USDC)</DialogTitle>
            <DialogDescription>
              Review the summary below. You will sign and submit this transaction in HashPack (merchant account).
            </DialogDescription>
          </DialogHeader>
          {hederaPrepareData && (
            <div className="space-y-4">
              <div className="rounded-md border p-3 text-sm space-y-1 max-h-40 overflow-y-auto">
                {hederaPrepareData.summary.map((s, i) => (
                  <div key={i}>
                    {s.hederaAccountId}: {hederaPrepareData.tokenSymbol} {s.amount}
                  </div>
                ))}
              </div>
              <p className="font-medium">
                Total: {hederaPrepareData.tokenSymbol} {hederaPrepareData.totalAmount}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setHederaDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleHederaSign} disabled={hederaSigning}>
              {hederaSigning ? 'Signing...' : 'Sign in HashPack'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
