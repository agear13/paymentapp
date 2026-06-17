'use client';

import Link from 'next/link';
import { AlertCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AttentionItem, OperationalSeverity } from '@/lib/operations/severity';

type NeedsAttentionCardsProps = {
  items: AttentionItem[];
};

const SEVERITY_CONFIG: Record<
  OperationalSeverity,
  { surface: string; iconClass: string; Icon: typeof AlertCircle; badge: string }
> = {
  CRITICAL: {
    surface: 'border-red-500/25 bg-red-500/[0.03]',
    iconClass: 'text-red-600',
    Icon: AlertCircle,
    badge: 'bg-red-100 text-red-800 border-red-200',
  },
  ACTION_REQUIRED: {
    surface: 'border-amber-500/30 bg-amber-500/[0.03]',
    iconClass: 'text-amber-600',
    Icon: AlertTriangle,
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  WARNING: {
    surface: 'border-border/60 bg-muted/10',
    iconClass: 'text-foreground/50',
    Icon: AlertTriangle,
    badge: 'bg-muted text-muted-foreground border-border/50',
  },
  INFORMATIONAL: {
    surface: 'border-border/50 bg-muted/5',
    iconClass: 'text-foreground/40',
    Icon: AlertCircle,
    badge: 'bg-muted/70 text-muted-foreground border-border/40',
  },
};

const SEVERITY_SORT: Record<OperationalSeverity, number> = {
  CRITICAL: 0,
  ACTION_REQUIRED: 1,
  WARNING: 2,
  INFORMATIONAL: 3,
};

/** Dashboard-level attention board — card layout, sorted by operational impact. */
export function NeedsAttentionCards({ items }: NeedsAttentionCardsProps) {
  const visible = items
    .filter((i) => i.severity === 'CRITICAL' || i.severity === 'ACTION_REQUIRED')
    .sort((a, b) => SEVERITY_SORT[a.severity] - SEVERITY_SORT[b.severity])
    .slice(0, 6);

  if (visible.length === 0) return null;

  return (
    <section aria-label="Needs your attention" className="space-y-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold text-foreground">Needs your attention</h2>
        <span className="text-xs text-muted-foreground">
          {visible.length} item{visible.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {visible.map((item) => (
          <AttentionCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

function AttentionCard({ item }: { item: AttentionItem }) {
  const config = SEVERITY_CONFIG[item.severity];
  const { Icon } = config;

  return (
    <div
      className={cn(
        'rounded-xl border p-4 flex flex-col gap-3',
        config.surface
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', config.iconClass)} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground leading-snug">{item.title}</p>
          {item.projectName ? (
            <p className="text-xs text-muted-foreground mt-0.5">{item.projectName}</p>
          ) : null}
          <p className="text-sm text-muted-foreground mt-1 leading-snug">{item.explanation}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-1 border-t border-inherit/50">
        {item.confidenceImpact ? (
          <p className="text-xs text-muted-foreground truncate min-w-0">
            <span className="font-medium">Impact:</span> {item.confidenceImpact}
          </p>
        ) : (
          <span />
        )}
        {item.ctaHref && item.ctaLabel ? (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="shrink-0 h-7 text-xs"
          >
            <Link href={item.ctaHref}>
              {item.ctaLabel}
              <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
