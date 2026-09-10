'use client';

import * as React from 'react';
import { ArrowLeft, CheckCircle2, XCircle, Send } from 'lucide-react';
import Link from 'next/link';

import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import { SupplierOnboardingOperatorView } from '@/components/commercial/supplier-onboarding/supplier-onboarding-operator-view';
import {
  buildSupplierOnboardingInput,
  hasSubmittedOnboarding,
  isOnboardingRejected,
  getOnboardingRejectionReason,
  buildCommercialReviewSummary,
  deriveLifecycleStatus,
} from '@/lib/commercial/build-supplier-onboarding-input';
import { deriveSupplierOnboardingStatus } from '@/lib/commercial/supplier-onboarding';
import { ParticipantLifecycleTimeline } from '@/components/commercial/payment-tax/participant-lifecycle-timeline';
import { AgreementSummary } from '@/components/commercial/payment-tax/agreement-summary';
import { buildAgreementSummaryData } from '@/lib/commercial/participant-commercial-lifecycle';
import { AccountingReconciliationCard } from '@/components/commercial/accounting-reconciliation-card';
import { reconcileSupplierInvoiceToObligations } from '@/lib/commercial/accounting-reconciliation';
import { deriveSupplierReviewSettlementActions } from '@/lib/commercial/supplier-review-settlement-actions';
import {
  opSurfaceAction,
  opSurfaceCritical,
  opSurfaceInfo,
  opSurfaceSuccess,
  opToneDanger,
  opToneSuccess,
  opToneWarning,
} from '@/lib/design/operational-surfaces';
import { cn } from '@/lib/utils';

/**
 * Operator supplier-onboarding review.
 * Dashboard and Commercial OS pass surface-specific backHref / accountingHref.
 */
