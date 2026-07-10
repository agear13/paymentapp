'use client';

import { PRODUCT_TERMINOLOGY } from '@/lib/product/product-terminology';

/**
 * Accounting Status Widget
 *
 * Dashboard component for accounting export status.
 * Consumes only `deriveAccountingSyncStatus()` — no independent logic.
 *
 * Shows:
 *   Ready to export   (how many participants need exporting)
 *   Exported today    (progress)
 *   Failed exports    (errors needing attention)
 *   Needs review      (entries requiring manual check)
 *   One primary CTA
 *
 * Design rules:
 *   - Never shows technical accounting language.
 *   - Never duplicates settlement widget data.
 *   - Always provides one recommended next action.
 *   - Shows preview details (supplier, amount, GST) in the expand panel.
 */

import * as React from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  RefreshCw,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type {
  WorkspaceAccountingSyncStatus,
  AccountingExportModel,
} from '@/lib/commercial/accounting-export';
import { formatExportAmount } from '@/lib/commercial/accounting-export';
import type { AccountingSyncStatus } from '@/lib/commercial/accounting-connector';

/* ─── Props ───────────────────────────────────────────────────────────────── */

export type AccountingStatusWidgetProps = {
  syncStatus: WorkspaceAccountingSyncStatus;
  loading?: boolean;
  className?: string;
  onExportParticipant?: (participantId: string) => void;
  onResolveError?: (participantId: string) => void;
};

/* ─── Main component ──────────────────────────────────────────────────────── */

