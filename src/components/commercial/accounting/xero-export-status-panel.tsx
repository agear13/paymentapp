'use client';

/**
 * Xero Export Status Panel
 *
 * Shows the operator the current Xero export status for each participant.
 * For every participant the operator can see:
 *   - What will be exported (preview)
 *   - Whether export succeeded
 *   - Whether export failed and why
 *   - How to retry or resolve
 *   - Whether re-export is required (invoice changed after initial export)
 *
 * Design rules:
 *   - No silent failures — every failed export has a visible reason and action.
 *   - Every supplier bill preview is reviewable before the operator clicks
 *     "Push Supplier Bill to Xero".
 *   - Re-export required is shown as a warning, not hidden.
 *   - One primary action per participant.
 */

import * as React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  FileText,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AccountingExportModel, AccountingExportPreview } from '@/lib/commercial/accounting-export';
import type { AccountingSyncStatus } from '@/lib/commercial/accounting-connector';
import { formatForecastAmount } from '@/lib/commercial/commercial-forecast';

/* ─── Types ─────────────────────────────────────────────────────────────── */

export type XeroExportStatusPanelProps = {
  /** One model per participant, from deriveAccountingExport(). */
  participants: AccountingExportModel[];
  projectId: string;
  /** Called when operator approves and pushes a participant's export. */
  onPushToXero?: (participantId: string) => Promise<void>;
  className?: string;
};

/* ─── Export preview row ─────────────────────────────────────────────────── */

