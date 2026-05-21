'use client';

import { Fragment, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatAmount } from '@/lib/utils/format-amount';
import { formatReportDateTime } from '@/lib/format/format-report-datetime';
import { getLedgerEntryExplanation } from '@/lib/ledger/ledger-entry-explanation';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';

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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead className="min-w-[150px]">Date</TableHead>
            <TableHead className="min-w-[180px]">Account</TableHead>
            <TableHead className="min-w-[250px]">Description</TableHead>
            <TableHead className="min-w-[120px]">Payment link</TableHead>
            <TableHead className="min-w-[80px]">Type</TableHead>
            <TableHead className="text-right min-w-[140px]">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const explanation = getLedgerEntryExplanation(entry);
            const isExpanded = expandedId === entry.id;

            return (
              <Fragment key={entry.id}>
                <TableRow>
                  <TableCell className="p-1">
                    {explanation ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : entry.id)
                        }
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <span className="sr-only">Explain entry</span>
                      </Button>
                    ) : null}
                  </TableCell>
                  <TableCell className="font-mono text-sm whitespace-nowrap">
                    {formatReportDateTime(entry.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col min-w-[150px]">
                      <span className="font-medium truncate">{entry.ledger_accounts.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {entry.ledger_accounts.code} ·{' '}
                        {entry.entry_type === 'DEBIT' ? 'DR' : 'CR'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[250px] overflow-hidden">
                    <span className="text-sm block truncate">{entry.description}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col min-w-[100px]">
                      <span className="font-mono text-sm">{entry.payment_links.short_code}</span>
                      {entry.payment_links.invoice_reference ? (
                        <span className="text-xs text-muted-foreground truncate">
                          {entry.payment_links.invoice_reference}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
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
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs">
                          {entry.entry_type === 'DEBIT'
                            ? 'Debit (DR) — increases this clearing or asset account.'
                            : 'Credit (CR) — offsets or releases from this account.'}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-right font-medium font-mono whitespace-nowrap">
                    {formatAmount(Number(entry.amount), entry.currency)}
                  </TableCell>
                </TableRow>
                {explanation && isExpanded ? (
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={7} className="py-2">
                      <div className="flex items-start gap-2 text-sm text-muted-foreground pl-8">
                        <Info className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>{explanation}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
