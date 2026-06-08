export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { getCurrentUser } from '@/lib/auth/session';
import { getUserOrganization } from '@/lib/auth/get-org';
import { redirect } from 'next/navigation';
import { ExportCenterClient } from '@/components/dashboard/reports/export-center-client';
import { EntitlementPageShell } from '@/components/entitlements/entitlement-page-shell';

export const metadata = {
  title: 'Export Center | Reports',
};

export default async function ReportsExportsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/auth/login');
  }

  const org = await getUserOrganization();
  if (!org) {
    redirect('/onboarding');
  }

  return (
    <EntitlementPageShell feature="advanced_reporting">
      <ExportCenterClient organizationId={org.id} />
    </EntitlementPageShell>
  );
}