function ExportPreviewTable({ preview }: { preview: AccountingExportPreview }) {
  const rows: Array<[string, React.ReactNode]> = [
    ['Supplier', <span className="font-medium">{preview.supplier}</span>],
    ['Description', preview.description],
    ['Reference', <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{preview.reference}</code>],
    ['Invoice No.', preview.invoiceNumber ?? '—'],
    ['Amount', <span className="font-semibold tabular-nums">{formatForecastAmount(preview.amount, preview.currency)} {preview.currency}</span>],
    ['GST', preview.gstIncluded
      ? <span className="text-amber-700 dark:text-amber-300">{formatForecastAmount(preview.gstAmount, preview.currency)} {preview.currency} (included)</span>
      : <span className="text-muted-foreground">Not applicable</span>],
    ['Due Date', preview.dueDate ?? '—'],
  ];

  return (
    <div className="rounded-md border border-border/50 bg-muted/20 overflow-hidden text-xs">
      {rows.map(([label, value]) => (
        <div key={label as string} className="flex items-start px-3 py-2 border-b border-border/30 last:border-0 gap-3">
          <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
          <span className="text-foreground">{value}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Individual participant export card ─────────────────────────────────── */

function ParticipantExportCard({
  model,
  onPushToXero,
}: {
  model: AccountingExportModel;
  onPushToXero?: (participantId: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [pushing, setPushing] = React.useState(false);

  const handlePush = async () => {
    if (!onPushToXero || pushing) return;
    setPushing(true);
    try {
      await onPushToXero(model.participantId);
    } finally {
      setPushing(false);
    }
  };

  const statusConfig = {
    exported: {
      icon: <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />,
      label: model.statusLabel,
      badgeVariant: 'outline' as const,
      badgeClass: 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-400',
    },
    failed: {
      icon: <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />,
      label: 'Failed',
      badgeVariant: 'outline' as const,
      badgeClass: 'border-red-300 text-red-700 dark:border-red-700 dark:text-red-400',
    },
    needs_review: {
      icon: <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
      label: model.statusLabel === 'Verify Payout Details' ? 'Verify Payout Details' : 'Needs review',
      badgeVariant: 'outline' as const,
      badgeClass: 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400',
    },
    re_export_required: {
      icon: <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
      label: 'Re-export required',
      badgeVariant: 'outline' as const,
      badgeClass: 'border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400',
    },
    exporting: {
      icon: <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />,
      label: 'Pushing supplier bill…',
      badgeVariant: 'secondary' as const,
      badgeClass: '',
    },
    ready: {
      icon: <FileText className="h-4 w-4 text-muted-foreground" />,
      label: model.exportReadiness.ready ? 'Push Supplier Bill to Xero' : model.statusLabel,
      badgeVariant: 'secondary' as const,
      badgeClass: '',
    },
  } satisfies Record<
    AccountingSyncStatus,
    { icon: React.ReactNode; label: string; badgeVariant: 'default' | 'secondary' | 'outline'; badgeClass: string }
  >;

  const config = statusConfig[model.status] ?? statusConfig.ready;

  const canExport = model.exportReadiness.ready && model.status !== 'exported' && onPushToXero;
  const showBlockers = !model.exportReadiness.ready && model.exportReadiness.blockers.length > 0;

  return (
    <div className={cn(
      'rounded-lg border p-4 space-y-3',
      model.status === 'failed' && 'border-red-200/60 bg-red-50/20 dark:border-red-800/30',
      model.status === 'exported' && 'border-green-200/60 bg-green-50/20 dark:border-green-800/30',
      model.status === 're_export_required' && 'border-blue-200/60 bg-blue-50/20 dark:border-blue-800/30',
      model.status === 'needs_review' && 'border-amber-200/60 bg-amber-50/20 dark:border-amber-800/30',
      !['failed', 'exported', 're_export_required', 'needs_review'].includes(model.status) && 'border-border/50 bg-card',
    )}>
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {config.icon}
          <div className="min-w-0">
            <span className="text-sm font-semibold text-foreground">{model.participantName}</span>
            <span className="text-xs text-muted-foreground ml-1.5">({model.participantRole})</span>
          </div>
          <Badge variant={config.badgeVariant} className={cn('text-xs h-5', config.badgeClass)}>
            {config.label}
          </Badge>
          {model.reExportRequired && model.status === 'exported' && (
            <Badge variant="outline" className="text-xs h-5 border-blue-300 text-blue-700">
              Re-export required
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Preview toggle */}
          {model.preview && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => setExpanded((e) => !e)}
            >
              Preview
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          )}

          {/* Primary action */}
          {canExport && (
            <Button
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={handlePush}
              disabled={pushing}
            >
              {pushing ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Pushing…
                </>
              ) : model.status === 're_export_required' ? (
                <>
                  <RefreshCw className="h-3 w-3" />
                  Push Supplier Bill to Xero
                </>
              ) : (
                <>
                  <ExternalLink className="h-3 w-3" />
                  Push Supplier Bill to Xero
                </>
              )}
            </Button>
          )}

          {/* Xero reference link when exported */}
          {model.status === 'exported' && model.providerReference && (
            <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
              {model.providerReference}
            </span>
          )}
        </div>
      </div>

      {/* Export preview table */}
      {expanded && model.preview && (
        <ExportPreviewTable preview={model.preview} />
      )}

      {/* Failure reason — never silent */}
      {model.status === 'failed' && model.failureReason && (
        <div className="rounded-md bg-red-100/50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/30 p-3">
          <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">Export failed</p>
          <p className="text-xs text-red-600 dark:text-red-300">{model.failureReason}</p>
          {model.failureAction && (
            <p className="text-xs text-red-600/80 dark:text-red-300/80 mt-1 font-medium">
              Action: {model.failureAction}
            </p>
          )}
        </div>
      )}

      {/* Needs review explanation */}
      {model.status === 'needs_review' && model.failureReason && (
        <div className="rounded-md bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30 p-3">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Review required before export</p>
          <p className="text-xs text-amber-600 dark:text-amber-300">{model.failureReason}</p>
          {model.failureAction && (
            <p className="text-xs text-amber-600/80 dark:text-amber-300/80 mt-1 font-medium">
              {model.failureAction}
            </p>
          )}
        </div>
      )}

      {/* Re-export warning */}
      {model.reExportRequired && model.status !== 'failed' && (
        <div className="rounded-md bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30 p-3">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">Invoice updated since last export</p>
          <p className="text-xs text-blue-600 dark:text-blue-300">
            The invoice amount or details have changed since this participant was exported to Xero. A re-export is required to keep the accounting record current.
          </p>
        </div>
      )}

      {/* Export blockers */}
      {showBlockers && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground">Blocked by:</p>
          {model.exportReadiness.blockers.map((blocker, i) => (
            <div key={i} className="flex items-start gap-2">
              <XCircle className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />
              <div className="text-xs">
                <span className="text-foreground">{blocker.explanation}</span>
                {blocker.action && (
                  <span className="text-muted-foreground"> — {blocker.action}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Export timestamp */}
      {model.exportedAt && (
        <p className="text-xs text-muted-foreground">
          Exported {new Date(model.exportedAt).toLocaleDateString('en-AU', {
            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
        </p>
      )}
    </div>
  );
}

/* ─── Main panel ─────────────────────────────────────────────────────────── */

/**
 * Renders the Xero export status for all participants in an agreement.
 *
 * @example
 * ```tsx
 * const syncStatus = deriveAccountingSyncStatus(workspaceInput);
 * <XeroExportStatusPanel
 *   participants={syncStatus.participants}
 *   projectId={projectId}
 *   onPushToXero={async (participantId) => {
 *     await fetch(`/api/projects/${projectId}/accounting/push`, {
 *       method: 'POST',
 *       body: JSON.stringify({ participantId }),
 *     });
 *   }}
 * />
 * ```
 */
export function XeroExportStatusPanel({
  participants,
  projectId: _projectId,
  onPushToXero,
  className,
}: XeroExportStatusPanelProps) {
  if (participants.length === 0) {
    return (
      <div className={cn('text-sm text-muted-foreground text-center py-6', className)}>
        No participants are ready for accounting export.
      </div>
    );
  }

  const exportedCount = participants.filter((p) => p.status === 'exported').length;
  const failedCount = participants.filter((p) => p.status === 'failed').length;
  const needsReviewCount = participants.filter((p) => p.status === 'needs_review' || p.reExportRequired).length;

  return (
    <div className={cn('space-y-3', className)}>
      {/* Summary bar */}
      {participants.length > 1 && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground pb-1">
          {exportedCount > 0 && (
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {exportedCount} exported
            </span>
          )}
          {failedCount > 0 && (
            <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
              <XCircle className="h-3.5 w-3.5" />
              {failedCount} failed
            </span>
          )}
          {needsReviewCount > 0 && (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              {needsReviewCount} need attention
            </span>
          )}
        </div>
      )}

      {participants.map((model) => (
        <ParticipantExportCard
          key={model.participantId}
          model={model}
          onPushToXero={onPushToXero}
        />
      ))}
    </div>
  );
}
