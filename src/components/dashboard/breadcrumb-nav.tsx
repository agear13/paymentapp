'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { DashboardProductProfile } from '@/lib/auth/admin-shared';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  getProjectDisplayNameFromRegistry,
  projectBreadcrumbFallbackLabel,
  setProjectDisplayNameRegistry,
  subscribeProjectDisplayNameRegistry,
} from '@/lib/projects/project-display-name-registry';
import {
  getProjectDisplayName,
  isLikelyProjectIdSegment,
} from '@/lib/projects/get-project-display-name';

const pathTitles: Record<string, string> = {
  dashboard: 'Dashboard',
  projects: 'Agreements',
  partners: 'Partners',
  participants: 'Participants',
  payments: 'Funding',
  payouts: 'Settlement',
  reports: 'Reporting',
  settings: 'Settings',
  'payment-links': 'Invoices',
  'recurring-templates': 'Recurring schedules',
  ledger: 'Ledger',
  transactions: 'Funding activity',
  organization: 'Organization',
  merchant: 'Collection & settlement infrastructure',
  team: 'Team',
  integrations: 'Integrations',
  services: 'Service catalog',
  notifications: 'Notifications',
  privacy: 'Privacy',
  'deal-network': 'Coordination workspace',
  programs: 'Participants',
  commissions: 'Earnings',
  obligations: 'Obligations',
  funding: 'Funding',
  activity: 'Activity',
  referrals: 'Referrals',
};

const SETTINGS_HOME = '/dashboard/settings/organization';

function settingsPageTitle(segment: string | undefined): string {
  if (!segment) return 'Settings';
  return pathTitles[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
}

interface BreadcrumbNavProps {
  productProfile: DashboardProductProfile;
}

function useProjectNameForBreadcrumb(projectId: string | null): string | null {
  const [, bump] = React.useReducer((n: number) => n + 1, 0);

  React.useEffect(() => {
    if (!projectId) return;
    return subscribeProjectDisplayNameRegistry(bump);
  }, [projectId]);

  const cached = projectId ? getProjectDisplayNameFromRegistry(projectId) : null;

  React.useEffect(() => {
    if (!projectId || cached) return;
    let cancelled = false;
    void fetch(`/api/projects/workspace/${encodeURIComponent(projectId)}/summary`)
      .then((res) => (res.ok ? res.json() : null))
      .then((payload: { summary?: { name?: string }; deal?: { dealName?: string } } | null) => {
        if (cancelled || !payload) return;
        const label = getProjectDisplayName({
          name: payload.summary?.name,
          dealName: payload.deal?.dealName,
        });
        setProjectDisplayNameRegistry(projectId, { name: label, dealName: label });
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, cached]);

  return cached;
}

function titleForSegment(
  segment: string,
  index: number,
  segments: string[],
  projectName: string | null
): string {
  const prev = index > 0 ? segments[index - 1] : null;

  if (prev === 'projects' && isLikelyProjectIdSegment(segment)) {
    return projectName ?? projectBreadcrumbFallbackLabel();
  }

  if (pathTitles[segment]) return pathTitles[segment];

  if (isLikelyProjectIdSegment(segment)) {
    return projectBreadcrumbFallbackLabel();
  }

  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function BreadcrumbNav({ productProfile }: BreadcrumbNavProps) {
  const pathname = usePathname();

  const projectId = React.useMemo(() => {
    const segments = pathname.split('/').filter(Boolean);
    const projectsIdx = segments.indexOf('projects');
    if (projectsIdx === -1) return null;
    const candidate = segments[projectsIdx + 1];
    if (!candidate || !isLikelyProjectIdSegment(candidate)) return null;
    return candidate;
  }, [pathname]);

  const projectName = useProjectNameForBreadcrumb(projectId);

  if (productProfile === 'rabbit_hole_pilot') {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Rabbit Hole Deal Network</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  const segments = pathname.split('/').filter(Boolean);
  const settingsIdx = segments.indexOf('settings');

  if (settingsIdx !== -1) {
    const pageSegment = segments[settingsIdx + 1];
    const settingsCrumbs = [
      { href: '/dashboard', title: 'Dashboard', isLast: false },
      { href: SETTINGS_HOME, title: 'Settings', isLast: !pageSegment },
      ...(pageSegment
        ? [
            {
              href: '/' + segments.slice(0, settingsIdx + 2).join('/'),
              title: settingsPageTitle(pageSegment),
              isLast: true,
            },
          ]
        : []),
    ];

    return (
      <Breadcrumb>
        <BreadcrumbList>
          {settingsCrumbs.map((breadcrumb, index) => (
            <React.Fragment key={breadcrumb.href}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {breadcrumb.isLast ? (
                  <BreadcrumbPage>{breadcrumb.title}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={breadcrumb.href}>{breadcrumb.title}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  if (segments.length <= 1) {
    return null;
  }

  const breadcrumbs = segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/');
    const title = titleForSegment(segment, index, segments, projectName);
    const isLast = index === segments.length - 1;

    return {
      href,
      title,
      isLast,
    };
  });

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbs.map((breadcrumb, index) => (
          <React.Fragment key={breadcrumb.href}>
            {index > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {breadcrumb.isLast ? (
                <BreadcrumbPage>{breadcrumb.title}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={breadcrumb.href}>{breadcrumb.title}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
