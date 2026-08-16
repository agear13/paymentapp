'use client';

import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ManualReconciliationReviewItem } from '@/lib/treasury/reconciliation/manual-link-review';

export type ManualReconciliationEventDetail = ManualReconciliationReviewItem['sourceEvent'];

export type ManualLinkSuccess = {
  linkId: string;
  auditId: string;
  manualReconciliation: {
    linkId: string;
    auditId: string;
    linkedAt: string;
    linkedByUserId: string;
    notes: string | null;
    linkStatus: string;
    manual: true;
    sourceEventId: string;
    targetEventId: string;
  };
};

function formatEventType(type: string): string {
  return type.replaceAll('_', ' ').toLowerCase();
}

function EventDetailCard({
  title,
  event,
}: {
  title: string;
  event: ManualReconciliationEventDetail;
}) {
  return (
    <div className="rounded-xl border border-border bg-secondary/20 p-4 text-[13px]">
      <div className="font-semibold capitalize">{title}</div>
      <div className="mt-2 grid gap-1 text-[12px]">
        <div>
          <span className="text-ink-soft">Type:</span> {formatEventType(event.eventType)}
        </div>
        <div>
          <span className="text-ink-soft">Amount:</span>{' '}
          <span className="font-mono">
            {event.amount ?? '—'} {event.asset ?? ''}
            {event.destinationAmount
              ? ` → ${event.destinationAmount} ${event.destinationAsset ?? 'AUD'}`
              : ''}
          </span>
        </div>
        <div>
          <span className="text-ink-soft">Provider:</span> {event.provider.replaceAll('_', ' ')}
        </div>
        <div>
          <span className="text-ink-soft">When:</span>{' '}
          {format(new Date(event.occurredAt), 'dd MMM yyyy HH:mm')}
        </div>
        {event.transactionHash ? (
          <div>
            <span className="text-ink-soft">Transaction:</span>{' '}
            <span className="font-mono">{event.transactionHash}</span>
          </div>
        ) : null}
        {event.providerReference ? (
          <div>
            <span className="text-ink-soft">Reference:</span>{' '}
            <span className="font-mono">{event.providerReference}</span>
          </div>
        ) : null}
        <div>
          <span className="text-ink-soft">Status:</span> {event.status}
        </div>
        {event.existingEvidence ? (
          <div>
            <span className="text-ink-soft">Existing evidence:</span>{' '}
            {event.existingEvidence.manual
              ? 'Manual link'
              : (event.existingEvidence.strategy ?? 'Linked')}{' '}
            ({event.existingEvidence.linkStatus})
          </div>
        ) : (
          <div className="text-ink-soft">No automatic link evidence</div>
        )}
        {event.manualReconciliation ? (
          <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-emerald-900">
            Manually reconciled · {format(new Date(event.manualReconciliation.linkedAt), 'dd MMM yyyy HH:mm')}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type TreasuryManualReconciliationDialogProps = {
  organizationId: string;
  item: ManualReconciliationReviewItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinked: () => void;
};

export function TreasuryManualReconciliationDialog({
  organizationId,
  item,
  open,
  onOpenChange,
  onLinked,
}: TreasuryManualReconciliationDialogProps) {
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<ManualLinkSuccess | null>(null);

  useEffect(() => {
    if (!item) return;
    setSelectedTargetId(item.candidateTargetEvents[0]?.id ?? null);
    setNotes('');
    setConfirmed(false);
    setError(null);
    setSuccess(null);
  }, [item]);

  const submit = useCallback(async () => {
    if (!item || !selectedTargetId || !confirmed) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/treasury/manual-link?organizationId=${encodeURIComponent(organizationId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceEventId: item.sourceEvent.id,
            targetEventId: selectedTargetId,
            confirmLink: true,
            notes: notes.trim() || undefined,
          }),
        }
      );
      const data = (await res.json()) as ManualLinkSuccess & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to create manual link');
      }
      setSuccess(data);
      onLinked();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create manual link');
    } finally {
      setSubmitting(false);
    }
  }, [confirmed, item, notes, onLinked, organizationId, selectedTargetId]);

  if (!item) return null;

  const selectedTarget =
    item.candidateTargetEvents.find((c) => c.id === selectedTargetId) ??
    item.candidateTargetEvents[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review &amp; link treasury events</DialogTitle>
          <DialogDescription>
            {item.invoiceReference ? `${item.invoiceReference} · ` : ''}
            Manual reconciliation preserves provider facts and records an audit trail.
          </DialogDescription>
        </DialogHeader>

        {success?.manualReconciliation ? (
          <div className="space-y-3 text-[13px]">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
              <div className="font-semibold">Manually reconciled</div>
              <p className="mt-1">
                Linked by {success.manualReconciliation.linkedByUserId} at{' '}
                {format(new Date(success.manualReconciliation.linkedAt), 'dd MMM yyyy HH:mm')}
              </p>
              {success.manualReconciliation.notes ? (
                <p className="mt-1 text-[12px]">Note: {success.manualReconciliation.notes}</p>
              ) : null}
              <p className="mt-2 text-[12px]">
                Link status: {success.manualReconciliation.linkStatus} · Manual evidence preserved
              </p>
            </div>
            <DialogFooter>
              <button
                type="button"
                className="rounded-xl bg-accent px-4 py-2 text-[13px] font-medium text-accent-foreground"
                onClick={() => onOpenChange(false)}
              >
                Done
              </button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 text-[13px]">
            <div className="rounded-xl border border-border p-4">
              <div className="font-semibold capitalize">
                {item.exception.type.replaceAll('_', ' ')}
              </div>
              <p className="mt-2">
                <span className="font-medium">Observed:</span> {item.exception.observed}
              </p>
              <p className="mt-1">
                <span className="font-medium">Expected:</span> {item.exception.expected}
              </p>
              <p className="mt-1">
                <span className="font-medium">Why automatic reconciliation failed:</span>{' '}
                {item.autoLinkFailureReason}
              </p>
              <p className="mt-1 text-ink-soft">{item.exception.suggestedAction}</p>
            </div>

            <EventDetailCard title="Source event" event={item.sourceEvent} />

            {item.candidateTargetEvents.length > 1 ? (
              <div className="space-y-2">
                <div className="font-semibold">Select target event</div>
                {item.candidateTargetEvents.map((candidate) => (
                  <label
                    key={candidate.id}
                    className="flex cursor-pointer items-start gap-2 rounded-xl border border-border p-3"
                  >
                    <input
                      type="radio"
                      name="target-event"
                      checked={selectedTargetId === candidate.id}
                      onChange={() => setSelectedTargetId(candidate.id)}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium capitalize">
                        {formatEventType(candidate.eventType)}
                      </div>
                      <div className="font-mono text-[11px] text-ink-soft">
                        {candidate.amount ?? '—'} {candidate.asset ?? ''} · {candidate.provider}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            ) : selectedTarget ? (
              <EventDetailCard title="Target event" event={selectedTarget} />
            ) : null}

            <label className="flex flex-col gap-1 text-[12px]">
              Reconciliation note (optional)
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={2000}
                className="rounded-xl border border-border bg-background px-3 py-2 text-[13px]"
                placeholder="Why you are linking these events…"
              />
            </label>

            <label className="flex items-start gap-2 text-[12px]">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I confirm this manual link is correct. Provvy will record my user identity and this
                note in the audit trail. This will not manufacture bank settlement or overwrite
                provider facts.
              </span>
            </label>

            {error ? <p className="text-[12px] text-red-600">{error}</p> : null}

            <DialogFooter className="gap-2 sm:gap-0">
              <button
                type="button"
                className="rounded-xl border border-border px-4 py-2 text-[13px]"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-[13px] font-medium text-accent-foreground disabled:opacity-50"
                disabled={submitting || !confirmed || !selectedTargetId}
                onClick={() => void submit()}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Confirm manual link
              </button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
