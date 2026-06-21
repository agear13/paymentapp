export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getUserOrganization } from '@/lib/auth/get-org';
import { MarketingPageClient } from '@/components/marketing-labs/marketing-page-client';

export const metadata = {
  title: 'Marketing',
};

export default async function MarketingPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/auth/login');
  }

  const organization = await getUserOrganization();
  if (!organization) {
    redirect('/onboarding');
  }

  return <MarketingPageClient companyId={organization.id} companyName={organization.name} />;
}
