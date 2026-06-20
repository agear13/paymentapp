'use client';

/**
 * BreakdownItemRow
 *
 * Shared atomic component for a single line item in any explainability drawer.
 * Every row displays the evidence chain: source → amount → status → confidence.
 * Rows link to the agreement, invoice, and commercial timeline.
 */

import * as React from 'react';
import { ExternalLink, FileText, BookOpen, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { CommercialBreakdownItem, ExplainabilitySourceType } from '@/lib/commercial/commercial-explainability';
import { formatForecastAmount } from '@/lib/commercial/commercial-forecast';

/* ─── Status helpers ─────────────────────────────────────────────────────────── */

type StatusVariant = 'confirmed' | 'pending' | 'forecast' | 'overdue' | 'warning' | 'neutral';

function resolveStatusVariant(status: string): StatusVariant {
  const s = status.toLowerCase();
  if (s.includes('confirmed') || s.includes('received') || s.includes('payment received') || s.includes('funded')) return 'confirmed';
  if (s.includes('overdue')) return 'overdue';
  if (s.includes('forecast') || s.includes('forecasted')) return 'forecast';
  if (s.includes('pending') || s.includes('awaiting')) return 'pending';
  if (s.includes('risk') || s.includes('warning')) return 'warning';
  return 'neutral';
}

const STATUS_BADGE_CLASS: Record<StatusVariant, string> = {
  confirmed: 'bg-green-50 text-green-700 border-green-200',
  pending:   'bg-blue-50 text-blue-700 border-blue-200',
  forecast:  'bg-purple-50 text-purple-700 border-purple-200',
  overdue:   'bg-red-50 text-red-600 border-red-200',
  warning:   'bg-amber-50 text-amber-700 border-amber-200',
  neutral:   'bg-muted text-muted-foreground border-border',
};

/* ─── Source type label ──────────────────────────────────────────────────────── */

function SourceTypeLabel({ sourceType }: { sourceType: ExplainabilitySourceType }) {
  return (
    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      {sourceType}
    </span>
  );
}

/* ─── Accounting note ────────────────────────────────────────────────────────── */

function AccountingNote({ hasLedgerEntries }: { hasLedgerEntries: boolean }) {
  if (hasLedgerEntries) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-green-700">
        <BookOpen className="h-2.5 w-2.5" />
        Ledger entries exist
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70">
      <BookOpen className="h-2.5 w-2.5" />
      Commercial commitment only — no accounting entries yet
    </span>
  );
}

/* ─── Confidence bar ─────────────────────────────────────────────────────────── */

function ConfidenceBar({ score }: { score: number }) {
  const barClass =
    score >= 80 ? 'bg-green-500' :
    score >= 50 ? 'bg-amber-500' :
    'bg-red-400';

  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1 w-16 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', barClass)}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-[10px] font-medium text-muted-foreground tabular-nums">{score}%</span>
    </div>
  );
}

/* ─── Props ──────────────────────────────────────────────────────────────────── */

export type BreakdownItemRowProps = {
  item: CommercialBreakdownItem;
  showConfidence?: boolean;
  projectId?: string;
  onViewTimeline?: (item: CommercialBreakdownItem) => void;
  onViewLedger?: (item: CommercialBreakdownItem) => void;
};

/* ─── Component ──────────────────────────────────────────────────────────────── */

export function BreakdownItemRow({
  item,
  showConfidence = false,
  projectId,
  onViewTimeline,
  onViewLedger,
}: BreakdownItemRowProps) {
  const statusVariant = resolveStatusVariant(item.status);

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        {/* Left: description + metadata */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Source type */}
          <SourceTypeLabel sourceType={item.sourceType} />

          {/* Primary description */}
          <p className="text-sm font-semibold text-foreground leading-tight truncate">
            {item.description}
          </p>

          {/* Participant name if different from description */}
          {item.participantName && item.participantName !== item.description && (
            <p className="text-xs text-muted-foreground">{item.participantName}</p>
          )}

          {/* Commercial stage */}
          {item.commercialStage && (
            <p className="text-xs text-muted-foreground">{item.commercialStage}</p>
          )}

          {/* Invoice reference */}
          {item.invoiceReference && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <FileText className="h-3 w-3" />
              {item.invoiceReference}
            </div>
          )}

          {/* Accounting note */}
          <AccountingNote hasLedgerEntries={item.hasLedgerEntries} />

          {/* Confidence bar */}
          {showConfidence && item.confidence != null && (
            <div className="pt-0.5">
              <ConfidenceBar score={item.confidence} />
            </div>
          )}

          {/* Confidence reasons */}
          {showConfidence && item.confidenceReasons && item.confidenceReasons.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {item.confidenceReasons.map((reason, i) => (
                <li key={i} className="flex items-start gap-1 text-[11px] text-muted-foreground">
                  <span className={reason.positive ? 'text-green-600' : 'text-red-500'}>
                    {reason.positive ? '✓' : '✗'}
                  </span>
                  {reason.label}
                </li>
              ))}
            </ul>
          )}

          {/* Action links */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {item.agreementId && (
              <a
                href={projectId ? `/dashboard/projects/${item.agreementId}` : '#'}
                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
              >
                <ExternalLink className="h-2.5 w-2.5" />
                View Agreement
              </a>
            )}
            {onViewTimeline && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-[11px] text-muted-foreground hover:text-foreground hover:bg-transparent"
                onClick={() => onViewTimeline(item)}
              >
                <BarChart2 className="h-2.5 w-2.5 mr-1" />
                View History
              </Button>
            )}
            {onViewLedger && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-[11px] text-muted-foreground hover:text-foreground hover:bg-transparent"
                onClick={() => onViewLedger(item)}
              >
                <BookOpen className="h-2.5 w-2.5 mr-1" />
                {item.hasLedgerEntries ? 'View Ledger Entries' : 'No Accounting Entries Yet'}
              </Button>
            )}
          </div>
        </div>

        {/* Right: amount + status */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className="text-sm font-bold tabular-nums text-foreground">
            {formatForecastAmount(item.amount, item.currency)}
          </span>
          <Badge
            variant="outline"
            className={cn('text-[10px] h-4 px-1.5', STATUS_BADGE_CLASS[statusVariant])}
          >
            {item.status}
          </Badge>
        </div>
      </div>
    </div>
  );
}

/* ─── Empty state ─────────────────────────────────────────────────────────────── */

export function BreakdownEmptyState({
  title,
  checklist,
}: {
  title: string;
  checklist?: string[];
}) {
  return (
    <div className="py-8 text-center space-y-3">
      <p className="text-sm text-muted-foreground">{title}</p>
      {checklist && checklist.length > 0 && (
        <ul className="text-left inline-block space-y-1">
          {checklist.map((item, i) => (
            <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="text-muted-foreground/50">◦</span>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ─── Total row ──────────────────────────────────────────────────────────────── */

export function BreakdownTotalRow({
  label = 'Total',
  amount,
  currency,
}: {
  label?: string;
  amount: number;
  currency: string;
}) {
  return (
    <div className="flex items-center justify-between pt-3 mt-1 border-t">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <span className="text-sm font-bold tabular-nums text-foreground">
        {formatForecastAmount(amount, currency)}
      </span>
    </div>
  );
}
