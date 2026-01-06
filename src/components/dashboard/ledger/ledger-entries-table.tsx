'use client';

import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';

type LedgerEntry = {
  id: string;
  payment_link_id: string;
  ledger_account_id: string;
  entry_type: 'DEBIT' | 'CREDIT';
  amount: any;
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
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Payment Link</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="font-mono text-sm">
                {format(new Date(entry.created_at), 'MMM d, yyyy HH:mm')}
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{entry.ledger_accounts.name}</span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {entry.ledger_accounts.code}
                  </span>
                </div>
              </TableCell>
              <TableCell className="max-w-[250px]">
                <span className="text-sm">{entry.description}</span>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-mono text-sm">{entry.payment_links.short_code}</span>
                  {entry.payment_links.invoice_reference && (
                    <span className="text-xs text-muted-foreground">
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
              <TableCell className="text-right font-medium font-mono">
                {formatCurrency(Number(entry.amount), entry.currency)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

