'use client';

import * as React from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { PaymentTaxInformationForm } from '@/components/commercial/payment-tax/payment-tax-information-form';
import { buildAgreementSummaryData } from '@/lib/commercial/participant-commercial-lifecycle';
import { normalizeDemoParticipantRole } from '@/lib/projects/normalize-participant-role';
import type { SupplierOnboardingInput } from '@/lib/commercial/supplier-onboarding';
import type { PaymentAttachment } from '@/lib/commercial/payment-setup-types';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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

type Props = {
  paymentSetupToken: string;
  onSubmitted: () => void | Promise<void>;
};

export function ParticipantWorkspacePayoutPanel({ paymentSetupToken, onSubmitted }: Props) {
  const [portalData, setPortalData] = React.useState<PortalData | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [submitted, setSubmitted] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!paymentSetupToken) return;
    fetch(`/api/payment-setup/${encodeURIComponent(paymentSetupToken)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Failed to load payout form');
        setPortalData(data);
        if (data.lifecycle === 'SUBMITTED' || data.lifecycle === 'APPROVED') {
          setSubmitted(true);
        }
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [paymentSetupToken]);

  const handleUploadAttachment = React.useCallback(
    async (file: File): Promise<PaymentAttachment> => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/payment-setup/${paymentSetupToken}/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      return data.attachment as PaymentAttachment;
    },
    [paymentSetupToken]
  );

  const handleSubmit = async (input: SupplierOnboardingInput) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/payment-setup/${paymentSetupToken}/submit`, {
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
      await onSubmitted();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading payout details form…</p>
      </div>
    );
  }

  if (loadError || !portalData) {
    return (
      <Card className="max-w-xl mx-auto">
        <CardHeader>
          <CardTitle>Could not load payout form</CardTitle>
          <CardDescription>{loadError ?? 'Please refresh or contact your organiser.'}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (submitted) {
    return (
      <Card className="max-w-xl mx-auto border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
        <CardHeader>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-8 w-8 text-emerald-600 shrink-0" />
            <div>
              <CardTitle className="text-emerald-900 dark:text-emerald-100">
                Payout details submitted
              </CardTitle>
              <CardDescription className="text-emerald-800/80 dark:text-emerald-200/80 mt-2">
                Thank you, {portalData.participantName}. Your organiser will verify your details
                and you can track progress in this workspace.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  const portalParticipant: DemoParticipant = {
    id: portalData.participantId,
    name: portalData.participantName,
    email: '',
    role: normalizeDemoParticipantRole(portalData.participantRole),
    approvalStatus: 'Approved',
    commissionKind: 'fixed_amount',
    commissionValue: (portalData.draftInvoice as { subtotal?: number })?.subtotal ?? 0,
    status: 'Confirmed',
    inviteToken: '',
  };

  const baseInput: SupplierOnboardingInput = {
    projectId: '',
    participant: {
      id: portalData.participantId,
      name: portalData.participantName,
      role: portalParticipant.role,
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

  const showRejectionBanner = portalData.lifecycle === 'REJECTED' && portalData.rejectionReason;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Complete payout details</h2>
        <p className="text-sm text-muted-foreground mt-1.5">
          Step 2 of 2 — add your payment and tax information so earnings can be settled.
        </p>
      </div>

      {showRejectionBanner ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-medium mb-1">Changes requested</p>
          <p>{portalData.rejectionReason}</p>
        </div>
      ) : null}

      {submitError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError}
        </div>
      ) : null}

      <PaymentTaxInformationForm
        agreementSummary={buildAgreementSummaryData(portalParticipant, {
          id: '',
          name: portalData.projectName,
        })}
        baseInput={baseInput}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        onUploadAttachment={handleUploadAttachment}
        existingAttachments={portalData.attachments}
      />
    </div>
  );
}
