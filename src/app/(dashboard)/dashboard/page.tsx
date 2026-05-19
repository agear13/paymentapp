/**
 * Home — operational coordination dashboard (not analytics KPIs).
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getUserOrganization } from '@/lib/auth/get-org';
import { prisma } from '@/lib/server/prisma';
import { OperationalHomeDashboard } from '@/components/dashboard/operational-home-dashboard';
import { OnboardingWorkspacePreview } from '@/components/onboarding/onboarding-workspace-preview';
import { PAYOUTS_OBLIGATIONS_HREF } from '@/lib/navigation/operator-nav';
import { getPilotSnapshotForUser } from '@/lib/deal-network-demo/pilot-snapshot.server';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string; project?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/auth/login');
  }

  const organization = await getUserOrganization();
  if (!organization) {
    redirect('/onboarding');
  }

  const params = await searchParams;
  const showWorkspacePreview = params.workspace === 'ready';

  let unpaidInvoices = 0;
  try {
    unpaidInvoices = await prisma.payment_links.count({
      where: {
        organization_id: organization.id,
        status: 'OPEN',
      },
    });
  } catch {
    unpaidInvoices = 0;
  }

  let activeProjectCount = 0;
  try {
    const snapshot = await getPilotSnapshotForUser(user.id);
    activeProjectCount = snapshot.deals.filter((d) => !d.archived).length;
  } catch {
    activeProjectCount = 0;
  }

  const hasActiveCoordination = activeProjectCount > 0 || unpaidInvoices > 0;

  const actionCards = [
    {
      title: 'Projects',
      description: 'Create or manage operational workspaces.',
      href: '/dashboard/projects',
      ctaLabel: 'View projects',
      variant: activeProjectCount === 0 ? ('muted' as const) : undefined,
    },
    {
      title: 'Revenue awaiting collection',
      description: 'Track invoices, payment links, deposits, and pending revenue.',
      href: '/dashboard/payment-links?status=open',
      ctaLabel: 'Review revenue',
      count: unpaidInvoices,
      variant: unpaidInvoices > 0 ? ('attention' as const) : ('muted' as const),
    },
    {
      title: 'Settlement readiness',
      description: 'Review funding status, participant onboarding, and payout coordination.',
      href: '/dashboard/projects',
      ctaLabel: 'Review readiness',
      variant: hasActiveCoordination ? ('attention' as const) : ('muted' as const),
    },
    {
      title: 'What is owed',
      description: 'See obligations, approvals, blocked payouts, and participant states.',
      href: PAYOUTS_OBLIGATIONS_HREF,
      ctaLabel: 'Review obligations',
      variant: hasActiveCoordination ? ('attention' as const) : ('muted' as const),
    },
  ];

  return (
    <div className="space-y-8">
      {showWorkspacePreview ? (
        <OnboardingWorkspacePreview projectName={params.project} />
      ) : null}
      <OperationalHomeDashboard
        actionCards={actionCards}
        hasActiveCoordination={hasActiveCoordination}
      />
    </div>
  );
}
