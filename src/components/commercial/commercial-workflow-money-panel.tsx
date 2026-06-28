'use client';

/**
 * CommercialWorkflowMoneyPanel
 *
 * The extended Money screen that shows the complete commercial pipeline:
 *   Supplier Onboarding Progress → Invoice Status → Accounting Status → Settlement Readiness
 *
 * Design rules:
 *   - Every value derives from canonical engines — no independent calculations.
 *   - Sections hide automatically when they have no actionable content.
 *   - One primary CTA per section.
 *   - Operator language only.
 *
 * This panel is intended to be composed into the funding/money page
 * alongside the existing CommercialForecast sections.
 */

import * as React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Users,
  FileText,
  BarChart3,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

import type { WorkspaceOnboardingStatus, SupplierOnboardingStatus } from '@/lib/commercial/supplier-onboarding';
import type { WorkspaceAccountingSyncStatus } from '@/lib/commercial/accounting-export';
import type { WorkspaceSettlementReadiness } from '@/lib/commercial/settlement-readiness';
import { getSupplierGstTaxTreatment } from '@/lib/commercial/supplier-invoice-projection';

/* ─── Utilities ─────────────────────────────────────────────────────────── */
function fmt(amount: number, currency = 'AUD'): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

/* ─── Section wrapper ────────────────────────────────────────────────────── */
function PanelSection({
  icon: Icon,
  title,
  badge,
  children,
  defaultExpanded = true,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">{title}</span>
          {badge}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {expanded && <div className="border-t">{children}</div>}
    </div>
  );
}

