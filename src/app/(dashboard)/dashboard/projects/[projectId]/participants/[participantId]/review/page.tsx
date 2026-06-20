'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
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

/**
 * Operator Supplier Onboarding Review Page
 *
 * Route: /dashboard/projects/[projectId]/participants/[participantId]/review
 *
 * Architecture:
 *   This page handles the COMMERCIAL REVIEW step only.
 *   Approve = commercial decision (verifies supplier details are correct)
 *   Reject  = commercial decision (supplier can resubmit after corrections)
 *   Push to Xero = accounting integration (separate step, shown after approval)
 *
 * The operator can:
 *   - Review the CommercialReviewSummary (deterministic checks)
 *   - Approve the supplier (sets lifecycle = APPROVED)
 *   - Reject with a reason (sets lifecycle = REJECTED, allows resubmission)
 *   - After approval: continue to Xero Export from the funding page
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

  const backHref = `/dashboard/projects/${projectId}/participants?focus=onboarding`;

  const handleApproveAndExport = async () => {
    setIsActing(true);
    setActionError(null);
    try {
      // Step 1: approve
      const res = await fetch(
        `/api/deal-network-pilot/participants/${participantId}/supplier-onboarding/approve`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Approval failed. Please try again.');
      }
      // Step 2: export to Xero
      const xeroRes = await fetch(
        `/api/deal-network-pilot/participants/${participantId}/xero-export`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }
      );
      if (!xeroRes.ok) {
        const data = await xeroRes.json().catch(() => ({}));
        // Non-fatal — approval succeeded, Xero export failed. Show error but don't revert.
        setActionError(`Approved, but Xero export failed: ${data.error ?? 'Unknown error'}. You can retry from the Funding tab.`);
      }
      void refresh({ scope: 'all', silent: true, force: true });
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
            {participant.name} has not completed their onboarding form. Once they submit,
            you'll be able to review and approve their details here.
          </p>
          <Link
            href={`/dashboard/projects/${projectId}/participants/${participantId}/onboard`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-800 hover:underline"
          >
            Open onboarding form
            <CheckCircle2 className="h-3.5 w-3.5" />
          </Link>
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
          <h1 className="text-xl font-semibold">Review Payment Information</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Verify {participant.name}'s details and approve or request changes.
          </p>
        </div>
      </div>

      {/* Rejection banner */}
      {isRejected && rejectionReason && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 flex gap-3">
          <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Submission rejected</p>
            <p className="text-sm text-red-700 mt-0.5">{rejectionReason}</p>
            <p className="text-xs text-red-600 mt-1.5">
              The supplier can open their onboarding form and resubmit after making corrections.
            </p>
          </div>
        </div>
      )}

      {actionError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <SupplierOnboardingOperatorView
        status={status}
        reviewSummary={reviewSummary}
        onApprove={handleApproveAndExport}
        onApproveAndExport={handleApproveAndExport}
        onReject={handleReject}
        isLoading={isActing}
      />

      {/* Architectural separation: accounting is a downstream concern */}
      {lifecycle === 'APPROVED' && (
        <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-800 mb-2">
            Supplier approved — next step: accounting export
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            Approval confirms the commercial details are correct. Export to Xero is a separate accounting step.
          </p>
          <Link
            href={`/dashboard/projects/${projectId}/funding?section=accounting`}
            className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Continue to Xero Export
            <CheckCircle2 className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
