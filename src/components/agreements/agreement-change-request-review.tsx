'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';
import type { ReferralManagementContext } from '@/lib/workflows/referral-management/hub.server';

type PendingChange = NonNullable<
  ReferralManagementContext['promoters'][number]['pendingChangeRequests']
>[number];

type Props = {
  workflowId: string;
  participantId: string;
  participantName: string;
  agreementTitle?: string;
  requests: PendingChange[];
  busy?: boolean;
  onReviewed?: (context?: ReferralManagementContext) => void;
};

export function AgreementChangeRequestReview({
  workflowId,
  participantId,
  participantName,
  agreementTitle = 'Affiliate Agreement',
  requests,
  busy = false,
  onReviewed,
}: Props) {
  const [reviewNote, setReviewNote] = React.useState('');
  const [submittingId, setSubmittingId] = React.useState<string | null>(null);

  if (requests.length === 0) return null;

  async function review(requestId: string, decision: 'approve' | 'reject' | 'request_clarification') {
    setSubmittingId(requestId);
    try {
      const res = await csrfAwareFetch(
        `/api/workflows/${workflowId}/referrals/promoters/${participantId}/change-requests/${requestId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ decision, reviewNote }),
        }
      );
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        context?: ReferralManagementContext;
      };
      if (!res.ok) {
        throw new Error(payload.error || 'Could not review change');
      }
      toast.success(
        decision === 'approve'
          ? 'Change approved. A new agreement version has been sent.'
          : decision === 'reject'
            ? 'Suggested change rejected.'
            : 'Clarification requested.'
      );
      setReviewNote('');
      onReviewed?.(payload.context);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not review change');
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-4">
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-wide text-amber-800">
          Agreement change request
        </p>
        <p className="mt-1 text-sm text-foreground">
          {requests.length === 1
            ? '1 agreement change awaiting review'
            : `${requests.length} agreement changes awaiting review`}
        </p>
      </div>
      {requests.map((request) => (
        <div key={request.id} className="rounded-lg border border-border bg-background p-4 space-y-3">
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Affiliate</p>
              <p className="font-medium">{participantName}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Agreement</p>
              <p className="font-medium">{agreementTitle}</p>
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Requested change</p>
            <p className="text-sm font-medium mt-1">{request.fieldLabel}</p>
            <p className="text-sm mt-2">
              <span className="text-muted-foreground">Current: </span>
              {request.previousValue || '—'}
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Suggested: </span>
              {request.suggestedValue}
            </p>
            <p className="text-sm mt-2">
              <span className="text-muted-foreground">Reason: </span>
              {request.reason}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {request.classification === 'commercial'
                ? 'Commercial change — approval is required before terms update.'
                : 'Administrative correction — still requires your approval.'}
            </p>
          </div>
          <Textarea
            value={reviewNote}
            onChange={(event) => setReviewNote(event.target.value)}
            placeholder="Optional note, or a clarification question"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy || submittingId === request.id}
              onClick={() => void review(request.id, 'approve')}
            >
              Approve change
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || submittingId === request.id}
              onClick={() => void review(request.id, 'reject')}
            >
              Reject change
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy || submittingId === request.id || !reviewNote.trim()}
              onClick={() => void review(request.id, 'request_clarification')}
            >
              Request clarification
            </Button>
          </div>
        </div>
      ))}
    </section>
  );
}
