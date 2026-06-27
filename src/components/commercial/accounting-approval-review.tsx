'use client';

/**
 * AccountingApprovalReview
 *
 * The final operator review screen before a supplier bill is pushed to Xero.
 *
 * Design rules:
 *   - One primary CTA: "Push Supplier Bill to Xero"
 *   - Nothing is pushed automatically — operator must explicitly continue.
 *   - Shows complete supplier bill detail before the operator commits.
 *   - Derives entirely from AccountingExportModel (no independent calculations).
 *
 * What the operator sees:
 *   • Supplier name + role
 *   • Invoice amount + GST breakdown
 *   • ABN
 *   • Payment details (bank account or alternative)
 *   • Commercial reference
 *   • Description (auto-populated from agreement)
 *   • Tracking category (if applicable)
 *   • Invoice PDF preview (description block)
 *
 * Primary CTA: Push Supplier Bill to Xero
 * Secondary: Edit (navigates back to supplier onboarding form)
 * Destructive: Reject (navigates back to review with a rejection reason)
 */

import * as React from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Building2,
  CreditCard,
  FileText,
  Hash,
  Tag,
  DollarSign,
  ArrowRight,
  X,
} from 'lucide-react';

import type { AccountingExportModel } from '@/lib/commercial/accounting-export';

/* ─── Section rows ───────────────────────────────────────────────────────── */

function ReviewRow({ icon: Icon, label, value, highlight }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-0">
      <div className="shrink-0 mt-0.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm font-medium mt-0.5 ${highlight ? 'text-primary' : 'text-foreground'}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

function AmountBlock({ preview }: { preview: NonNullable<AccountingExportModel['preview']> }) {
  const currencyFmt = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: preview.currency,
    minimumFractionDigits: 2,
  });

  const subtotal = preview.gstIncluded
    ? preview.amount - preview.gstAmount
    : preview.amount;
  const total = preview.amount + (preview.gstIncluded ? 0 : preview.gstAmount);

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Subtotal</span>
        <span>{currencyFmt.format(subtotal)}</span>
      </div>
      {preview.gstAmount > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">GST (10%)</span>
          <span>{currencyFmt.format(preview.gstAmount)}</span>
        </div>
      )}
      <div className="flex justify-between text-sm font-semibold border-t pt-2 mt-2">
        <span>Total</span>
        <span>{currencyFmt.format(total)}</span>
      </div>
      <p className="text-xs text-muted-foreground pt-1">
        {preview.gstIncluded
          ? 'GST registered supplier — 10% GST included.'
          : preview.gstAmount === 0
          ? 'Supplier has declared they are not GST registered. No GST applied.'
          : 'GST status pending.'}
      </p>
    </div>
  );
}

/* ─── Readiness warnings ─────────────────────────────────────────────────── */

function ReadinessWarning({ model }: { model: AccountingExportModel }) {
  const { exportReadiness } = model;
  if (exportReadiness.ready) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800">Review required before pushing supplier bill</p>
          <ul className="mt-1 space-y-0.5">
            {exportReadiness.blockers.map((b, i) => (
              <li key={i} className="text-xs text-amber-700">• {b.explanation}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ─── Operator decision buttons ──────────────────────────────────────────── */

type DecisionButtonsProps = {
  onApprove: () => void;
  onReject?: () => void;
  isReady: boolean;
  approving?: boolean;
};

function DecisionButtons({ onApprove, onReject, isReady, approving }: DecisionButtonsProps) {
  return (
    <div className="space-y-3 pt-2">
      <button
        type="button"
        onClick={onApprove}
        disabled={!isReady || approving}
        className="w-full flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {approving ? (
          'Pushing supplier bill...'
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4" />
            Push Supplier Bill to Xero
          </>
        )}
      </button>
      {onReject && (
        <button
          type="button"
          onClick={onReject}
          className="w-full flex items-center justify-center gap-2 rounded-md border py-2 text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors"
        >
          <X className="h-4 w-4" />
          Reject & Request Changes
        </button>
      )}
    </div>
  );
}

/* ─── Main review screen ─────────────────────────────────────────────────── */

export type AccountingApprovalReviewProps = {
  model: AccountingExportModel;
  onApprove: () => void;
  onReject?: () => void;
  onEditDetails?: () => void;
  approving?: boolean;
};

/**
 * AccountingApprovalReview
 *
 * Final operator review before pushing the supplier bill to Xero.
 * One primary CTA: "Push Supplier Bill to Xero"
 * Nothing pushes automatically.
 */
export function AccountingApprovalReview({
  model,
  onApprove,
  onReject,
  onEditDetails,
  approving = false,
}: AccountingApprovalReviewProps) {
  const { preview, exportReadiness } = model;

  if (!preview) {
    return (
      <div className="rounded-lg border bg-muted/30 p-6 text-center">
        <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          Supplier bill preview is not yet available. Payout details must be submitted first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-base font-semibold">
          Review before exporting to Xero
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Confirm all details are correct. Once approved, this invoice will be pushed to Xero.
        </p>
      </div>

      {/* Readiness warnings */}
      <ReadinessWarning model={model} />

      {/* Invoice details */}
      <div className="rounded-lg border bg-card divide-y">
        <ReviewRow
          icon={Building2}
          label="Supplier"
          value={preview.supplier}
        />
        {preview.abn && (
          <ReviewRow
            icon={Building2}
            label="ABN"
            value={preview.abn}
          />
        )}
        <ReviewRow
          icon={Hash}
          label="Invoice Reference"
          value={preview.reference}
        />
        {preview.invoiceNumber && (
          <ReviewRow
            icon={Hash}
            label="Invoice Number"
            value={preview.invoiceNumber}
          />
        )}
        <ReviewRow
          icon={FileText}
          label="Description"
          value={preview.description}
        />
        {preview.trackingCategory && (
          <ReviewRow
            icon={Tag}
            label="Tracking Category"
            value={preview.trackingCategory}
          />
        )}
        {preview.dueDate && (
          <ReviewRow
            icon={DollarSign}
            label="Due Date"
            value={new Date(preview.dueDate).toLocaleDateString('en-AU', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          />
        )}
        <ReviewRow
          icon={CreditCard}
          label="Accounting System"
          value={preview.accountingSystemLabel}
        />
      </div>

      {/* Amount breakdown */}
      <AmountBlock preview={preview} />

      {/* Edit link */}
      {onEditDetails && (
        <button
          type="button"
          onClick={onEditDetails}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowRight className="h-3 w-3 rotate-180" />
          Edit payment information
        </button>
      )}

      {/* Decision */}
      <DecisionButtons
        onApprove={onApprove}
        onReject={onReject}
        isReady={exportReadiness.ready}
        approving={approving}
      />
    </div>
  );
}
