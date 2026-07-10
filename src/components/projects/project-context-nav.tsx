'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  projectActivityPath,
  projectFundingPath,
  projectOverviewPath,
  projectParticipantsPath,
  projectPlanningPath,
} from '@/lib/projects/project-routes';
import { PRODUCT_TERMINOLOGY } from '@/lib/product/product-terminology';

type ProjectContextNavProps = {
  projectId: string;
};

/**
 * Five-tab navigation aligned to operator workflows:
 * Planning (commercial forecasting) · Overview · Money · People · History
 */
type NavTab = {
  id: 'planning' | 'overview' | 'money' | 'people' | 'history';
  label: string;
};

const TABS: NavTab[] = [
  { id: 'planning', label: PRODUCT_TERMINOLOGY.planning },
  { id: 'overview', label: 'Overview' },
  { id: 'money',    label: 'Money' },
  { id: 'people',   label: 'People' },
  { id: 'history',  label: 'History' },
];

function hrefForTab(projectId: string, tab: NavTab['id']): string {
  switch (tab) {
    case 'planning':
      return projectPlanningPath(projectId);
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

/** Map full route pathname to simplified tab id. */
function resolveActiveTab(pathname: string, projectId: string): NavTab['id'] {
  const base = projectOverviewPath(projectId);
  if (pathname.startsWith(`${base}/planning`)) return 'planning';
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
