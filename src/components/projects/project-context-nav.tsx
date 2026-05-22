'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  projectActivityPath,
  projectFundingPath,
  projectObligationsPath,
  projectOverviewPath,
  projectParticipantsPath,
  projectPayoutsPath,
  projectTabFromPathname,
} from '@/lib/projects/project-routes';

type ProjectContextNavProps = {
  projectId: string;
};

const TABS = [
  { id: 'overview' as const, label: 'Overview' },
  { id: 'participants' as const, label: 'Participants' },
  { id: 'funding' as const, label: 'Funding sources' },
  { id: 'obligations' as const, label: 'Obligations' },
  { id: 'payouts' as const, label: 'Payouts' },
  { id: 'activity' as const, label: 'Activity' },
];

function hrefForTab(projectId: string, tab: (typeof TABS)[number]['id']): string {
  switch (tab) {
    case 'overview':
      return projectOverviewPath(projectId);
    case 'participants':
      return projectParticipantsPath(projectId);
    case 'funding':
      return projectFundingPath(projectId);
    case 'obligations':
      return projectObligationsPath(projectId);
    case 'payouts':
      return projectPayoutsPath(projectId);
    case 'activity':
      return projectActivityPath(projectId);
  }
}

export function ProjectContextNav({ projectId }: ProjectContextNavProps) {
  const pathname = usePathname() ?? '';
  const active = projectTabFromPathname(pathname, projectId);

  return (
    <nav
      className="flex flex-wrap gap-0.5 border-b border-border/80 pb-px"
      aria-label="Project sections"
    >
      {TABS.map((tab) => {
        const href = hrefForTab(projectId, tab.id);
        const isActive = active === tab.id;
        return (
          <Link
            key={tab.id}
            href={href}
            className={cn(
              'px-3 py-2 text-sm font-medium rounded-t-md transition-colors duration-150 -mb-px border-b-2',
              isActive
                ? 'border-primary text-foreground'
                : 'border-transparent text-foreground/65 hover:text-foreground hover:border-border/80'
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
