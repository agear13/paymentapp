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
import { formatAmount } from '@/lib/utils/format-amount';

type LedgerEntry = {
  id: string;
  payment_link_id: string;
  ledger_account_id: string;
  entry_type: 'DEBIT' | 'CREDIT';
  amount: number | string;
  currency: string;
  description: string;
  idempotency_key: string;
  created_at: Date;
  ledger_accounts: {
    code: string;
    name: string;
    account_type: string;
  };
  payment_links: {
    short_code: string;
    invoice_reference: string | null;
    description: string | null;
  };
};

interface LedgerEntriesTableProps {
  entries: LedgerEntry[];
}

export function LedgerEntriesTable({ entries }: LedgerEntriesTableProps) {
  // Helper to format date consistently (avoid hydration issues)
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  };

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[150px]">Date</TableHead>
            <TableHead className="min-w-[180px]">Account</TableHead>
            <TableHead className="min-w-[250px]">Description</TableHead>
            <TableHead className="min-w-[120px]">Payment Link</TableHead>
            <TableHead className="min-w-[80px]">Type</TableHead>
            <TableHead className="text-right min-w-[140px]">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="font-mono text-sm whitespace-nowrap">
                {formatDate(new Date(entry.created_at))}
              </TableCell>
              <TableCell>
                <div className="flex flex-col min-w-[150px]">
                  <span className="font-medium truncate">{entry.ledger_accounts.name}</span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {entry.ledger_accounts.code}
                  </span>
                </div>
              </TableCell>
              <TableCell className="max-w-[250px] overflow-hidden">
                <span className="text-sm block truncate">{entry.description}</span>
              </TableCell>
              <TableCell>
                <div className="flex flex-col min-w-[100px]">
                  <span className="font-mono text-sm">{entry.payment_links.short_code}</span>
                  {entry.payment_links.invoice_reference && (
                    <span className="text-xs text-muted-foreground truncate">
                      {entry.payment_links.invoice_reference}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant={entry.entry_type === 'DEBIT' ? 'default' : 'secondary'}
                  className={
                    entry.entry_type === 'DEBIT'
                      ? 'bg-red-100 text-red-800 hover:bg-red-200'
                      : 'bg-green-100 text-green-800 hover:bg-green-200'
                  }
                >
                  {entry.entry_type === 'DEBIT' ? 'DR' : 'CR'}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-medium font-mono whitespace-nowrap">
                {formatAmount(Number(entry.amount), entry.currency)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

