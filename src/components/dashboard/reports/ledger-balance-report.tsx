'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface LedgerAccount {
  code: string;
  name: string;
  accountType: string;
  balance: number;
  entryCount: number;
}

interface LedgerBalanceData {
  clearingAccounts: {
    stripe: LedgerAccount | null;
    hedera_hbar: LedgerAccount | null;
    hedera_usdc: LedgerAccount | null;
    hedera_usdt: LedgerAccount | null;
    hedera_audd: LedgerAccount | null;
  };
  otherAccounts: LedgerAccount[];
  allAccounts: LedgerAccount[];
}

interface LedgerBalanceReportProps {
  organizationId: string;
}

export function LedgerBalanceReport({ organizationId }: LedgerBalanceReportProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LedgerBalanceData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [organizationId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/reports/ledger-balance?organizationId=${organizationId}`
      );
      if (!response.ok) throw new Error('Failed to fetch ledger balances');

      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ledger Balance Report</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const placeholderData: LedgerBalanceData = {
    clearingAccounts: {
      stripe: {
        code: '1050',
        name: 'Stripe Clearing',
        accountType: 'ASSET',
        balance: 1250,
        entryCount: 12,
      },
      hedera_hbar: {
        code: '1051',
        name: 'Crypto Clearing - HBAR',
        accountType: 'ASSET',
        balance: 432,
        entryCount: 4,
      },
      hedera_usdc: {
        code: '1052',
        name: 'Crypto Clearing - USDC',
        accountType: 'ASSET',
        balance: 528,
        entryCount: 6,
      },
      hedera_usdt: null,
      hedera_audd: {
        code: '1054',
        name: 'Crypto Clearing - AUDD',
        accountType: 'ASSET',
        balance: 96,
        entryCount: 2,
      },
    },
    otherAccounts: [
      {
        code: '1200',
        name: 'Accounts Receivable',
        accountType: 'ASSET',
        balance: -2406,
        entryCount: 24,
      },
    ],
    allAccounts: [],
  };

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ledger Balance Report</CardTitle>
          <CardDescription>
            Sample data for demo — live data unavailable
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-amber-700 mb-4">
            {error ?? 'Could not load data.'} Showing sample data for demo.
          </p>
          <LedgerBalanceContent data={placeholderData} />
        </CardContent>
      </Card>
    );
  }

  const clearingAccountsArray = [
    { key: 'Stripe', account: data.clearingAccounts.stripe },
    { key: 'Hedera - HBAR', account: data.clearingAccounts.hedera_hbar },
    { key: 'Hedera - USDC', account: data.clearingAccounts.hedera_usdc },
    { key: 'Hedera - USDT', account: data.clearingAccounts.hedera_usdt },
    { key: 'Hedera - AUDD', account: data.clearingAccounts.hedera_audd },
  ].filter((item) => item.account !== null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ledger Balance Report</CardTitle>
        <CardDescription>
          Current balances across all ledger accounts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LedgerBalanceContent data={data} />
      </CardContent>
    </Card>
  );
}

function LedgerBalanceContent({ data }: { data: LedgerBalanceData }) {
  const clearingAccountsArray = [
    { key: 'Stripe', account: data.clearingAccounts.stripe },
    { key: 'Hedera - HBAR', account: data.clearingAccounts.hedera_hbar },
    { key: 'Hedera - USDC', account: data.clearingAccounts.hedera_usdc },
    { key: 'Hedera - USDT', account: data.clearingAccounts.hedera_usdt },
    { key: 'Hedera - AUDD', account: data.clearingAccounts.hedera_audd },
  ].filter((item): item is { key: string; account: LedgerAccount } => item.account !== null);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-3">Clearing Accounts</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Code</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-right">Entries</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clearingAccountsArray.map(({ key, account }) => (
              <TableRow key={account.code}>
                <TableCell className="font-medium">{key}</TableCell>
                <TableCell>
                  <Badge variant="outline">{account.code}</Badge>
                </TableCell>
                <TableCell className="text-right font-mono">
                  ${account.balance.toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                  {account.entryCount}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {data.otherAccounts.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Other Accounts</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Entries</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.otherAccounts.map((account) => (
                <TableRow key={account.code}>
                  <TableCell className="font-medium">{account.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{account.code}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{account.accountType}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ${account.balance.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    {account.entryCount}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}







