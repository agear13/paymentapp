'use client';

/**
 * SupplierOnboardingOperatorView
 *
 * The operator-facing review interface for supplier onboarding.
 *
 * Architecture:
 *   Approval  = commercial decision (operator reviewed and accepted the submission)
 *   Rejection = commercial decision (operator reviewed and rejected — supplier can resubmit)
 *   Xero      = accounting integration (separate downstream concern — shown after approval)
 *
 * Surfaces:
 *   - CommercialReviewSummary (deterministic checks with pass/warn/fail status)
 *   - Invoice summary
 *   - ABN / GST / payment details
 *   - Onboarding checklist
 *   - Approve | Reject CTAs (approval ≠ accounting export)
 *
 * Derives from deriveSupplierOnboardingStatus() — no independent calculations.
 * Designed so AI-assisted review checks can be layered in later (review check IDs are stable).
 */

import * as React from 'react';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Building2,
  CreditCard,
  FileText,
  ShieldCheck,
  ArrowRight,
  Users,
  ChevronDown,
  ChevronUp,
  Paperclip,
  Eye,
  EyeOff,
} from 'lucide-react';

import type {
  SupplierOnboardingStatus,
  WorkspaceOnboardingStatus,
  OnboardingChecklistStatus,
} from '@/lib/commercial/supplier-onboarding';
import type { CommercialReviewSummary, ReviewCheck, ReviewCheckStatus } from '@/lib/commercial/supplier-onboarding-domain';
import type { PaymentAttachment } from '@/lib/commercial/payment-setup-types';

/* ─── Utilities ─────────────────────────────────────────────────────────── */
function fmt(amount: number, currency = 'AUD'): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
}

function statusIcon(status: OnboardingChecklistStatus) {
  switch (status) {
    case 'complete':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case 'in_progress':
      return <Clock className="h-4 w-4 text-amber-500" />;
    case 'requires_review':
      return <AlertCircle className="h-4 w-4 text-amber-600" />;
    default:
      return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />;
  }
}

function statusLabel(status: OnboardingChecklistStatus): string {
  switch (status) {
    case 'complete': return 'Complete';
    case 'in_progress': return 'In progress';
    case 'requires_review': return 'Review required';
    case 'not_started': return 'Not started';
  }
}

/* ─── Review check row ──────────────────────────────────────────────────── */
function reviewCheckIcon(status: ReviewCheckStatus) {
  switch (status) {
    case 'pass': return <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />;
    case 'warn': return <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />;
    case 'fail': return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
    case 'info': return <Clock className="h-4 w-4 text-blue-500 shrink-0" />;
  }
}

