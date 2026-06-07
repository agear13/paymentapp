import { cn } from '@/lib/utils';
import { opSpace } from '@/lib/design/operational-spacing';

/**
 * Operational surfaces — subtle layering without card soup.
 */

export const opSurfaceBase =
  'rounded-lg border border-border/70 bg-background shadow-sm';

export const opSurfaceRaised =
  'rounded-lg border border-border/80 bg-card/70 shadow-sm';

export const opSurfaceInset =
  'rounded-md border border-border/50 bg-muted/30';

export const opSurfaceCritical =
  'rounded-lg border border-red-500/20 bg-red-500/[0.04]';

export const opSurfaceAction =
  'rounded-lg border border-amber-500/25 bg-amber-500/[0.04]';

export const opSurfaceWarning =
  'rounded-lg border border-border/60 bg-muted/20';

/** Agreement Intelligence accent — purple gradient surface */
export const opSurfaceIntelligence =
  'rounded-lg border border-[rgba(124,92,255,0.15)] bg-gradient-to-br from-[rgba(124,92,255,0.06)] via-white to-[rgba(124,92,255,0.03)] shadow-sm';

/** Settlement readiness accent — green surface */
export const opSurfaceSettlement =
  'rounded-lg border border-[rgba(29,111,66,0.15)] bg-[rgb(var(--settlement-success))]/50 shadow-sm';

/** Top-level metric cards — clean white */
export const opSurfaceMetric =
  'rounded-lg border border-[rgba(124,92,255,0.08)] bg-white shadow-sm';

/** Activity / timeline — neutral inset */
export const opSurfaceActivity =
  'rounded-lg border border-border/50 bg-muted/20';

export const opDivider = 'border-border/70';
export const opDividerSubtle = 'border-border/50';

/** Subtle hover/focus for operational interactive rows */
export const opInteractiveRow =
  'transition-colors duration-150 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2';

export const opCollapsibleTrigger =
  'flex items-center gap-1.5 text-sm text-foreground/70 hover:text-foreground transition-colors duration-150 [&[data-state=open]>svg]:rotate-180';

export const opCtaButton =
  'transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring/50';

export function opSurface(
  variant:
    | 'base'
    | 'raised'
    | 'inset'
    | 'critical'
    | 'action'
    | 'warning'
    | 'intelligence'
    | 'settlement'
    | 'metric'
    | 'activity' = 'raised',
  className?: string
) {
  const map = {
    base: opSurfaceBase,
    raised: opSurfaceRaised,
    inset: opSurfaceInset,
    critical: opSurfaceCritical,
    action: opSurfaceAction,
    warning: opSurfaceWarning,
    intelligence: opSurfaceIntelligence,
    settlement: opSurfaceSettlement,
    metric: opSurfaceMetric,
    activity: opSurfaceActivity,
  };
  return cn(map[variant], opSpace.surfacePadCompact, className);
}
