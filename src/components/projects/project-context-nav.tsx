'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  projectActivityPath,
  projectCommercialRolesPath,
  projectFundingPath,
  projectObligationsPath,
  projectOverviewPath,
  projectParticipantsPath,
  projectPayoutsPath,
} from '@/lib/projects/project-routes';

type ProjectContextNavProps = {
  projectId: string;
};

/**
 * Four-tab navigation aligned to operator workflows:
 * Overview (briefing + health) · Money (funding / obligations / settlement) ·
 * People (participants) · History (activity + audit)
 *
 * All original routes remain accessible — only the primary navigation surface is simplified.
 */
type NavTab = {
  id: 'overview' | 'money' | 'people' | 'history';
  label: string;
};

const TABS: NavTab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'money',    label: 'Money' },
  { id: 'people',   label: 'People' },
  { id: 'history',  label: 'History' },
];

function hrefForTab(projectId: string, tab: NavTab['id']): string {
  switch (tab) {
    case 'overview':
      return projectOverviewPath(projectId);
    case 'money':
      return projectFundingPath(projectId);
    case 'people':
      return projectParticipantsPath(projectId);
    case 'history':
      return projectActivityPath(projectId);
  }
}

/** Map full route pathname to simplified 4-tab id. */
function resolveActiveTab(pathname: string, projectId: string): NavTab['id'] {
  const base = projectOverviewPath(projectId);
  if (pathname === base || pathname.startsWith(`${base}/commercial-roles`) || pathname.startsWith(`${base}/allocations`)) {
    return 'overview';
  }
  if (
    pathname.startsWith(`${base}/funding`) ||
    pathname.startsWith(`${base}/obligations`) ||
    pathname.startsWith(`${base}/payouts`)
  ) {
    return 'money';
  }
  if (pathname.startsWith(`${base}/participants`)) return 'people';
  if (pathname.startsWith(`${base}/activity`)) return 'history';
  return 'overview';
}

export function ProjectContextNav({ projectId }: ProjectContextNavProps) {
  const pathname = usePathname() ?? '';
  const active = resolveActiveTab(pathname, projectId);

  return (
    <nav
      className="flex gap-0.5 border-b border-border/80 pb-px overflow-x-auto"
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
              'px-3 py-2 text-sm font-medium whitespace-nowrap rounded-t-md transition-colors duration-150 -mb-px border-b-2',
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
