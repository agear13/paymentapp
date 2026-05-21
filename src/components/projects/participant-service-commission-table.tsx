'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/lib/formatters/format-currency';
import type { ScopedServiceCommissionRow } from '@/lib/projects/participant-compensation-copy';

type Props = {
  rows: ScopedServiceCommissionRow[];
  showAllServicesNote?: boolean;
};

export function ParticipantServiceCommissionTable({ rows, showAllServicesNote }: Props) {
  if (rows.length === 0 && !showAllServicesNote) {
    return (
      <p className="text-sm text-muted-foreground">
        No service-specific earnings are configured. Compensation follows your project payout terms
        above.
      </p>
    );
  }

  if (rows.length === 0 && showAllServicesNote) {
    return (
      <p className="text-sm text-muted-foreground">
        You may earn on purchases across all active merchant services at the revenue share shown
        above.
      </p>
    );
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Service</TableHead>
            <TableHead className="text-right">Customer price</TableHead>
            <TableHead className="text-right">Revenue share</TableHead>
            <TableHead className="text-right">Estimated earnings</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.name}</TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatCurrency(row.customerPrice, row.currency)}
              </TableCell>
              <TableCell className="text-right text-sm">
                {row.revenueSharePct != null ? `${row.revenueSharePct}%` : '—'}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">{row.earningsLabel}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
