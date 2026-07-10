'use client';

import { PRODUCT_TERMINOLOGY } from '@/lib/product/product-terminology';
import { cn } from '@/lib/utils';
import type { AttentionItem } from '@/lib/operations/severity';
import type { OperationalAuditEntry } from '@/lib/operations/audit/operational-audit';

type WorkloadSnapshotProps = {
  attentionItems: AttentionItem[];
  auditEntries: OperationalAuditEntry[];
  loading?: boolean;
};

type WorkloadTile = {
  label: string;
  value: string | number;
  tone?: 'default' | 'urgent' | 'positive' | 'muted';
  sublabel?: string;
};

const TODAY_START = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

function countCompletedToday(entries: OperationalAuditEntry[]): number {
  const todayStart = TODAY_START();
  const completionTypes: OperationalAuditEntry['type'][] = [
    'agreement_approved',
    'payment_rails_connected',
    'stripe_connected',
    'funding_linked',
    'funding_reserved_against_obligations',
    'obligations_generated',
    'payout_eligible',
    'release_batch_generated',
    'compensation_updated',
  ];
  return entries.filter((e) => {
    try {
      return new Date(e.timestamp) >= todayStart && completionTypes.includes(e.type);
    } catch {
      return false;
    }
  }).length;
}

/**
 * Replaces abstract "average health" with operator-oriented workload counts.
 * Operators think in tasks, not statistics.
 */
export function WorkloadSnapshot({
  attentionItems,
  auditEntries,
  loading,
}: WorkloadSnapshotProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl border border-border/50 bg-muted/15 animate-pulse" />
        ))}
      </div>
    );
  }

  const todayWork = attentionItems.filter(
    (i) => i.severity === 'CRITICAL' || i.severity === 'ACTION_REQUIRED'
  ).length;

  const allOpen = attentionItems.filter(
    (i) => i.severity !== 'INFORMATIONAL'
  ).length;

  const completedToday = countCompletedToday(auditEntries);

  const tiles: WorkloadTile[] = [
    {
      label: "Today's work",
      value: todayWork > 0 ? todayWork : '—',
      tone: todayWork > 0 ? 'urgent' : 'muted',
      sublabel: todayWork > 0 ? `task${todayWork === 1 ? '' : 's'} to action` : 'all clear',
    },
    {
      label: 'Open tasks',
      value: allOpen > 0 ? allOpen : '—',
      tone: allOpen > 0 ? 'default' : 'muted',
      sublabel: allOpen > 0 ? PRODUCT_TERMINOLOGY.acrossAllProjects : 'nothing outstanding',
    },
    {
      label: 'Completed today',
      value: completedToday > 0 ? completedToday : '—',
      tone: completedToday > 0 ? 'positive' : 'muted',
      sublabel: completedToday > 0 ? `action${completedToday === 1 ? '' : 's'} done` : 'none yet',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {tiles.map((tile) => (
        <WorkloadTileCard key={tile.label} {...tile} />
      ))}
    </div>
  );
}

function WorkloadTileCard({ label, value, tone = 'default', sublabel }: WorkloadTile) {
  return (
    <div className="rounded-xl border border-border/55 bg-white/65 px-3 py-3 space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 leading-tight">
        {label}
      </p>
      <p
        className={cn(
          'text-xl font-semibold tabular-nums leading-none',
          tone === 'urgent' && 'text-amber-700',
          tone === 'positive' && 'text-[rgb(29,111,66)]',
          tone === 'default' && 'text-foreground',
          tone === 'muted' && 'text-muted-foreground font-normal text-base'
        )}
      >
        {value}
      </p>
      {sublabel ? (
        <p className="text-[11px] text-muted-foreground/70 leading-tight">{sublabel}</p>
      ) : null}
    </div>
  );
}