export function AccountingStatusWidget({
  syncStatus,
  loading = false,
  className,
  onExportParticipant,
  onResolveError,
}: AccountingStatusWidgetProps) {
  if (loading) {
    return (
      <div className={cn('rounded-xl border border-border/50 bg-card p-5 animate-pulse', className)}>
        <div className="h-4 w-40 bg-muted rounded mb-3" />
        <div className="h-2 w-full bg-muted rounded mb-2" />
        <div className="h-2 w-3/4 bg-muted rounded" />
      </div>
    );
  }

  const { participants, readyToExportCount, exportedTodayCount, failedCount, needsReviewCount, totalExportable, primaryCta, overallStatus } = syncStatus;

  if (totalExportable === 0) {
    return (
      <div className={cn('rounded-xl border border-border/50 bg-card px-5 py-4', className)}>
        <p className="text-sm font-semibold text-foreground">Accounting</p>
        <p className="text-xs text-muted-foreground mt-1">No accounting exports required {PRODUCT_TERMINOLOGY.forThisProject}.</p>
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border border-border/50 bg-card px-5 py-4 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">Accounting</p>
          {failedCount > 0 && (
            <Badge variant="destructive" className="text-xs h-5">
              {failedCount} failed
            </Badge>
          )}
          {needsReviewCount > 0 && (
            <Badge variant="outline" className="text-xs h-5 bg-amber-50 text-amber-700 border-amber-200">
              {needsReviewCount} review
            </Badge>
          )}
        </div>
        <OverallStatusBadge status={overallStatus} />
      </div>

      {/* Summary grid */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <SummaryCell label="Ready" value={readyToExportCount} highlight={readyToExportCount > 0} />
        <SummaryCell label="Exported" value={exportedTodayCount} />
        <SummaryCell label="Failed" value={failedCount} error={failedCount > 0} />
        <SummaryCell label="Review" value={needsReviewCount} warning={needsReviewCount > 0} />
      </div>

      {/* Participant rows */}
      <div className="space-y-1.5">
        {participants.map((model) => (
          <ParticipantExportRow
            key={model.participantId}
            model={model}
            onExport={onExportParticipant}
            onResolve={onResolveError}
          />
        ))}
      </div>

      {/* Primary CTA */}
      {primaryCta && (onExportParticipant || onResolveError) && (
        <button
          type="button"
          onClick={() => {
            const firstReady = participants.find(
              (m) => m.exportReadiness.ready && m.status === 'ready'
            );
            const firstFailed = participants.find((m) => m.status === 'failed');
            if (firstFailed && onResolveError) {
              onResolveError(firstFailed.participantId);
            } else if (firstReady && onExportParticipant) {
              onExportParticipant(firstReady.participantId);
            }
          }}
          className="w-full text-xs font-medium text-primary hover:underline py-1"
        >
          {primaryCta}
        </button>
      )}
    </div>
  );
}

/* ─── Summary cell ────────────────────────────────────────────────────────── */

function SummaryCell({
  label,
  value,
  highlight = false,
  error = false,
  warning = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  error?: boolean;
  warning?: boolean;
}) {
  return (
    <div>
      <p
        className={cn(
          'text-xl font-bold tabular-nums',
          error ? 'text-red-600' : warning ? 'text-amber-600' : highlight ? 'text-blue-600' : 'text-foreground'
        )}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

/* ─── Overall status badge ────────────────────────────────────────────────── */

function OverallStatusBadge({ status }: { status: WorkspaceAccountingSyncStatus['overallStatus'] }) {
  const configs = {
    all_exported: { label: 'Complete', className: 'bg-green-50 text-green-700 border-green-200' },
    in_progress: { label: 'In progress', className: 'bg-blue-50 text-blue-700 border-blue-200' },
    blocked: { label: 'Blocked', className: 'bg-red-50 text-red-700 border-red-200' },
    not_started: { label: 'Not started', className: 'bg-muted text-muted-foreground' },
  };
  const { label, className } = configs[status];
  return (
    <Badge variant="outline" className={cn('text-xs', className)}>
      {label}
    </Badge>
  );
}

/* ─── Per-participant export row ──────────────────────────────────────────── */

function ParticipantExportRow({
  model,
  onExport,
  onResolve,
}: {
  model: AccountingExportModel;
  onExport?: (id: string) => void;
  onResolve?: (id: string) => void;
}) {
  const [expanded, setExpanded] = React.useState(
    model.status === 'failed' || model.status === 'needs_review'
  );

  const statusIcon = {
    ready: model.exportReadiness.ready
      ? <FileText className="h-3.5 w-3.5 text-blue-500" />
      : <FileText className="h-3.5 w-3.5 text-muted-foreground/40" />,
    exporting: <RefreshCw className="h-3.5 w-3.5 text-blue-500 animate-spin" />,
    exported: <Check className="h-3.5 w-3.5 text-green-600" />,
    failed: <X className="h-3.5 w-3.5 text-red-500" />,
    needs_review: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />,
    re_export_required: <RefreshCw className="h-3.5 w-3.5 text-amber-500" />,
  }[model.status as AccountingSyncStatus] ?? <FileText className="h-3.5 w-3.5 text-muted-foreground" />;

  const hasDetails =
    model.status !== 'exported' && (model.preview !== null || model.failureReason !== null);

  return (
    <div
      className={cn(
        'rounded-lg border border-border/40 px-3 py-2 space-y-1.5',
        model.status === 'failed' && 'border-red-200 bg-red-50/20',
        model.status === 'needs_review' && 'border-amber-200 bg-amber-50/20',
        model.status === 'exported' && 'opacity-70'
      )}
    >
      <div className="flex items-center gap-2">
        <span className="shrink-0">{statusIcon}</span>
        <span className="text-xs font-medium text-foreground flex-1 truncate">
          {model.participantName}
        </span>
        <span className="text-xs text-muted-foreground shrink-0">{model.statusLabel}</span>
        {hasDetails && (
          <button
            type="button"
            className="shrink-0"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded
              ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
              : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          </button>
        )}
      </div>

      {expanded && (
        <div className="pl-5.5 space-y-2">
          {/* Preview */}
          {model.preview && (
            <div className="rounded-md bg-muted/40 p-2 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Supplier</span>
                <span className="font-medium">{model.preview.supplier}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">
                  {formatExportAmount(model.preview.amount, model.preview.currency)}
                </span>
              </div>
              {model.preview.gstIncluded && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GST</span>
                  <span className="font-medium">
                    {formatExportAmount(model.preview.gstAmount, model.preview.currency)}
                  </span>
                </div>
              )}
              {model.preview.invoiceNumber && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice</span>
                  <span className="font-medium">{model.preview.invoiceNumber}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">System</span>
                <span className="font-medium">{model.preview.accountingSystemLabel}</span>
              </div>
            </div>
          )}

          {/* Failure reason */}
          {model.failureReason && (
            <div className="space-y-0.5">
              <p className="text-xs text-red-700">{model.failureReason}</p>
              {model.failureAction && (
                <p className="text-xs font-medium text-red-800">{model.failureAction}</p>
              )}
            </div>
          )}

          {/* Blockers */}
          {!model.exportReadiness.ready && model.exportReadiness.blockers.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {model.exportReadiness.blockers[0].explanation}
            </p>
          )}

          {/* Action buttons */}
          {model.exportReadiness.ready && model.status === 'ready' && onExport && (
            <button
              type="button"
              onClick={() => onExport(model.participantId)}
              className="text-xs font-medium text-primary hover:underline"
            >
              Review and export →
            </button>
          )}
          {model.status === 'failed' && onResolve && (
            <button
              type="button"
              onClick={() => onResolve(model.participantId)}
              className="text-xs font-medium text-red-700 hover:underline"
            >
              Resolve and retry →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
