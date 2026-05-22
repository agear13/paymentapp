import { cn } from '@/lib/utils';

/**
 * Unified operational spacing cadence — premium rhythm, not sparse admin UI.
 */

export const opSpace = {
  /** Between major page sections */
  sectionY: 'space-y-6 sm:space-y-7',
  /** Home / command center vertical rhythm */
  pageY: 'space-y-6 sm:space-y-8',
  /** Hero block internal */
  heroY: 'space-y-4 sm:space-y-5',
  /** Around primary CTA clusters */
  ctaCluster: 'gap-3 sm:gap-4',
  /** Between metadata rows */
  metaY: 'space-y-1',
  /** Operational list items */
  listItemY: 'py-3 sm:py-3.5',
  /** Card / surface padding */
  surfacePad: 'p-4 sm:p-5',
  surfacePadCompact: 'px-4 py-3.5',
  /** Table-adjacent sections */
  tableSection: 'space-y-3',
  /** Empty state vertical */
  emptyY: 'py-8 sm:py-10 space-y-3',
  /** Status strip */
  stripY: 'py-2.5 px-4',
  /** Attention board between severity groups */
  attentionGroupY: 'space-y-4',
} as const;

/** Constrained content width for operational pages */
export const opPageWidth = 'w-full max-w-4xl mx-auto';

/** Project workspace content width */
export const opProjectWidth = 'w-full max-w-5xl';

export function opSection(className?: string) {
  return cn(opSpace.sectionY, className);
}

export function opPage(className?: string) {
  return cn(opPageWidth, opSpace.pageY, className);
}
