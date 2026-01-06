'use client';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type LedgerAccount = {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  account_type: string;
  xero_account_id: string | null;
  created_at: Date;
};

interface ChartOfAccountsProps {
  accounts: LedgerAccount[];
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  ASSET: 'Asset',
  LIABILITY: 'Liability',
  EQUITY: 'Equity',
  REVENUE: 'Revenue',
  EXPENSE: 'Expense',
  CLEARING: 'Clearing',
};

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  ASSET: 'bg-blue-100 text-blue-800',
  LIABILITY: 'bg-red-100 text-red-800',
  EQUITY: 'bg-purple-100 text-purple-800',
  REVENUE: 'bg-green-100 text-green-800',
  EXPENSE: 'bg-orange-100 text-orange-800',
  CLEARING: 'bg-gray-100 text-gray-800',
};

export function ChartOfAccounts({ accounts }: ChartOfAccountsProps) {
  // Group accounts by type
  const groupedAccounts = accounts.reduce((acc, account) => {
    const type = account.account_type;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(account);
    return acc;
  }, {} as Record<string, LedgerAccount[]>);

  return (
    <div className="space-y-6">
      {Object.entries(groupedAccounts).map(([type, typeAccounts]) => (
        <div key={type}>
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-sm font-semibold">{ACCOUNT_TYPE_LABELS[type] || type}</h3>
            <Badge variant="outline">{typeAccounts.length}</Badge>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Xero Integration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {typeAccounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-mono font-medium">
                      {account.code}
                    </TableCell>
                    <TableCell>{account.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={ACCOUNT_TYPE_COLORS[account.account_type] || ''}
                      >
                        {ACCOUNT_TYPE_LABELS[account.account_type] || account.account_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {account.xero_account_id ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          Synced
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not synced</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  );
}

