'use client';

/**
 * Public Payment Setup Portal
 *
 * Route: /payment-setup/[token]
 *
 * No login required. Authenticated by signed UUID token only.
 * Suppliers open this link from their email invitation.
 *
 * Reuses the SupplierOnboardingForm component but submits to the public API.
 * Supports file uploads for alternative payment method evidence.
 */

import * as React from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { SupplierOnboardingForm } from '@/components/commercial/supplier-onboarding/supplier-onboarding-form';
import type { SupplierOnboardingInput } from '@/lib/commercial/supplier-onboarding';
import type { PaymentAttachment } from '@/lib/commercial/payment-setup-types';

type PortalData = {
  participantId: string;
  participantName: string;
  participantRole: string;
  projectName: string;
  draftInvoice: unknown;
  existingPayment: unknown;
  existingAbn: unknown;
  existingGst: unknown;
  lifecycle: string;
  attachments: PaymentAttachment[];
  rejectionReason: string | null;
};

export default function PaymentSetupPortalPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? '';

  const [portalData, setPortalData] = React.useState<PortalData | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [submitted, setSubmitted] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!token) return;
    fetch(`/api/payment-setup/${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Failed to load');
        setPortalData(data);
      })
      .catch((err) => setLoadError(err.message ?? 'Failed to load portal data.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleUploadAttachment = React.useCallback(
    async (file: File): Promise<PaymentAttachment> => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/payment-setup/${token}/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      return data.attachment as PaymentAttachment;
    },
    [token]
  );

  const handleSubmit = async (input: SupplierOnboardingInput) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/payment-setup/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment: input.payment,
          abn: input.abn,
          gst: input.gst,
          submission: input.submission,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Submission failed');
      setSubmitted(true);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Loading your payment form…</p>
        </div>
      </div>
    );
  }

  /* ── Error (expired/invalid token) ── */
  if (loadError || !portalData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full rounded-xl border border-amber-200 bg-amber-50 p-8 text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-amber-600 mx-auto" />
          <div>
            <h1 className="text-lg font-semibold text-amber-900">This link has expired</h1>
            <p className="text-sm text-amber-700 mt-2">
              {loadError ?? 'This payment setup link is no longer valid.'}
            </p>
            <p className="text-sm text-amber-600 mt-3">
              Please contact your organiser to request a new link.
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ── Already submitted ── */
  if (submitted || portalData.lifecycle === 'SUBMITTED' || portalData.lifecycle === 'APPROVED') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full rounded-xl border border-green-200 bg-green-50 p-8 text-center space-y-4">
          <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto" />
          <div>
            <h1 className="text-lg font-semibold text-green-900">Payment information submitted</h1>
            <p className="text-sm text-green-700 mt-2">
              Thank you, {portalData.participantName}. Your payment information for{' '}
              <strong>{portalData.projectName}</strong> has been received.
            </p>
            <p className="text-sm text-green-600 mt-3">
              {portalData.lifecycle === 'APPROVED'
                ? 'Your details have been approved. Payment will be arranged shortly.'
                : 'Your organiser will review your details and be in touch if anything is needed.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ── Rejection notice ── */
  const showRejectionBanner = portalData.lifecycle === 'REJECTED' && portalData.rejectionReason;

  /* ── Build base input from portal data ── */
  const baseInput: SupplierOnboardingInput = {
    projectId: '',
    participant: {
      id: portalData.participantId,
      name: portalData.participantName,
      role: portalData.participantRole,
      email: null,
    },
    agreement: {
      approved: true,
      approvedAt: new Date().toISOString(),
      agreementReference: null,
      projectName: portalData.projectName,
    },
    obligation: {
      amount: (portalData.draftInvoice as { subtotal?: number })?.subtotal ?? 0,
      currency: (portalData.draftInvoice as { currency?: string })?.currency ?? 'AUD',
      type: 'fixed_fee',
      description: (portalData.draftInvoice as { description?: string })?.description ?? null,
      revenueSharePercent: null,
      condition: null,
      dueDate: (portalData.draftInvoice as { dueDate?: string })?.dueDate ?? null,
    },
    payment: (portalData.existingPayment as SupplierOnboardingInput['payment']) ?? {
      preference: 'bank_account',
      bankDetails: { accountName: null, bsb: null, accountNumber: null },
      alternativePaymentMethod: null,
    },
    abn: (portalData.existingAbn as SupplierOnboardingInput['abn']) ?? {
      abn: null,
      abnNotApplicable: false,
      abnVerified: false,
      businessName: null,
    },
    gst: (portalData.existingGst as SupplierOnboardingInput['gst']) ?? { gstStatus: 'pending' },
    submission: { submittedAt: null, declarationAccepted: false },
    operator: { approvedAt: null, xeroExportedAt: null, notes: null },
    currentDate: new Date().toISOString(),
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="border-b bg-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-base tracking-tight">Provvy</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Secure payment setup for {portalData.projectName}
        </div>
      </div>

      <div className="max-w-xl mx-auto py-8 px-4">
        {/* Rejection banner */}
        {showRejectionBanner && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-800 mb-1">Changes requested</p>
            <p className="text-sm text-amber-700">{portalData.rejectionReason}</p>
            <p className="text-xs text-amber-600 mt-2">
              Please review the feedback above and resubmit your payment information.
            </p>
          </div>
        )}

        {/* Page intro */}
        <div className="mb-6">
          <h1 className="text-xl font-bold">Complete your payment information</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Hi {portalData.participantName}, {portalData.projectName} needs a few details to
            prepare your payment. This usually takes less than five minutes.
          </p>
        </div>

        {submitError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitError}
          </div>
        )}

        <SupplierOnboardingForm
          baseInput={baseInput}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          onUploadAttachment={handleUploadAttachment}
          existingAttachments={portalData.attachments}
        />
      </div>
    </div>
  );
}
