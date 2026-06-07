'use client';

import Link from 'next/link';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import { opTypeBodySnug, opTypeMeta, opTypePageTitle } from '@/lib/design/operational-typography';
import { opSurface } from '@/lib/design/operational-surfaces';
import { cn } from '@/lib/utils';

/**
 * Reinforces project as the operational nucleus — identity persists across tabs.
 */
export function ProjectContextHeader({ className }: { className?: string }) {
  const { deal, summary, projectParticipants } = useProjectWorkspace();
  if (!deal) return null;

  const name = summary?.name ?? deal.dealName ?? 'Agreement';
  const count = projectParticipants.length;
  const ready = projectParticipants.filter((p) => p.compensationProfile?.configured).length;

  return (
    <header className={cn(opSurface('inset', 'flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2'), className)}>
      <div className="min-w-0">
        <p className={opTypeMeta}>Agreement coordination</p>
        <h1 className={cn(opTypePageTitle, 'mt-0.5 truncate')}>{name}</h1>
        <p className={cn(opTypeBodySnug, 'mt-1')}>
          {count === 0
            ? 'Add participants to coordinate earnings, obligations, and settlement for this agreement.'
            : `${count} participant${count === 1 ? '' : 's'} · ${ready} earnings configured`}
        </p>
      </div>
      <Link
        href={`/dashboard/projects/${encodeURIComponent(deal.id)}`}
        className="text-sm font-medium text-primary shrink-0 hover:underline underline-offset-2 transition-colors duration-150"
      >
        Agreement overview
      </Link>
    </header>
  );
}
