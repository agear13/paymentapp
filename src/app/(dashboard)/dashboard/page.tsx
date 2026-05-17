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
import { PAYOUTS_OBLIGATIONS_HREF } from '@/lib/navigation/operator-nav';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/auth/login');
  }

  const organization = await getUserOrganization();
  if (!organization) {
    redirect('/onboarding');
  }

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
    {
      title: 'Projects',
      description: 'Review project funding, participants, and settlement progress.',
      href: '/dashboard/projects',
      variant: 'attention' as const,
    },
    {
      title: 'Obligations',
      description: 'See who is owed what and what is blocking payout release.',
      href: PAYOUTS_OBLIGATIONS_HREF,
      variant: 'attention' as const,
    },
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

  return <OperationalHomeDashboard actionCards={actionCards} />;
}