export function SupplierOnboardingReviewScreen({
  participantId,
  backHref,
  accountingHref,
  accountingLinkLabel = 'View in Funding tab',
}: {
  participantId: string;
  backHref: string;
  accountingHref: string;
  accountingLinkLabel?: string;
}) {
  const { deal, allParticipants, refresh } = useProjectWorkspace();

  const participant = React.useMemo(
    () => allParticipants?.find((p) => p.id === participantId) ?? null,
    [allParticipants, participantId]
  );

  const [isActing, setIsActing] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [xeroStatus, setXeroStatus] = React.useState<{
    connected: boolean;
    stale?: boolean;
    reauthorizationRequired?: boolean;
  } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void fetch('/api/xero/status')
      .then(async (res) => {
        if (!res.ok) return { connected: false as const };
        return (await res.json()) as {
          connected?: boolean;
          stale?: boolean;
          reauthorizationRequired?: boolean;
        };
      })
      .then((data) => {
        if (cancelled) return;
        setXeroStatus({
          connected: data.connected === true,
          stale: data.stale,
          reauthorizationRequired: data.reauthorizationRequired,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setXeroStatus({ connected: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const accountingReconciliation = React.useMemo(() => {
    if (!participant?.paymentSetup?.draftInvoice) return null;
    return reconcileSupplierInvoiceToObligations({
      invoice: participant.paymentSetup.draftInvoice,
      obligationLines: [
        {
          id: `${participant.id}:supplier-bill`,
          amount: participant.paymentSetup.draftInvoice.total,
          currency: participant.paymentSetup.draftInvoice.currency,
          label: 'Supplier bill payable',
          invoiceBacked: true,
        },
      ],
    });
  }, [participant]);

  const lifecycle = participant ? deriveLifecycleStatus(participant) : null;

  const handleApprove = async (): Promise<boolean> => {
    setIsActing(true);
    setActionError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(
        `/api/deal-network-pilot/participants/${participantId}/supplier-onboarding/approve`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Approval failed. Please try again.');
      }
      setSuccessMessage('Supplier details verified.');
      void refresh({ scope: 'all', silent: true, force: true });
      return true;
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Something went wrong.');
      return false;
    } finally {
      setIsActing(false);
    }
  };

  const handleXeroExport = async (): Promise<boolean> => {
    setIsActing(true);
    setActionError(null);
    setSuccessMessage(null);
    try {
      if (accountingReconciliation && !accountingReconciliation.releaseAllowed) {
        throw new Error(accountingReconciliation.reason);
      }
      const xeroRes = await fetch(
        `/api/deal-network-pilot/participants/${participantId}/xero-export`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }
      );
      if (!xeroRes.ok) {
        const data = await xeroRes.json().catch(() => ({}));
        throw new Error(data.error ?? 'Supplier bill push failed. Please retry.');
      }
      setSuccessMessage('Supplier bill pushed to Xero successfully.');
      void refresh({ scope: 'all', silent: true, force: true });
      return true;
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Something went wrong.');
      return false;
    } finally {
      setIsActing(false);
    }
  };

  const handleResend = async () => {
    setIsActing(true);
    setActionError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(
        `/api/deal-network-pilot/participants/${participantId}/supplier-onboarding/resend`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? 'Could not resend link. Please try again.');
      }
      setSuccessMessage(data.message ?? 'Payment setup link resent.');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsActing(false);
    }
  };

  const handleReject = async (reason: string) => {
    setIsActing(true);
    setActionError(null);
    try {
      const res = await fetch(
        `/api/deal-network-pilot/participants/${participantId}/supplier-onboarding/reject`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Rejection failed. Please try again.');
      }
      void refresh({ scope: 'all', silent: true, force: true });
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsActing(false);
    }
  };

  const handleRequestChanges = async (requestedChanges: string) => {
    setIsActing(true);
    setActionError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(
        `/api/deal-network-pilot/participants/${participantId}/supplier-onboarding/request-changes`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestedChanges }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Could not request changes. Please try again.');
      }
      setSuccessMessage('Changes requested — a new payment & tax link has been sent to the participant.');
      void refresh({ scope: 'all', silent: true, force: true });
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsActing(false);
    }
  };

  if (!participant || !deal) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <div className="rounded-lg border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">Loading review…</p>
        </div>
      </div>
    );
  }

  const isRejected = isOnboardingRejected(participant);
  const rejectionReason = getOnboardingRejectionReason(participant);

  if (!hasSubmittedOnboarding(participant) && lifecycle !== 'REJECTED') {
    return (
      <div className="max-w-xl mx-auto py-8 px-4">
        <div className="mb-4">
          <Link
            href={backHref}
            data-testid="review-back-link"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to participants
          </Link>
        </div>
        <div className={cn(opSurfaceAction, 'p-6 space-y-3')}>
          <p className={cn('text-sm font-medium', opToneWarning)}>Supplier hasn't submitted yet</p>
          <p className={cn('text-sm', opToneWarning)}>
            {participant.name} has not completed their payment information. Once they submit,
            you'll be able to review and approve their details here.
          </p>
          {actionError && (
            <p className={cn('text-xs', opToneDanger)}>{actionError}</p>
          )}
          {successMessage && (
            <p className={cn('text-xs', opToneSuccess)}>{successMessage}</p>
          )}
          <button
            type="button"
            onClick={handleResend}
            disabled={isActing}
            className={cn('inline-flex items-center gap-1.5 text-sm font-medium hover:underline disabled:opacity-50', opToneWarning)}
          >
            <Send className="h-3.5 w-3.5" />
            {isActing ? 'Sending…' : 'Resend payment setup link'}
          </button>
        </div>
      </div>
    );
  }

  const input = buildSupplierOnboardingInput(participant, { id: deal.id, name: deal.dealName ?? '' });
  const status = deriveSupplierOnboardingStatus(input);
  const reviewSummary = buildCommercialReviewSummary(participant, { id: deal.id, name: deal.dealName ?? '' });
  const reviewActions = deriveSupplierReviewSettlementActions({
    lifecycle: lifecycle ?? '',
    xeroConnected: xeroStatus ? xeroStatus.connected : null,
    xeroStale: xeroStatus?.stale,
    xeroReauthorizationRequired: xeroStatus?.reauthorizationRequired,
  });

  return (
    <div className="max-w-xl mx-auto py-8 px-4" data-testid="supplier-onboarding-review-screen">
      <div className="mb-6">
        <Link
          href={backHref}
          data-testid="review-back-link"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to participants
        </Link>
        <div>
          <h1 className="text-xl font-semibold">Verify Payout Details</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Verify {participant.name}'s agreement summary, payment method, and tax details.
          </p>
        </div>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <AgreementSummary
          summary={buildAgreementSummaryData(participant, {
            id: deal.id,
            name: deal.dealName ?? '',
          })}
        />
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold mb-3">Lifecycle</h2>
          <ParticipantLifecycleTimeline participant={participant} />
        </div>
      </div>

      {isRejected && rejectionReason && (
        <div className={cn(opSurfaceCritical, 'mb-4 p-4 flex gap-3')}>
          <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className={cn('text-sm font-medium', opToneDanger)}>Changes requested</p>
            <p className={cn('text-sm mt-0.5', opToneDanger)}>{rejectionReason}</p>
            <p className={cn('text-xs mt-1.5', opToneDanger)}>
              A new payment setup link has been sent to {participant.name} so they can resubmit after making corrections.
            </p>
            <button
              type="button"
              onClick={handleResend}
              disabled={isActing}
              className={cn('mt-2 inline-flex items-center gap-1.5 text-xs font-medium hover:underline disabled:opacity-50', opToneDanger)}
            >
              <Send className="h-3 w-3" />
              Resend payment setup link
            </button>
          </div>
        </div>
      )}

      {actionError && (
        <div className={cn(opSurfaceCritical, 'mb-4 px-4 py-3 text-sm', opToneDanger)}>
          {actionError}
        </div>
      )}

      {successMessage && (
        <div className={cn(opSurfaceSuccess, 'mb-4 px-4 py-3 text-sm flex items-center gap-2', opToneSuccess)}>
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {successMessage}
        </div>
      )}

      <SupplierOnboardingOperatorView
        status={status}
        participant={participant}
        reviewSummary={reviewSummary}
        onReject={handleReject}
        onRequestChanges={handleRequestChanges}
        isLoading={isActing}
      />

      {accountingReconciliation && (
        <div className="mt-4">
          <AccountingReconciliationCard reconciliation={accountingReconciliation} />
        </div>
      )}

      {(lifecycle === 'SUBMITTED' || lifecycle === 'APPROVED') && (
        <div className={cn(opSurfaceInfo, 'mt-4 p-4 space-y-3')}>
          <div>
            <p className={cn('text-sm font-medium', 'text-blue-800 dark:text-blue-300')}>
              {lifecycle === 'APPROVED'
                ? 'Supplier details verified'
                : 'Verify supplier details'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {lifecycle === 'APPROVED'
                ? 'Payout details are approved. Settlement readiness follows funding and the existing payment gates — Xero export is optional accounting.'
                : 'Verify these payout details to complete operator approval. This does not export to Xero.'}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {reviewActions.showVerifyAction && (
              <button
                type="button"
                data-testid="verify-supplier-details-button"
                onClick={() => void handleApprove()}
                disabled={isActing}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {isActing ? 'Verifying…' : reviewActions.verifyLabel}
                {!isActing && <CheckCircle2 className="h-4 w-4" />}
              </button>
            )}
            {reviewActions.showPushToXeroAction && (
              <button
                type="button"
                data-testid="push-supplier-bill-to-xero-button"
                onClick={() => void handleXeroExport()}
                disabled={isActing}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-primary/30 bg-card text-primary px-4 py-2 text-sm font-medium hover:bg-primary/5 disabled:opacity-50 transition-colors"
              >
                {isActing ? 'Pushing supplier bill…' : reviewActions.pushToXeroLabel}
              </button>
            )}
            {reviewActions.showXeroSkippedCopy && (
              <p
                data-testid="xero-export-skipped-copy"
                className="text-xs text-muted-foreground"
              >
                {reviewActions.xeroSkippedCopy}
              </p>
            )}
            <Link
              href={accountingHref}
              data-testid="review-accounting-link"
              className="inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {accountingLinkLabel}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
