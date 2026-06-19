'use client';

/**
 * Settlement Readiness Checklist
 *
 * Displays the canonical settlement checklist for a participant.
 * Consumes only `deriveSettlementReadiness()` — no independent calculations.
 *
 * Two render modes:
 *   compact  — inline progress bar + status badge (for participant cards)
 *   full     — expanded checklist with all items and explanations
 */

import * as React from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronRight, Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type {
  SettlementReadinessResult,
  SettlementChecklistItem,
  ChecklistItemStatus,
} from '@/lib/commercial/settlement-readiness';
import {
  INVOICE_STATE_LABELS,
  invoiceStateProgress,
} from '@/lib/commercial/invoice-lifecycle';

/* ─── Props ──────────────────────────────────────────────────────────────── */

export type SettlementReadinessChecklistProps = {
  readiness: SettlementReadinessResult;
  /** 'compact' shows score + status badge; 'full' shows entire checklist. */
  mode?: 'compact' | 'full';
  /** Whether to show the invoice lifecycle progress. */
  showInvoiceState?: boolean;
  className?: string;
};

/* ─── Main component ──────────────────────────────────────────────────────── */

export function SettlementReadinessChecklist({
  readiness,
  mode = 'full',
  showInvoiceState = true,
  className,
}: SettlementReadinessChecklistProps) {
  if (mode === 'compact') {
    return <CompactReadiness readiness={readiness} className={className} />;
  }

  return <FullChecklist readiness={readiness} showInvoiceState={showInvoiceState} className={className} />;
}

/* ─── Compact mode ────────────────────────────────────────────────────────── */

function CompactReadiness({
  readiness,
  className,
}: {
  readiness: SettlementReadinessResult;
  className?: string;
}) {
  const { readinessScore, readyToSettle, nextAction, blockers } = readiness;

  return (
    <div className={cn('space-y-1.5', className)}>
      {/* Score bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              readyToSettle
                ? 'bg-green-500'
                : readinessScore >= 70
                  ? 'bg-amber-500'
                  : 'bg-red-400'
            )}
            style={{ width: `${readinessScore}%` }}
          />
        </div>
        <span className="text-xs font-medium tabular-nums text-muted-foreground w-8 text-right">
          {readinessScore}%
        </span>
      </div>

      {/* Status */}
      <div className="flex items-center gap-1.5">
        {readyToSettle ? (
          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
            <Check className="h-3 w-3 mr-1" />
            Ready
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
            <X className="h-3 w-3 mr-1" />
            {blockers.length > 0 ? `${blockers.length} blocker${blockers.length > 1 ? 's' : ''}` : 'Not ready'}
          </Badge>
        )}
        {!readyToSettle && nextAction && (
          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{nextAction}</p>
        )}
      </div>
    </div>
  );
}

/* ─── Full checklist mode ─────────────────────────────────────────────────── */

