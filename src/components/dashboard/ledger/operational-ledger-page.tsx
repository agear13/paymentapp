import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartOfAccounts } from '@/components/dashboard/ledger/chart-of-accounts';
import { LedgerEntriesTable } from '@/components/dashboard/ledger/ledger-entries-table';
import { LedgerBalanceReport } from '@/components/dashboard/reports/ledger-balance-report';
import { PaymentLinksLedgerEntriesEmpty } from '@/components/payment-links/payment-links-empty-guidance';
import { CREATE_INVOICE_HREF } from '@/lib/navigation/payment-routes';
import { REPORTS_EXPORTS_HREF } from '@/lib/navigation/operator-nav';
import { Button } from '@/components/ui/button';
import { Download, Info, Scale } from 'lucide-react';

type LedgerAccount = {
  id: string;
  code: string;
  name: string;
  account_type: string;
};

type LedgerEntry = Parameters<typeof LedgerEntriesTable>[0]['entries'][number];

const GLOSSARY = [
  {
    term: 'DR (Debit)',
    definition: 'Increases asset or expense accounts in this ledger view.',
  },
  {
    term: 'CR (Credit)',
    definition: 'Decreases asset accounts or records offsets against clearing balances.',
  },
  {
    term: 'Clearing account',
    definition:
      'Holds funds between payment receipt and settlement release (e.g. Stripe or Wise clearing).',
  },
  {
    term: 'Reconciliation',
    definition:
      'Compares expected payment totals with clearing account balances to confirm integrity.',
  },
] as const;

export function OperationalLedgerPage({
  organizationId,
  accounts,
  entries,
}: {
  organizationId: string;
  accounts: LedgerAccount[];
  entries: LedgerEntry[];
}) {
  const clearingAccounts = accounts.filter((a) =>
    ['1050', '1051', '1052', '1053', '1054', '1055'].includes(a.code)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ledger</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Your complete financial record — payments, obligations, settlements, and allocations in
            one audit-ready view.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" asChild>
            <Link href="/dashboard/reports#reconciliation-report">
              <Scale className="mr-1.5 h-3.5 w-3.5" />
              Reconciliation report
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={REPORTS_EXPORTS_HREF}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export ledger
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/reports#ledger-snapshot">View balances</Link>
          </Button>
        </div>
      </div>

      <Card className="bg-muted/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Info className="h-4 w-4" />
            Accounting glossary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2 text-sm">
            {GLOSSARY.map(({ term, definition }) => (
              <div key={term}>
                <dt className="font-medium">{term}</dt>
                <dd className="text-muted-foreground text-xs mt-0.5">{definition}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

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
                Payment, allocation, and settlement entries (most recent 100). Expand a row for a
                plain-language explanation — DR/CR and account codes are unchanged.
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
                <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-10 text-center text-sm">
                  <p className="font-medium">No accounts configured yet</p>
                  <p className="mt-1 text-muted-foreground">
                    Accounts are provisioned when payments and settlements are recorded.
                  </p>
                  <Button className="mt-4" variant="secondary" size="sm" asChild>
                    <Link href="/dashboard/settings/merchant">Configure payment methods</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balance" className="space-y-4">
          {clearingAccounts.length === 0 && entries.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-10 text-center text-sm">
              <p className="font-medium">No clearing balances yet</p>
              <p className="mt-1 text-muted-foreground">
                Ledger entries will appear after your first payment is received and posted.
              </p>
              <Button className="mt-4" variant="secondary" size="sm" asChild>
                <Link href={CREATE_INVOICE_HREF}>Create invoice</Link>
              </Button>
            </div>
          ) : (
            <LedgerBalanceReport organizationId={organizationId} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
