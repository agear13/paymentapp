import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartOfAccounts } from '@/components/dashboard/ledger/chart-of-accounts';
import { LedgerEntriesTable } from '@/components/dashboard/ledger/ledger-entries-table';
import { LedgerBalanceReport } from '@/components/dashboard/reports/ledger-balance-report';
import { PaymentLinksLedgerEntriesEmpty } from '@/components/payment-links/payment-links-empty-guidance';

type LedgerAccount = {
  id: string;
  code: string;
  name: string;
  account_type: string;
};

type LedgerEntry = Parameters<typeof LedgerEntriesTable>[0]['entries'][number];

export function OperationalLedgerPage({
  organizationId,
  accounts,
  entries,
}: {
  organizationId: string;
  accounts: LedgerAccount[];
  entries: LedgerEntry[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ledger</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Auditable financial memory for your organization: payment events, payout obligations,
          commission accruals, settlement releases, and invoice relationships in one operational
          view.
        </p>
      </div>

      <Tabs defaultValue="entries" className="space-y-4">
        <TabsList>
          <TabsTrigger value="entries">Entries ({entries.length})</TabsTrigger>
          <TabsTrigger value="accounts">Accounts ({accounts.length})</TabsTrigger>
          <TabsTrigger value="balance">Balance summary</TabsTrigger>
        </TabsList>

        <TabsContent value="entries" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Financial events</CardTitle>
              <CardDescription>
                Payment, allocation, and settlement entries (most recent 100).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {entries.length > 0 ? (
                <LedgerEntriesTable entries={entries} />
              ) : (
                <PaymentLinksLedgerEntriesEmpty />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Chart of accounts</CardTitle>
              <CardDescription>Account structure used for reconciliation and reporting.</CardDescription>
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
          <LedgerBalanceReport organizationId={organizationId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