function ReviewCheckRow({ check }: { check: ReviewCheck }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <div className="mt-0.5">{reviewCheckIcon(check.status)}</div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${
          check.status === 'fail' ? 'text-red-700 font-medium' :
          check.status === 'warn' ? 'text-amber-700' :
          'text-foreground'
        }`}>{check.label}</p>
        {check.detail && (
          <p className="text-xs text-muted-foreground mt-0.5">{check.detail}</p>
        )}
      </div>
    </div>
  );
}

/* ─── Commercial Review Summary panel ──────────────────────────────────── */
function CommercialReviewSummaryPanel({ summary }: { summary: CommercialReviewSummary }) {
  const [expanded, setExpanded] = React.useState(true);

  const headerColor = summary.hasBlockers
    ? 'border-red-200 bg-red-50'
    : summary.hasWarnings
    ? 'border-amber-100 bg-amber-50/40'
    : 'border-green-200 bg-green-50/40';

  const headerLabel = summary.hasBlockers
    ? 'Review has blockers — cannot approve'
    : summary.hasWarnings
    ? 'Review passed with warnings'
    : 'All checks passed';

  const headerIcon = summary.hasBlockers
    ? <XCircle className="h-4 w-4 text-red-600" />
    : summary.hasWarnings
    ? <AlertCircle className="h-4 w-4 text-amber-600" />
    : <CheckCircle2 className="h-4 w-4 text-green-600" />;

  return (
    <div className={`rounded-lg border overflow-hidden ${headerColor}`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-3 text-left"
      >
        <div className="flex items-center gap-2">
          {headerIcon}
          <span className="text-sm font-medium">{headerLabel}</span>
        </div>
        {expanded
          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground" />
        }
      </button>
      {expanded && (
        <div className="px-3 pb-3 divide-y divide-border/50">
          {summary.checks.map((check) => (
            <ReviewCheckRow key={check.id} check={check} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Reject modal ──────────────────────────────────────────────────────── */
function RejectModal({
  participantName,
  onConfirm,
  onCancel,
  isLoading,
}: {
  participantName: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [reason, setReason] = React.useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="relative w-full max-w-sm bg-background border rounded-xl shadow-xl p-5 mx-4">
        <h3 className="text-base font-semibold mb-1">Request changes</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Provide a reason for {participantName}. They will be able to resubmit after making corrections.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. ABN could not be verified. Please resubmit with a valid ABN."
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          rows={4}
          autoFocus
        />
        <div className="flex gap-2 mt-4 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => reason.trim() && onConfirm(reason.trim())}
            disabled={!reason.trim() || isLoading}
            className="rounded-md bg-red-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-red-700 disabled:opacity-40 transition-colors"
          >
            {isLoading ? 'Rejecting…' : 'Reject submission'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Operator review card for one supplier ─────────────────────────────── */

export type SupplierOnboardingOperatorViewProps = {
  status: SupplierOnboardingStatus;
  /** H-8: Raw participant for masked bank details and attachments. */
  participant?: DemoParticipant;
  /** Commercial review summary (deterministic checks). */
  reviewSummary?: CommercialReviewSummary;
  /** Called when operator clicks Approve (commercial decision). */
  onApprove?: () => void;
  /** Called when operator clicks Approve & Push to Xero (legacy combined action). */
  onApproveAndExport?: () => void;
  /** Called when operator rejects with a reason. */
  onReject?: (reason: string) => void;
  isLoading?: boolean;
};

/**
 * SupplierOnboardingOperatorView
 *
 * Shows the operator a complete picture of one supplier's onboarding status.
 * Surfaces the commercial review summary, all submitted details, and approve/reject CTAs.
 *
 * Approval is a commercial decision — it does NOT export to Xero.
 * After approval, the operator is directed to the accounting export step separately.
 */
export function SupplierOnboardingOperatorView({
  status,
  participant,
  reviewSummary,
  onApprove,
  onApproveAndExport,
  onReject,
  isLoading = false,
}: SupplierOnboardingOperatorViewProps) {
  const { draftInvoice, abnValidation, checklist, xeroReadiness, requiresManualReview } = status;
  const [showRejectModal, setShowRejectModal] = React.useState(false);
  const [isRejecting, setIsRejecting] = React.useState(false);
  const [showFullBank, setShowFullBank] = React.useState(false);

  // H-8: Extract bank details and attachments from participant.supplierOnboarding.submission
  const submission = (participant?.supplierOnboarding as { submission?: Record<string, unknown> } | undefined)?.submission;
  const bankAccountName = submission?.bankAccountName as string | undefined;
  const bsb = submission?.bsb as string | undefined;
  const accountNumber = submission?.accountNumber as string | undefined;
  const altPaymentNotes = submission?.alternativePaymentNotes as string | undefined;
  const paymentMethodType = submission?.paymentMethodType as string | undefined;
  const attachments: PaymentAttachment[] = participant?.paymentSetup?.attachments ?? [];

  const handleReject = async (reason: string) => {
    setIsRejecting(true);
    try {
      await onReject?.(reason);
    } finally {
      setIsRejecting(false);
      setShowRejectModal(false);
    }
  };

  // H-8: Mask BSB/account number for display (show last 3 digits)
  function maskNumber(n: string | undefined): string {
    if (!n) return '—';
    return n.length > 3 ? '••••' + n.slice(-3) : n;
  }
  function unmaskNumber(n: string | undefined): string {
    return n ?? '—';
  }

  const SECTION_ICONS: Record<string, React.ReactNode> = {
    invoice_reviewed: <FileText className="h-4 w-4" />,
    payment_details: <CreditCard className="h-4 w-4" />,
    abn: <Building2 className="h-4 w-4" />,
    gst_status: <ShieldCheck className="h-4 w-4" />,
    declaration: <CheckCircle2 className="h-4 w-4" />,
    operator_approval: <CheckCircle2 className="h-4 w-4" />,
  };

  const paymentMethod = paymentMethodType === 'bank'
    ? 'Bank transfer'
    : paymentMethodType
    ? 'Alternative payment method'
    : (status.draftInvoice.participantName
        ? (status.checklist.find((c) => c.id === 'payment_details')?.status === 'requires_review'
            ? 'Alternative method — manual processing'
            : 'Bank transfer')
        : 'Not provided');

  return (
    <>
      {showRejectModal && (
        <RejectModal
          participantName={status.participantName}
          onConfirm={handleReject}
          onCancel={() => setShowRejectModal(false)}
          isLoading={isRejecting}
        />
      )}

      <div className="rounded-lg border bg-card overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b flex items-start justify-between">
          <div>
            <p className="font-semibold">{status.participantName}</p>
            <p className="text-sm text-muted-foreground">{status.participantRole}</p>
          </div>
          <div>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                status.stage === 'xero_exported'
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : status.stage === 'operator_approved'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : status.stage === 'submitted'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-muted text-muted-foreground border-border'
              }`}
            >
              {status.stageLabel}
            </span>
          </div>
        </div>

        {/* Commercial Review Summary */}
        {reviewSummary && status.stage === 'submitted' && (
          <div className="p-4 border-b">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Review checklist</p>
            <CommercialReviewSummaryPanel summary={reviewSummary} />
          </div>
        )}

        {/* Invoice summary */}
        <div className="p-4 border-b grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Invoice total</p>
            <p className="font-semibold">{fmt(draftInvoice.total, draftInvoice.currency)}</p>
            {draftInvoice.gstAmount !== null && (
              <p className="text-xs text-muted-foreground">Includes {fmt(draftInvoice.gstAmount, draftInvoice.currency)} GST</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Payment method</p>
            <p className="text-sm font-medium">{paymentMethod}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">ABN</p>
            {abnValidation.isNotApplicable ? (
              <p className="text-sm text-amber-700">Not applicable — review required</p>
            ) : abnValidation.isValid ? (
              <p className="text-sm text-green-700 font-medium">{abnValidation.formattedABN}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Not provided</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">GST</p>
            <p className="text-sm font-medium">
              {draftInvoice.gstStatus === 'yes'
                ? 'GST registered'
                : draftInvoice.gstStatus === 'no'
                ? 'Not registered'
                : draftInvoice.gstStatus === 'not_applicable'
                ? 'Not applicable'
                : 'Pending'}
            </p>
          </div>
        </div>

        {/* H-8: Bank details (masked, with reveal toggle) */}
        {paymentMethodType === 'bank' && bankAccountName && (
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Bank details</p>
              <button
                type="button"
                onClick={() => setShowFullBank((v) => !v)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {showFullBank ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {showFullBank ? 'Hide' : 'Reveal'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Account name</p>
                <p className="text-sm font-medium">{bankAccountName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">BSB</p>
                <p className="text-sm font-mono">{showFullBank ? unmaskNumber(bsb) : maskNumber(bsb)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Account number</p>
                <p className="text-sm font-mono">{showFullBank ? unmaskNumber(accountNumber) : maskNumber(accountNumber)}</p>
              </div>
            </div>
          </div>
        )}

        {/* H-8: Alternative payment notes */}
        {paymentMethodType !== 'bank' && altPaymentNotes && (
          <div className="p-4 border-b">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Alternative payment instructions</p>
            <p className="text-sm whitespace-pre-wrap text-foreground/80">{altPaymentNotes}</p>
          </div>
        )}

        {/* H-8: Attachments */}
        {attachments.length > 0 && (
          <div className="p-4 border-b">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Supporting attachments</p>
            <ul className="space-y-1.5">
              {attachments.map((att) => (
                <li key={att.id} className="flex items-center gap-2">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground truncate">
                    {att.filename}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto shrink-0">
                    {att.mimeType?.split('/')[1]?.toUpperCase() ?? 'FILE'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Checklist */}
        <div className="p-4 border-b">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Payment information checklist</p>
          <div className="space-y-2.5">
            {checklist.map((item) => (
              <div key={item.id} className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">{SECTION_ICONS[item.id] ?? statusIcon(item.status)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{item.label}</p>
                    <span
                      className={`text-xs ${
                        item.status === 'complete'
                          ? 'text-green-700'
                          : item.status === 'requires_review'
                          ? 'text-amber-700'
                          : item.status === 'in_progress'
                          ? 'text-amber-600'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {statusLabel(item.status)}
                    </span>
                  </div>
                  {item.explanation && item.status !== 'complete' && (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.explanation}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Manual review notice */}
        {requiresManualReview && (
          <div className="px-4 py-3 border-b bg-amber-50">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">
                Manual review required before accounting export. Verify ABN exemption and/or payment method.
              </p>
            </div>
          </div>
        )}

        {/* Primary CTAs */}
        <div className="p-4">
          {status.stage === 'xero_exported' ? (
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-medium">Invoice exported to Xero</span>
            </div>
          ) : status.stage === 'operator_approved' ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-blue-700 mb-2">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-medium">Supplier approved — accounting export available</span>
              </div>
              {onApproveAndExport && (
                <button
                  type="button"
                  onClick={onApproveAndExport}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {isLoading ? 'Exporting…' : 'Push to Xero'}
                  {!isLoading && <ArrowRight className="h-4 w-4" />}
                </button>
              )}
            </div>
          ) : status.stage === 'submitted' ? (
            <div className="space-y-2">
              {/* Approve — commercial decision, NOT accounting export */}
              {onApprove && (
                <button
                  type="button"
                  onClick={onApprove}
                  disabled={isLoading || reviewSummary?.hasBlockers === true}
                  className="w-full flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {isLoading ? 'Approving…' : 'Approve supplier'}
                  {!isLoading && <CheckCircle2 className="h-4 w-4" />}
                </button>
              )}
              {/* Reject */}
              {onReject && (
                <button
                  type="button"
                  onClick={() => setShowRejectModal(true)}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-md border border-red-200 text-red-700 bg-red-50 py-2.5 text-sm font-medium hover:bg-red-100 disabled:opacity-50 transition-colors"
                >
                  <XCircle className="h-4 w-4" />
                  Request changes or reject
                </button>
              )}
              {reviewSummary?.hasBlockers && (
                <p className="text-xs text-red-600 text-center">
                  Resolve checklist blockers before approving.
                </p>
              )}
            </div>
          ) : status.nextAction ? (
            <p className="text-sm text-muted-foreground">{status.nextAction}</p>
          ) : null}
        </div>
      </div>
    </>
  );
}

/* ─── Dashboard progress widget ─────────────────────────────────────────── */

export type SupplierOnboardingDashboardWidgetProps = {
  workspace: WorkspaceOnboardingStatus;
  onContinue?: () => void;
};

/**
 * SupplierOnboardingDashboardWidget
 *
 * Compact dashboard card showing supplier onboarding progress.
 */
export function SupplierOnboardingDashboardWidget({
  workspace,
  onContinue,
}: SupplierOnboardingDashboardWidgetProps) {
  if (workspace.totalCount === 0) return null;

  const allComplete = workspace.completedCount === workspace.totalCount;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Payment Preparation</span>
        </div>
        {allComplete ? (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        ) : (
          <span className="text-xs text-muted-foreground">
            {workspace.completedCount} / {workspace.totalCount} complete
          </span>
        )}
      </div>

      {!allComplete && (
        <div className="px-4 pt-3">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{
                width: `${Math.round((workspace.completedCount / workspace.totalCount) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {!allComplete && workspace.pendingSuppliers.length > 0 && (
        <div className="p-4 space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Remaining</p>
          {workspace.pendingSuppliers.slice(0, 3).map((s, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-medium">{s.participantName[0]}</span>
              </div>
              <div>
                <p className="text-sm font-medium">{s.participantName}</p>
                <p className="text-xs text-muted-foreground">{s.primaryNeed}</p>
              </div>
            </div>
          ))}
          {workspace.pendingSuppliers.length > 3 && (
            <p className="text-xs text-muted-foreground pl-7">
              +{workspace.pendingSuppliers.length - 3} more
            </p>
          )}
        </div>
      )}

      {allComplete && (
        <div className="p-4 flex items-center gap-2 text-green-700">
          <CheckCircle2 className="h-4 w-4" />
          <p className="text-sm font-medium">All suppliers are ready for payment.</p>
        </div>
      )}

      {workspace.primaryCta && (
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={onContinue}
            className="w-full flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            {workspace.primaryCta}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
