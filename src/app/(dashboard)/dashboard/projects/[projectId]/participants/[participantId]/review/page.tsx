'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
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

/**
 * Operator Supplier Onboarding Review Page
 *
 * Route: /dashboard/projects/[projectId]/participants/[participantId]/review
 *
 * Architecture:
 *   This page handles the COMMERCIAL REVIEW step only.
 *   Verify = commercial decision (verifies supplier details are correct)
 *   Reject  = commercial decision (supplier can resubmit after corrections)
 *   Push Supplier Bill to Xero = accounting integration after verification
 *
 * The operator can:
 *   - Review the CommercialReviewSummary (deterministic checks)
 *   - Verify supplier details (sets lifecycle = APPROVED)
 *   - Reject with a reason (sets lifecycle = REJECTED, allows resubmission)
 *   - Push the supplier bill to Xero
 */
export default function SupplierOnboardingReviewPage() {
  const params = useParams<{ projectId: string; participantId: string }>();

  const { deal, allParticipants, refresh } = useProjectWorkspace();

  const participantId = params?.participantId ?? '';
  const projectId = params?.projectId ?? deal?.id ?? '';

  const participant = React.useMemo(
    () => allParticipants?.find((p) => p.id === participantId) ?? null,
    [allParticipants, participantId]
  );

  const [isActing, setIsActing] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const backHref = `/dashboard/projects/${projectId}/participants?focus=onboarding`;

  /** Verify is a commercial decision — it must happen before pushing the supplier bill to Xero. */
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

  /** Push Supplier Bill to Xero — available after verification. */
  const handleXeroExport = async (): Promise<boolean> => {
    setIsActing(true);
    setActionError(null);
    setSuccessMessage(null);
    try {
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

  const handleVerifyAndPushSupplierBill = async () => {
    setIsActing(true);
    setActionError(null);
    setSuccessMessage(null);
    try {
      if (lifecycle !== 'APPROVED') {
        const approved = await handleApprove();
        if (!approved) return;
      }
      const pushed = await handleXeroExport();
      if (pushed) {
        setSuccessMessage('Supplier details verified and supplier bill pushed to Xero.');
      }
    } finally {
      setIsActing(false);
    }
  };

  /** C-2: Resend payment setup link (generates a fresh token and emails the supplier) */
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

  const lifecycle = deriveLifecycleStatus(participant);
  const isRejected = isOnboardingRejected(participant);
  const rejectionReason = getOnboardingRejectionReason(participant);

  if (!hasSubmittedOnboarding(participant) && lifecycle !== 'REJECTED') {
    return (
      <div className="max-w-xl mx-auto py-8 px-4">
        <div className="mb-4">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to participants
          </Link>
        </div>
        <div className="rounded-lg border bg-amber-50 border-amber-200 p-6 space-y-3">
          <p className="text-sm font-medium text-amber-800">Supplier hasn't submitted yet</p>
          <p className="text-sm text-amber-700">
            {participant.name} has not completed their payment information. Once they submit,
            you'll be able to review and approve their details here.
          </p>
          {actionError && (
            <p className="text-xs text-red-700">{actionError}</p>
          )}
          {successMessage && (
            <p className="text-xs text-green-800">{successMessage}</p>
          )}
          <button
            type="button"
            onClick={handleResend}
            disabled={isActing}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-800 hover:underline disabled:opacity-50"
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

  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      {/* Page header */}
      <div className="mb-6">
        <Link
          href={backHref}
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

      {/* Rejection banner — C-1: supplier can resubmit, C-2: operator can resend link */}
      {isRejected && rejectionReason && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 flex gap-3">
          <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Changes requested</p>
            <p className="text-sm text-red-700 mt-0.5">{rejectionReason}</p>
            <p className="text-xs text-red-600 mt-1.5">
              A new payment setup link has been sent to {participant.name} so they can resubmit after making corrections.
            </p>
            <button
              type="button"
              onClick={handleResend}
              disabled={isActing}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-red-700 hover:text-red-900 hover:underline disabled:opacity-50"
            >
              <Send className="h-3 w-3" />
              Resend payment setup link
            </button>
          </div>
        </div>
      )}

      {actionError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 flex items-center gap-2">
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

      {(lifecycle === 'SUBMITTED' || lifecycle === 'APPROVED') && (
        <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-blue-800">
              {lifecycle === 'APPROVED'
                ? 'Supplier details verified — ready to push supplier bill to Xero'
                : 'Verify supplier details and push supplier bill to Xero'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              This single workflow action verifies the payout details and advances the participant to settlement readiness.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void handleVerifyAndPushSupplierBill()}
              disabled={isActing}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isActing
                ? 'Pushing supplier bill…'
                : lifecycle === 'APPROVED'
                  ? 'Push Supplier Bill to Xero'
                  : 'Verify & Push Supplier Bill to Xero'}
              {!isActing && <CheckCircle2 className="h-4 w-4" />}
            </button>
            <Link
              href={`/dashboard/projects/${projectId}/funding?section=accounting`}
              className="inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View in Funding tab
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
