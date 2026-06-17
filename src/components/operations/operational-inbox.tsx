'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { AttentionItem, OperationalSeverity } from '@/lib/operations/severity';

type OperationalInboxProps = {
  items: AttentionItem[];
};

const SEVERITY_DOT: Record<OperationalSeverity, string> = {
  CRITICAL: 'bg-red-500',
  ACTION_REQUIRED: 'bg-amber-400',
  WARNING: 'bg-muted-foreground/40',
  INFORMATIONAL: 'bg-muted-foreground/25',
};

const SEVERITY_SORT: Record<OperationalSeverity, number> = {
  CRITICAL: 0,
  ACTION_REQUIRED: 1,
  WARNING: 2,
  INFORMATIONAL: 3,
};

const CTA_LABELS: Record<OperationalSeverity, string> = {
  CRITICAL: 'Fix',
  ACTION_REQUIRED: 'Review',
  WARNING: 'View',
  INFORMATIONAL: 'View',
};

/**
 * Linear-style operational inbox — one row per actionable item, sorted by impact.
 * Replaces card-based attention board on the dashboard.
 */
export function OperationalInbox({ items }: OperationalInboxProps) {
  const visible = [...items]
    .filter((i) => i.severity === 'CRITICAL' || i.severity === 'ACTION_REQUIRED')
    .sort((a, b) => SEVERITY_SORT[a.severity] - SEVERITY_SORT[b.severity]);

  if (visible.length === 0) return null;

  return (
    <section aria-label="Needs your attention" className="space-y-2.5">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold text-foreground">Needs attention</h2>
        <span className="text-xs text-muted-foreground">
          {visible.length} item{visible.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="rounded-xl border border-border/60 bg-white/60 overflow-hidden divide-y divide-border/40">
        {visible.map((item) => (
          <InboxRow key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

function InboxRow({ item }: { item: AttentionItem }) {
  const dot = SEVERITY_DOT[item.severity];
  const defaultCta = CTA_LABELS[item.severity];
  const isCritical = item.severity === 'CRITICAL';

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 hover:bg-muted/20 transition-colors duration-100',
        isCritical && 'bg-red-500/[0.02]'
      )}
    >
      {/* Severity dot */}
      <span
        className={cn('mt-1.5 h-2 w-2 rounded-full shrink-0 ring-2 ring-background', dot)}
        aria-hidden
      />

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-0.5">
        <p
          className={cn(
            'text-sm font-medium leading-snug',
            isCritical ? 'text-foreground' : 'text-foreground/90'
          )}
        >
          {item.title}
        </p>
        <p className="text-xs text-muted-foreground leading-snug">
          {item.projectName ? (
            <span className="font-medium text-foreground/70">{item.projectName} · </span>
          ) : null}
          {item.explanation}
        </p>
        {item.confidenceImpact ? (
          <p className="text-[11px] text-muted-foreground/70 mt-0.5">{item.confidenceImpact}</p>
        ) : null}
      </div>

      {/* CTA */}
      {item.ctaHref ? (
        <Button
          asChild
          variant={isCritical ? 'default' : 'outline'}
          size="sm"
          className="shrink-0 h-7 text-xs mt-0.5"
        >
          <Link href={item.ctaHref}>{item.ctaLabel ?? defaultCta}</Link>
        </Button>
      ) : null}
    </div>
  );
}
