import { cn } from '@/lib/utils';

/**
 * Strict operational typography tiers — primary truth reads first, metadata never fades out.
 */

/** Tier 1 — page titles, primary operational truth */
export const opTypePageTitle = 'text-2xl sm:text-3xl font-semibold tracking-tight text-foreground';
export const opTypePageTitleLarge = 'text-3xl sm:text-4xl font-bold tracking-tight text-foreground';

/** Tier 2 — next action, blockers, key metrics */
export const opTypeEmphasis = 'text-lg sm:text-xl font-semibold text-foreground';
export const opTypeMetric = 'text-xl sm:text-2xl font-semibold tabular-nums text-foreground';
export const opTypeAction = 'text-base font-semibold text-foreground';

/** Tier 3 — supporting operational context */
export const opTypeBody = 'text-sm sm:text-base text-foreground/85 leading-relaxed';
export const opTypeBodySnug = 'text-sm text-foreground/85 leading-snug';
export const opTypeSection = 'text-base font-semibold text-foreground tracking-tight';

/** Tier 4 — metadata, timestamps, helper labels (min text-sm, min contrast 65%) */
export const opTypeMeta = 'text-sm text-foreground/70';
export const opTypeLabel = 'text-xs sm:text-sm font-medium text-foreground/70 uppercase tracking-wide';
export const opTypeCaption = 'text-sm text-foreground/65';

export const opTypography = {
  pageTitle: opTypePageTitle,
  pageTitleLarge: opTypePageTitleLarge,
  emphasis: opTypeEmphasis,
  metric: opTypeMetric,
  action: opTypeAction,
  body: opTypeBody,
  bodySnug: opTypeBodySnug,
  section: opTypeSection,
  meta: opTypeMeta,
  label: opTypeLabel,
  caption: opTypeCaption,
} as const;

export function opType(className?: string, tier: keyof typeof opTypography = 'body') {
  return cn(opTypography[tier], className);
}
