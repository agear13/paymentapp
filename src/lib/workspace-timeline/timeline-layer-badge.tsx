'use client';

import type { TimelineLayer } from '@/lib/workspace-timeline/types';
import { TIMELINE_LAYER_META } from '@/lib/workspace-timeline/timeline-layer-badges';
import { cn } from '@/lib/utils';

export function TimelineLayerBadge({
  layer,
  className,
}: {
  layer: TimelineLayer;
  className?: string;
}) {
  const meta = TIMELINE_LAYER_META[layer];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium',
        meta.badgeClass,
        className
      )}
    >
      {meta.label}
    </span>
  );
}
