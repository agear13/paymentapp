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
import { ExternalLink } from 'lucide-react';

type PaymentEvent = {
  id: string;
  payment_link_id: string;
  event_type: string;
  payment_method: string | null;
  stripe_payment_intent_id: string | null;
  hedera_transaction_id: string | null;
  amount_received: any;
  currency_received: string | null;
  created_at: Date;
  metadata: any;
  payment_links: {
    id: string;
    short_code: string;
    description: string | null;
    invoice_reference: string | null;
    amount: any;
    currency: string;
  };
};

interface TransactionsTableProps {
  events: PaymentEvent[];
}

export function TransactionsTable({ events }: TransactionsTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Payment Link</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Transaction ID</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => (
            <TableRow key={event.id}>
              <TableCell className="font-mono text-sm">
                {format(new Date(event.created_at), 'MMM d, yyyy HH:mm')}
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{event.payment_links.short_code}</span>
                  {event.payment_links.invoice_reference && (
                    <span className="text-xs text-muted-foreground">
                      {event.payment_links.invoice_reference}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="max-w-[200px] truncate">
                {event.payment_links.description || '-'}
              </TableCell>
              <TableCell>
                <Badge variant={event.payment_method === 'STRIPE' ? 'default' : 'secondary'}>
                  {event.payment_method || 'Unknown'}
                </Badge>
              </TableCell>
              <TableCell>
                {event.stripe_payment_intent_id && (
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-xs truncate max-w-[150px]">
                      {event.stripe_payment_intent_id}
                    </span>
                    <a
                      href={`https://dashboard.stripe.com/payments/${event.stripe_payment_intent_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                {event.hedera_transaction_id && (
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-xs truncate max-w-[150px]">
                      {event.hedera_transaction_id}
                    </span>
                    <a
                      href={`https://hashscan.io/testnet/transaction/${event.hedera_transaction_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                {!event.stripe_payment_intent_id && !event.hedera_transaction_id && '-'}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(
                  Number(event.amount_received || event.payment_links.amount),
                  event.currency_received || event.payment_links.currency
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

