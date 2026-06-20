'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import { SupplierOnboardingForm } from '@/components/commercial/supplier-onboarding/supplier-onboarding-form';
import { buildSupplierOnboardingInput, hasSubmittedOnboarding } from '@/lib/commercial/build-supplier-onboarding-input';
import type { SupplierOnboardingInput } from '@/lib/commercial/supplier-onboarding';

/**
 * Participant Supplier Onboarding Form Page
 *
 * Route: /dashboard/projects/[projectId]/participants/[participantId]/onboard
 *
 * Renders the 5-step supplier onboarding form for a specific participant.
 * On submit, POSTs to the API and redirects to the operator review page.
 */
export default function SupplierOnboardingPage() {
  const params = useParams<{ projectId: string; participantId: string }>();
  const router = useRouter();

  const { deal, allParticipants } = useProjectWorkspace();

  const participantId = params?.participantId ?? '';
  const projectId = params?.projectId ?? deal?.id ?? '';

  const participant = React.useMemo(
    () => allParticipants?.find((p) => p.id === participantId) ?? null,
    [allParticipants, participantId]
  );

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // If already submitted, show success state (don't let them resubmit)
  const alreadySubmitted = participant ? hasSubmittedOnboarding(participant) : false;

  const handleSubmit = async (input: SupplierOnboardingInput) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/deal-network-pilot/participants/${participantId}/supplier-onboarding`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payment: input.payment,
            abn: input.abn,
            gst: input.gst,
            submission: input.submission,
          }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Submission failed. Please try again.');
      }
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setIsSubmitting(false);
    }
  };

  const backHref = `/dashboard/projects/${projectId}/participants?focus=onboarding`;

  if (!participant || !deal) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4">
        <div className="rounded-lg border bg-card p-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground">Loading payment information…</p>
        </div>
      </div>
    );
  }

  if (submitted || alreadySubmitted) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4">
        <div className="rounded-lg border border-green-200 bg-green-50 p-8 text-center space-y-4">
          <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto" />
          <div>
            <h2 className="text-lg font-semibold text-green-900">
              {submitted ? 'Payment information submitted' : 'Already submitted'}
            </h2>
            <p className="text-sm text-green-700 mt-1">
              {participant.name}'s payment information is now with the organiser for review.
              You'll be notified once it's been approved.
            </p>
          </div>
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm text-green-700 hover:underline mt-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to participants
          </Link>
        </div>
      </div>
    );
  }

  if (participant.approvalStatus !== 'Approved') {
    return (
      <div className="max-w-lg mx-auto py-12 px-4">
        <div className="rounded-lg border bg-amber-50 border-amber-200 p-6 text-center space-y-3">
          <p className="text-sm text-amber-700">
            {participant.name} has not yet approved their agreement. Payment setup
            is only available after agreement approval.
          </p>
          <Link href={backHref} className="text-sm text-amber-700 hover:underline">
            Back to participants
          </Link>
        </div>
      </div>
    );
  }

  const baseInput = buildSupplierOnboardingInput(participant, { id: deal.id, name: deal.dealName ?? '' });

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
          <h1 className="text-xl font-semibold">Payment Setup</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {participant.name} · {participant.role}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <SupplierOnboardingForm
        baseInput={baseInput}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
