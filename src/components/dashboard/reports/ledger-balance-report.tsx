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
import { formatCurrency } from '@/lib/formatters/format-currency';

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
    wise: LedgerAccount | null;
    hedera_hbar: LedgerAccount | null;
    hedera_usdc: LedgerAccount | null;
    hedera_usdt: LedgerAccount | null;
    hedera_audd: LedgerAccount | null;
  };
  otherAccounts: LedgerAccount[];
}

interface LedgerBalanceReportProps {
  organizationId: string;
}

const CLEARING_ROWS: { key: keyof LedgerBalanceData['clearingAccounts']; label: string }[] = [
  { key: 'stripe', label: 'Stripe' },
  { key: 'wise', label: 'Wise' },
  { key: 'hedera_hbar', label: 'HBAR' },
  { key: 'hedera_usdc', label: 'USDC' },
  { key: 'hedera_usdt', label: 'USDT' },
  { key: 'hedera_audd', label: 'AUDD' },
];

export function LedgerBalanceReport({ organizationId }: LedgerBalanceReportProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LedgerBalanceData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchData();
  }, [organizationId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `/api/reports/ledger-balance?organizationId=${organizationId}`
      );
      if (!response.ok) throw new Error('Failed to fetch ledger balances');
      setData((await response.json()) as LedgerBalanceData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ledger balance report</CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ledger balance report</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-amber-800">{error ?? 'Ledger balances unavailable.'}</p>
        </CardContent>
      </Card>
    );
  }

  const hasClearingActivity = CLEARING_ROWS.some(
    ({ key }) => data.clearingAccounts[key] !== null
  );
  const hasAnyEntries =
    hasClearingActivity ||
    data.otherAccounts.some((a) => a.entryCount > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ledger balance report</CardTitle>
        <CardDescription>Current balances across clearing and supporting accounts.</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasAnyEntries ? (
          <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-8 text-center text-sm">
            <p className="font-medium">No settlement activity yet</p>
            <p className="mt-1 text-muted-foreground">
              Ledger entries will appear after your first payment.
            </p>
          </div>
        ) : (
          <LedgerBalanceContent data={data} />
        )}
      </CardContent>
    </Card>
  );
}

function LedgerBalanceContent({ data }: { data: LedgerBalanceData }) {
  const clearingRows = CLEARING_ROWS.map(({ key, label }) => {
    const account = data.clearingAccounts[key];
    return {
      label,
      account,
      displayBalance: account?.balance ?? 0,
      displayCode: account?.code ?? (key === 'wise' ? '1055' : '—'),
      displayName: account?.name ?? `${label} clearing`,
      entryCount: account?.entryCount ?? 0,
      provisioned: account !== null,
    };
  });

  const hasClearingBalances = clearingRows.some((r) => r.provisioned && r.entryCount > 0);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-3">Clearing accounts</h3>
        {!hasClearingBalances ? (
          <p className="text-sm text-muted-foreground mb-3">No clearing balances recorded yet.</p>
        ) : null}
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
            {clearingRows.map((row) => (
              <TableRow key={row.label}>
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell>
                  <Badge variant="outline">{row.displayCode}</Badge>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(row.displayBalance, 'AUD')}
                </TableCell>
                <TableCell className="text-right">{row.entryCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {data.otherAccounts.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold mb-3">Other accounts</h3>
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
                    {formatCurrency(account.balance, 'AUD')}
                  </TableCell>
                  <TableCell className="text-right">{account.entryCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}
