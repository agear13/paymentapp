'use client';

/**
 * SupplierOnboardingOperatorView
 *
 * The operator-facing review interface for supplier onboarding.
 *
 * Answers one question: "Can I safely push this to Xero?"
 *
 * Surfaces:
 *   - Invoice summary
 *   - ABN status
 *   - GST status
 *   - Payment method
 *   - Checklist
 *   - Primary CTA: "Approve & Push to Xero"
 *
 * Also exports:
 *   SupplierOnboardingDashboardWidget — compact progress card for the dashboard
 *
 * Derives entirely from deriveSupplierOnboardingStatus() — no independent calculations.
 */

import * as React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  CreditCard,
  FileText,
  ShieldCheck,
  ArrowRight,
  Users,
} from 'lucide-react';

import type {
  SupplierOnboardingStatus,
  WorkspaceOnboardingStatus,
  OnboardingChecklistStatus,
} from '@/lib/commercial/supplier-onboarding';

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

/* ─── Operator review card for one supplier ─────────────────────────────── */

export type SupplierOnboardingOperatorViewProps = {
  status: SupplierOnboardingStatus;
  /** Called when operator clicks "Approve & Push to Xero". */
  onApproveAndExport?: () => void;
  /** Called when operator clicks "Approve invoice" (before export). */
  onApprove?: () => void;
  isLoading?: boolean;
};

/**
 * SupplierOnboardingOperatorView
 *
 * Shows the operator a complete picture of one supplier's onboarding status.
 * Surfaces all the information needed to make an informed decision before Xero export.
 */
export function SupplierOnboardingOperatorView({
  status,
  onApproveAndExport,
  onApprove,
  isLoading = false,
}: SupplierOnboardingOperatorViewProps) {
  const { draftInvoice, abnValidation, checklist, xeroReadiness, requiresManualReview } = status;

  const SECTION_ICONS: Record<string, React.ReactNode> = {
    invoice_reviewed: <FileText className="h-4 w-4" />,
    payment_details: <CreditCard className="h-4 w-4" />,
    abn: <Building2 className="h-4 w-4" />,
    gst_status: <ShieldCheck className="h-4 w-4" />,
    declaration: <CheckCircle2 className="h-4 w-4" />,
    operator_approval: <CheckCircle2 className="h-4 w-4" />,
  };

  const paymentMethod = status.draftInvoice.participantName
    ? (status.checklist.find((c) => c.id === 'payment_details')?.status === 'requires_review'
        ? 'Alternative method'
        : 'Bank transfer')
    : 'Not provided';

  return (
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

      {/* Checklist */}
      <div className="p-4 border-b">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Onboarding checklist</p>
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
              Manual review required before Xero export. Verify ABN exemption and/or payment method.
            </p>
          </div>
        </div>
      )}

      {/* Primary CTA */}
      <div className="p-4">
        {status.stage === 'xero_exported' ? (
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">Invoice exported to Xero</span>
          </div>
        ) : status.stage === 'operator_approved' ? (
          <button
            type="button"
            onClick={onApproveAndExport}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Exporting…' : 'Push to Xero'}
            {!isLoading && <ArrowRight className="h-4 w-4" />}
          </button>
        ) : status.stage === 'submitted' && xeroReadiness.readyForExport === false ? (
          <button
            type="button"
            onClick={onApprove}
            disabled={isLoading || checklist.some((i) => i.isBlocker && i.status !== 'complete' && i.id !== 'operator_approval')}
            className="w-full flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Approving…' : 'Approve & Push to Xero'}
            {!isLoading && <ArrowRight className="h-4 w-4" />}
          </button>
        ) : status.nextAction ? (
          <p className="text-sm text-muted-foreground">{status.nextAction}</p>
        ) : null}
      </div>
    </div>
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
 * Shows count, individual pending supplier needs, and one primary CTA.
 */
export function SupplierOnboardingDashboardWidget({
  workspace,
  onContinue,
}: SupplierOnboardingDashboardWidgetProps) {
  if (workspace.totalCount === 0) return null;

  const allComplete = workspace.completedCount === workspace.totalCount;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Supplier Onboarding</span>
        </div>
        {allComplete ? (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        ) : (
          <span className="text-xs text-muted-foreground">
            {workspace.completedCount} / {workspace.totalCount} complete
          </span>
        )}
      </div>

      {/* Progress bar */}
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

      {/* Pending suppliers */}
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
          <p className="text-sm font-medium">All suppliers have completed onboarding.</p>
        </div>
      )}

      {/* CTA */}
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