function StatusBadge({ count, variant }: { count: number; variant: 'action' | 'review' | 'ok' }) {
  if (count === 0) return null;
  const cls = variant === 'action'
    ? 'bg-amber-100 text-amber-700 border-amber-200'
    : variant === 'review'
    ? 'bg-blue-100 text-blue-700 border-blue-200'
    : 'bg-green-100 text-green-700 border-green-200';
  return (
    <span className={`ml-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {count}
    </span>
  );
}

/* ─── Section 1: Supplier Onboarding ────────────────────────────────────── */

function OnboardingSupplierRow({ supplier }: { supplier: SupplierOnboardingStatus }) {
  const needsAttention = ['in_progress', 'invoice_generated'].includes(supplier.stage);
  const awaitsReview = supplier.stage === 'submitted';
  const isComplete = supplier.stage === 'xero_exported' || supplier.stage === 'operator_approved';

  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b last:border-0">
      <div className="shrink-0 mt-0.5">
        {isComplete
          ? <CheckCircle2 className="h-4 w-4 text-green-600" />
          : awaitsReview
          ? <AlertCircle className="h-4 w-4 text-amber-600" />
          : <Clock className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{supplier.participantName}</p>
          <p className="text-xs text-muted-foreground">{supplier.stageLabel}</p>
        </div>
        {supplier.nextAction && !isComplete && (
          <p className="text-xs text-muted-foreground mt-0.5">{supplier.nextAction}</p>
        )}
      </div>
    </div>
  );
}

function OnboardingProgressPanel({
  workspace,
  onContinue,
}: {
  workspace: WorkspaceOnboardingStatus;
  onContinue?: () => void;
}) {
  const incomplete = workspace.participants.filter((p) => p.stage !== 'xero_exported');
  const awaiting = workspace.participants.filter((p) => p.stage === 'submitted').length;
  const notStarted = workspace.participants.filter((p) =>
    ['invoice_generated', 'not_started', 'in_progress'].includes(p.stage)
  ).length;

  return (
    <PanelSection
      icon={Users}
      title="Supplier Onboarding"
      badge={
        <>
          <StatusBadge count={awaiting} variant="action" />
          <StatusBadge count={notStarted} variant="review" />
        </>
      }
    >
      <div className="divide-y">
        {workspace.participants.map((s) => (
          <OnboardingSupplierRow key={s.participantId} supplier={s} />
        ))}
      </div>
      {workspace.primaryCta && (
        <div className="p-4">
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
      {workspace.completedCount === workspace.totalCount && (
        <div className="p-4 flex items-center gap-2 text-green-700">
          <CheckCircle2 className="h-4 w-4" />
          <p className="text-sm font-medium">All suppliers have completed onboarding.</p>
        </div>
      )}
    </PanelSection>
  );
}

/* ─── Section 2: Invoice Status ──────────────────────────────────────────── */

function InvoiceStatusPanel({
  workspace,
}: {
  workspace: WorkspaceOnboardingStatus;
}) {
  const invoiceStates = workspace.participants.map((p) => ({
    name: p.participantName,
    invoice: p.draftInvoice,
    stage: p.stage,
  }));

  if (invoiceStates.length === 0) return null;

  return (
    <PanelSection icon={FileText} title="Invoice Status">
      <div className="divide-y">
        {invoiceStates.map((item, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground">
                {item.stage === 'xero_exported'
                  ? 'Exported to Xero'
                  : item.stage === 'operator_approved'
                  ? 'Approved — awaiting export'
                  : item.stage === 'submitted'
                  ? 'Under review'
                  : 'Generated — awaiting supplier'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold">
                {fmt(item.invoice.total, item.invoice.currency)}
              </p>
              <p className="text-xs text-muted-foreground">
                {getSupplierGstTaxTreatment(item.invoice.gstStatus).displayStatus}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 py-3 border-t flex justify-between text-sm">
        <span className="text-muted-foreground">Total invoiced</span>
        <span className="font-semibold">
          {fmt(
            invoiceStates.reduce((sum, i) => sum + i.invoice.total, 0),
            invoiceStates[0]?.invoice.currency ?? 'AUD'
          )}
        </span>
      </div>
    </PanelSection>
  );
}

/* ─── Section 3: Accounting Status ──────────────────────────────────────── */

function AccountingStatusPanel({
  accountingSync,
  onExport,
}: {
  accountingSync: WorkspaceAccountingSyncStatus;
  onExport?: () => void;
}) {
  const readyCount = accountingSync.readyToExportCount;
  const exportedCount = accountingSync.participants.filter((p) => p.status === 'exported').length;
  const failedCount = accountingSync.failedCount;

  return (
    <PanelSection
      icon={BarChart3}
      title="Accounting"
      badge={
        <>
          <StatusBadge count={readyCount} variant="action" />
          <StatusBadge count={failedCount} variant="action" />
        </>
      }
    >
      <div className="px-4 py-3 grid grid-cols-3 gap-4 border-b">
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Exported</p>
          <p className="text-lg font-bold text-green-700">{exportedCount}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Ready</p>
          <p className="text-lg font-bold text-amber-700">{readyCount}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Failed</p>
          <p className="text-lg font-bold text-red-700">{failedCount}</p>
        </div>
      </div>
      {accountingSync.primaryCta && (
        <div className="p-4">
          <button
            type="button"
            onClick={onExport}
            className="w-full flex items-center justify-center gap-2 rounded-md border border-primary text-primary py-2 text-sm font-medium hover:bg-primary/5 transition-colors"
          >
            {accountingSync.primaryCta}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
      {accountingSync.overallStatus === 'all_exported' && (
        <div className="p-4 flex items-center gap-2 text-green-700">
          <CheckCircle2 className="h-4 w-4" />
          <p className="text-sm font-medium">All invoices exported to Xero.</p>
        </div>
      )}
    </PanelSection>
  );
}

/* ─── Section 4: Settlement Readiness ───────────────────────────────────── */

function SettlementReadinessPanel({
  settlement,
  onReview,
}: {
  settlement: WorkspaceSettlementReadiness;
  onReview?: () => void;
}) {
  const readyCount = settlement.readyCount;
  const total = settlement.participants.length;
  const blockedCount = settlement.blockedCount ?? (total - readyCount);

  return (
    <PanelSection
      icon={CheckCircle2}
      title="Settlement Readiness"
      badge={<StatusBadge count={blockedCount} variant="action" />}
    >
      <div className="divide-y">
        {settlement.participants.map((p) => (
          <div key={p.participantId} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">{p.participantName}</p>
              <p className="text-xs text-muted-foreground">
                {p.readyToSettle ? 'Ready to settle' : p.nextAction ?? 'Incomplete'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium text-muted-foreground">{p.readinessScore}%</p>
              {p.readyToSettle
                ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                : <Clock className="h-4 w-4 text-amber-500" />}
            </div>
          </div>
        ))}
      </div>
      {readyCount < total && (
        <div className="p-4">
          <button
            type="button"
            onClick={onReview}
            className="w-full flex items-center justify-center gap-2 rounded-md border py-2 text-sm font-medium hover:bg-muted/30 transition-colors"
          >
            Review settlement checklist
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
      {readyCount === total && total > 0 && (
        <div className="p-4 flex items-center gap-2 text-green-700">
          <CheckCircle2 className="h-4 w-4" />
          <p className="text-sm font-medium">All participants are ready for settlement.</p>
        </div>
      )}
    </PanelSection>
  );
}

/* ─── Root component ─────────────────────────────────────────────────────── */

export type CommercialWorkflowMoneyPanelProps = {
  onboarding: WorkspaceOnboardingStatus;
  accountingSync: WorkspaceAccountingSyncStatus;
  settlement: WorkspaceSettlementReadiness;
  onContinueOnboarding?: () => void;
  onExportToXero?: () => void;
  onReviewSettlement?: () => void;
};

/**
 * CommercialWorkflowMoneyPanel
 *
 * The complete commercial pipeline for the Money/Funding page.
 * Shows all four downstream stages of the agreement workflow:
 *   Supplier Onboarding → Invoice Status → Accounting → Settlement Readiness
 */
export function CommercialWorkflowMoneyPanel({
  onboarding,
  accountingSync,
  settlement,
  onContinueOnboarding,
  onExportToXero,
  onReviewSettlement,
}: CommercialWorkflowMoneyPanelProps) {
  const allOnboardingComplete = onboarding.completedCount === onboarding.totalCount;
  const allExported = accountingSync.overallStatus === 'all_exported';
  const allSettled = settlement.readyCount === settlement.participants.length;

  return (
    <div className="space-y-4">
      {/* Only show onboarding panel if there is outstanding work */}
      {!allOnboardingComplete && (
        <OnboardingProgressPanel
          workspace={onboarding}
          onContinue={onContinueOnboarding}
        />
      )}

      {/* Invoice status always visible when there are invoices */}
      {onboarding.totalCount > 0 && (
        <InvoiceStatusPanel workspace={onboarding} />
      )}

      {/* Accounting — show when there are exportable invoices */}
      {accountingSync.totalExportable > 0 && (
        <AccountingStatusPanel
          accountingSync={accountingSync}
          onExport={onExportToXero}
        />
      )}

      {/* Settlement — show when there are participants to settle */}
      {settlement.participants.length > 0 && (
        <SettlementReadinessPanel
          settlement={settlement}
          onReview={onReviewSettlement}
        />
      )}
    </div>
  );
}
