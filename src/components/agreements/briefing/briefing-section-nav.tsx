'use client';

import Link from 'next/link';
import { BRIEFING_SECTIONS } from '@/lib/agreements/agreement-briefing.model';
import { projectOverviewPath } from '@/lib/projects/project-routes';
import { cn } from '@/lib/utils';

type BriefingSectionNavProps = {
  projectId: string;
  className?: string;
};

export function BriefingSectionNav({ projectId, className }: BriefingSectionNavProps) {
  const base = projectOverviewPath(projectId);

  return (
    <nav
      className={cn(
        'sticky top-0 z-20 -mx-1 px-1 py-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-[rgba(124,92,255,0.12)]',
        className
      )}
      aria-label="Agreement briefing sections"
    >
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
        {BRIEFING_SECTIONS.map((section) => (
          <Link
            key={section.id}
            href={`${base}#${section.id}`}
            className="shrink-0 rounded-full border border-[rgba(124,92,255,0.12)] px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-[rgba(124,92,255,0.3)] hover:text-foreground hover:bg-[rgba(124,92,255,0.04)]"
          >
            {section.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
