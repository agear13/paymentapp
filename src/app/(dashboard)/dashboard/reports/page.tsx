import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { ReportsPageClient } from '@/components/dashboard/reports/reports-page-client';

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/sign-in');
  }

  const { orgId } = await auth();
  if (!orgId) {
    redirect('/onboarding');
  }

  // Get organization from database
  const organization = await prisma.organizations.findUnique({
    where: {
      clerk_org_id: orgId,
    },
  });

  if (!organization) {
    redirect('/onboarding');
  }

  return <ReportsPageClient organizationId={organization.id} />;
}







