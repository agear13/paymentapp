/**
 * Home — operational coordination dashboard (not analytics KPIs).
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getUserOrganization } from '@/lib/auth/get-org';
import { getDashboardProductProfile } from '@/lib/auth/dashboard-product.server';
import { prisma } from '@/lib/server/prisma';
import { OperationalHomeDashboard } from '@/components/dashboard/operational-home-dashboard';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/auth/login');
  }

  const organization = await getUserOrganization();
  if (!organization) {
    redirect('/onboarding');
  }

  const productProfile = await getDashboardProductProfile();
  const showRevenueShare = productProfile === 'admin';

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

  const actionCards = [
    ...(showRevenueShare
      ? [
          {
            title: 'Projects needing action',
            description: 'Review project funding, participants, and settlement progress.',
            href: '/dashboard/projects',
            variant: 'attention' as const,
          },
          {
            title: 'Pending payouts',
            description: 'Obligations and payout batches awaiting coordination.',
            href: '/dashboard/payouts',
            variant: 'attention' as const,
          },
          {
            title: 'Participant onboarding',
            description: 'Participants blocked or not yet payout-ready.',
            href: '/dashboard/participants',
          },
        ]
      : []),
    {
      title: 'Unpaid invoices',
      description: 'Open invoices awaiting customer payment.',
      href: '/dashboard/payment-links?status=open',
      count: unpaidInvoices,
      variant: unpaidInvoices > 0 ? ('attention' as const) : undefined,
    },
    {
      title: 'Payment activity',
      description: 'Recent customer transactions and collection status.',
      href: '/dashboard/transactions',
    },
  ];

  return (
    <OperationalHomeDashboard showRevenueShare={showRevenueShare} actionCards={actionCards} />
  );
}
