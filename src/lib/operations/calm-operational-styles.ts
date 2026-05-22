import { cn } from '@/lib/utils';
import {
  opTypeBodySnug,
  opTypeLabel,
  opTypeMeta,
  opTypeSection,
} from '@/lib/design/operational-typography';
import { opPage, opPageWidth } from '@/lib/design/operational-spacing';
import { opSurface } from '@/lib/design/operational-surfaces';

/** @deprecated Prefer opTypography from @/lib/design — kept for gradual migration */
export const calmText = {
  meta: opTypeMeta,
  body: opTypeBodySnug,
  label: opTypeLabel,
  title: 'text-sm font-semibold text-foreground',
  section: opTypeSection,
} as const;

export function calmSurface(className?: string) {
  return opSurface('raised', className);
}

export function calmPageWidth(className?: string) {
  return opPage(className);
}

export { opPageWidth };