function FullChecklist({
  readiness,
  showInvoiceState,
  className,
}: {
  readiness: SettlementReadinessResult;
  showInvoiceState: boolean;
  className?: string;
}) {
  const { readinessScore, readyToSettle, checklist, blockers, nextAction, invoiceState, invoiceNotRequired } = readiness;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">Settlement Readiness</p>
          <Badge
            variant="outline"
            className={cn(
              'text-xs',
              readyToSettle
                ? 'bg-green-50 text-green-700 border-green-200'
                : readinessScore >= 70
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-red-50 text-red-700 border-red-200'
            )}
          >
            {readyToSettle ? 'Ready' : `${readinessScore}%`}
          </Badge>
        </div>
        {!readyToSettle && blockers.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {blockers.length} blocker{blockers.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            readyToSettle
              ? 'bg-green-500'
              : readinessScore >= 70
                ? 'bg-amber-500'
                : 'bg-red-400'
          )}
          style={{ width: `${readinessScore}%` }}
        />
      </div>

      {/* Invoice lifecycle (if relevant) */}
      {showInvoiceState && !invoiceNotRequired && (
        <div className="rounded-lg bg-muted/40 px-3 py-2 space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Invoice progress</p>
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-400 rounded-full"
                style={{ width: `${invoiceStateProgress(invoiceState)}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {INVOICE_STATE_LABELS[invoiceState]}
            </span>
          </div>
        </div>
      )}

      {/* Checklist */}
      <div className="space-y-1.5">
        {checklist.map((item) => (
          <ChecklistRow key={item.id} item={item} />
        ))}
      </div>

      {/* Next action callout */}
      {!readyToSettle && nextAction && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/40 px-3 py-2.5 flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-foreground">Recommended next action</p>
            <p className="text-xs text-muted-foreground">{nextAction}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Individual checklist row ────────────────────────────────────────────── */

function ChecklistRow({ item }: { item: SettlementChecklistItem }) {
  const [expanded, setExpanded] = React.useState(item.isBlocker && item.status !== 'complete');

  const icon = {
    complete: <Check className="h-3.5 w-3.5 text-green-600" />,
    in_progress: <Clock className="h-3.5 w-3.5 text-amber-500" />,
    missing: item.isBlocker
      ? <X className="h-3.5 w-3.5 text-red-500" />
      : <X className="h-3.5 w-3.5 text-muted-foreground/50" />,
  }[item.status];

  const labelClass: Record<ChecklistItemStatus, string> = {
    complete: 'text-foreground',
    in_progress: 'text-amber-700',
    missing: item.isBlocker ? 'text-red-700' : 'text-muted-foreground',
  };

  const hasDetails = item.status !== 'complete' && (item.explanation || item.action);

  return (
    <div>
      <button
        type="button"
        className={cn(
          'flex w-full items-center gap-2 text-left py-1 group',
          !hasDetails && 'cursor-default'
        )}
        onClick={() => hasDetails && setExpanded((v) => !v)}
        disabled={!hasDetails}
      >
        <span className="shrink-0">{icon}</span>
        <span className={cn('text-xs font-medium flex-1', labelClass[item.status])}>
          {item.label}
        </span>
        {hasDetails ? (
          expanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground/50 shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
          )
        ) : null}
      </button>

      {expanded && hasDetails && (
        <div className="ml-5.5 pl-2 pt-0.5 space-y-1 border-l border-border/40">
          {item.explanation && (
            <p className="text-xs text-muted-foreground leading-relaxed">{item.explanation}</p>
          )}
          {item.action && (
            <p className="text-xs font-medium text-foreground">{item.action}</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Settlement Readiness Widget (dashboard-level summary) ──────────────── */

export type SettlementReadinessWidgetProps = {
  results: SettlementReadinessResult[];
  loading?: boolean;
  className?: string;
  onContinue?: () => void;
};

export function SettlementReadinessWidget({
  results,
  loading = false,
  className,
  onContinue,
}: SettlementReadinessWidgetProps) {
  if (loading) {
    return (
      <div className={cn('rounded-xl border border-border/50 bg-card p-5 animate-pulse', className)}>
        <div className="h-4 w-40 bg-muted rounded mb-3" />
        <div className="h-2 w-full bg-muted rounded" />
      </div>
    );
  }

  if (results.length === 0) return null;

  const readyCount = results.filter((r) => r.readyToSettle).length;
  const blockedCount = results.length - readyCount;
  const avgScore = Math.round(results.reduce((s, r) => s + r.readinessScore, 0) / results.length);

  // Find the most common blocker
  const allBlockers = results.flatMap((r) => r.blockers);
  const primaryBlocker = allBlockers.find((b) => b.severity === 'critical') ?? allBlockers[0] ?? null;

  return (
    <div className={cn('rounded-xl border border-border/50 bg-card px-5 py-4 space-y-4', className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Settlement Readiness</p>
        <span className="text-xs text-muted-foreground">{results.length} participant{results.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Summary grid */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-2xl font-bold text-green-700 tabular-nums">{readyCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Ready</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-red-600 tabular-nums">{blockedCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Blocked</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground tabular-nums">{avgScore}%</p>
          <p className="text-xs text-muted-foreground mt-0.5">Average</p>
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="space-y-1">
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${Math.round((readyCount / results.length) * 100)}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground text-right">
          {Math.round((readyCount / results.length) * 100)}% ready for settlement
        </p>
      </div>

      {/* Primary bottleneck */}
      {primaryBlocker && (
        <div className="rounded-lg bg-muted/40 px-3 py-2 space-y-0.5">
          <p className="text-xs font-medium text-foreground">Primary bottleneck</p>
          <p className="text-xs text-muted-foreground">{primaryBlocker.title}</p>
          {primaryBlocker.action && (
            <p className="text-xs font-medium text-foreground">{primaryBlocker.action}</p>
          )}
        </div>
      )}

      {/* CTA */}
      {blockedCount > 0 && onContinue && (
        <button
          type="button"
          onClick={onContinue}
          className="w-full text-center text-xs font-medium text-primary hover:underline py-1"
        >
          Continue settlement preparation
        </button>
      )}
    </div>
  );
}
