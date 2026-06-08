export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { getCurrentUser } from '@/lib/auth/session';
import { getUserOrganization } from '@/lib/auth/get-org';
import { prisma } from '@/lib/server/prisma';
import { redirect } from 'next/navigation';
import { OperationalLedgerPage } from '@/components/dashboard/ledger/operational-ledger-page';
import { EntitlementPageShell } from '@/components/entitlements/entitlement-page-shell';

export default async function ReportsLedgerPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/auth/login');
  }

  const org = await getUserOrganization();
  if (!org) {
    redirect('/onboarding');
  }

  const accounts = await prisma.ledger_accounts.findMany({
    where: { organization_id: org.id },
    orderBy: [{ account_type: 'asc' }, { code: 'asc' }],
  });

  const entries = await prisma.ledger_entries.findMany({
    where: {
      payment_links: { organization_id: org.id },
    },
    include: {
      ledger_accounts: {
        select: { code: true, name: true, account_type: true },
      },
      payment_links: {
        select: { short_code: true, invoice_reference: true, description: true },
      },
    },
    orderBy: { created_at: 'desc' },
    take: 100,
  });

  return (
    <EntitlementPageShell feature="advanced_reporting">
      <OperationalLedgerPage
        organizationId={org.id}
        accounts={accounts}
        entries={entries}
      />
    </EntitlementPageShell>
  );
}
