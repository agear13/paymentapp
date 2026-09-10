import { cn } from '@/lib/utils';
import { opSpace } from '@/lib/design/operational-spacing';

/**
 * Operational surfaces — subtle layering without card soup.
 *
 * Semantic tints use the hue at low opacity (e.g. bg-amber-500/[0.06]) so they
 * stay a dark surface in dark mode. Do not use Tailwind *-50 fills for panels:
 * those are light-mode paper colours and wash out to silver against light text.
 */

export const opSurfaceBase =
  'rounded-lg border border-border/70 bg-background shadow-sm';

export const opSurfaceRaised =
  'rounded-lg border border-border/80 bg-card/70 shadow-sm';

export const opSurfaceInset =
  'rounded-md border border-border/50 bg-muted/30';

export const opSurfaceCritical =
  'rounded-lg border border-red-500/20 bg-red-500/[0.06]';

export const opSurfaceAction =
  'rounded-lg border border-amber-500/25 bg-amber-500/[0.06]';

export const opSurfaceWarning =
  'rounded-lg border border-border/60 bg-muted/20';

export const opSurfaceSuccess =
  'rounded-lg border border-green-500/20 bg-green-500/[0.06]';

export const opSurfaceInfo =
  'rounded-lg border border-blue-500/20 bg-blue-500/[0.06]';

/** Agreement Intelligence accent — purple gradient surface */
export const opSurfaceIntelligence =
  'rounded-lg border border-[rgba(124,92,255,0.15)] bg-gradient-to-br from-[rgba(124,92,255,0.06)] via-card to-[rgba(124,92,255,0.03)] shadow-sm';

/** Settlement readiness accent — green surface */
export const opSurfaceSettlement =
  'rounded-lg border border-[rgba(29,111,66,0.15)] bg-[rgb(var(--settlement-success))]/50 shadow-sm';

/** Top-level metric cards */
export const opSurfaceMetric =
  'rounded-lg border border-[rgba(124,92,255,0.08)] bg-card shadow-sm';

/** Activity / timeline — neutral inset */
export const opSurfaceActivity =
  'rounded-lg border border-border/50 bg-muted/20';

/**
 * Translucent dashboard panel. Light mode matches former bg-white/70
 * (card is white); dark mode stays a dark surface instead of silver.
 */
export const opSurfacePanel =
  'rounded-xl border border-border/60 bg-card/70';

/** Semantic text that stays readable on both light paper and dark surfaces */
export const opToneSuccess = 'text-green-800 dark:text-green-400';
export const opToneWarning = 'text-amber-800 dark:text-amber-400';
export const opToneDanger = 'text-red-800 dark:text-red-400';
export const opToneInfo = 'text-blue-800 dark:text-blue-400';

/** Compact chips / stage badges — same hue-at-low-opacity rule as surfaces */
export const opChipSuccess =
  'border-green-500/20 bg-green-500/[0.08] text-green-800 dark:text-green-400';
export const opChipWarning =
  'border-amber-500/25 bg-amber-500/[0.08] text-amber-800 dark:text-amber-400';
export const opChipDanger =
  'border-red-500/20 bg-red-500/[0.08] text-red-800 dark:text-red-400';
export const opChipInfo =
  'border-blue-500/20 bg-blue-500/[0.08] text-blue-800 dark:text-blue-400';
export const opChipNeutral =
  'border-border bg-muted text-muted-foreground';

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
    | 'success'
    | 'info'
    | 'intelligence'
    | 'settlement'
    | 'metric'
    | 'activity'
    | 'panel' = 'raised',
  className?: string
) {
  const map = {
    base: opSurfaceBase,
    raised: opSurfaceRaised,
    inset: opSurfaceInset,
    critical: opSurfaceCritical,
    action: opSurfaceAction,
    warning: opSurfaceWarning,
    success: opSurfaceSuccess,
    info: opSurfaceInfo,
    intelligence: opSurfaceIntelligence,
    settlement: opSurfaceSettlement,
    metric: opSurfaceMetric,
    activity: opSurfaceActivity,
    panel: opSurfacePanel,
  };
  return cn(map[variant], opSpace.surfacePadCompact, className);
}
