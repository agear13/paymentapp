export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/server/prisma';
import { ChartOfAccounts } from '@/components/dashboard/ledger/chart-of-accounts';
import { LedgerEntriesTable } from '@/components/dashboard/ledger/ledger-entries-table';
import { LedgerBalanceReport } from '@/components/dashboard/reports/ledger-balance-report';

export default async function LedgerPage() {
  // Get current user's organization
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <p className="text-muted-foreground">Please log in to view ledger.</p>
      </div>
    );
  }

  // Get user's organization (simplified - get first org for now)
  const org = await prisma.organizations.findFirst({
    select: { id: true },
  });

  if (!org) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <p className="text-muted-foreground">No organization found.</p>
      </div>
    );
  }

  // Fetch ledger accounts
  const accounts = await prisma.ledger_accounts.findMany({
    where: {
      organization_id: org.id,
    },
    orderBy: [
      { account_type: 'asc' },
      { code: 'asc' },
    ],
  });

  // Fetch ledger entries with related data
  const entries = await prisma.ledger_entries.findMany({
    where: {
      payment_links: {
        organization_id: org.id,
      },
    },
    include: {
      ledger_accounts: {
        select: {
          code: true,
          name: true,
          account_type: true,
        },
      },
      payment_links: {
        select: {
          short_code: true,
          invoice_reference: true,
          description: true,
        },
      },
    },
    orderBy: {
      created_at: 'desc',
    },
    take: 100, // Limit to recent entries
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ledger</h1>
        <p className="text-muted-foreground">
          View your double-entry bookkeeping ledger and account balances.
        </p>
      </div>

      <Tabs defaultValue="entries" className="space-y-4">
        <TabsList>
          <TabsTrigger value="entries">Entries ({entries.length})</TabsTrigger>
          <TabsTrigger value="accounts">Accounts ({accounts.length})</TabsTrigger>
          <TabsTrigger value="balance">Balance Sheet</TabsTrigger>
        </TabsList>

        <TabsContent value="entries" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ledger Entries</CardTitle>
              <CardDescription>
                All ledger entries for your organization (most recent 100).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {entries.length > 0 ? (
                <LedgerEntriesTable entries={entries} />
              ) : (
                <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                  No ledger entries yet.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Chart of Accounts</CardTitle>
              <CardDescription>
                Your organization's chart of accounts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {accounts.length > 0 ? (
                <ChartOfAccounts accounts={accounts} />
              ) : (
                <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                  No accounts configured yet.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balance" className="space-y-4">
          <LedgerBalanceReport organizationId={org.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
