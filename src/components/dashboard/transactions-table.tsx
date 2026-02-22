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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatAmount } from '@/lib/utils/format-amount';
import { ExternalLink, ArrowRightLeft } from 'lucide-react';

type FxSnapshot = {
  id: string;
  snapshot_type: string;
  token_type: string | null;
  rate: number | string;
  base_currency: string;
  quote_currency: string;
  captured_at: Date;
};

type PaymentEvent = {
  id: string;
  payment_link_id: string;
  event_type: string;
  payment_method: string | null;
  stripe_payment_intent_id: string | null;
  hedera_transaction_id: string | null;
  amount_received: number | string | null;
  currency_received: string | null;
  created_at: Date;
  metadata: Record<string, unknown> | null;
  payment_links: {
    id: string;
    short_code: string;
    description: string | null;
    invoice_reference: string | null;
    amount: number | string;
    currency: string;
    fx_snapshots?: FxSnapshot[];
  };
};

interface TransactionsTableProps {
  events: PaymentEvent[];
}

export function TransactionsTable({ events }: TransactionsTableProps) {
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

  // Calculate fiat equivalent if FX snapshot exists and currencies differ
  const getFiatEquivalent = (event: PaymentEvent) => {
    const amountReceived = Number(event.amount_received);
    const currencyReceived = event.currency_received;
    const invoiceCurrency = event.payment_links.currency;
    const settlementSnapshot = event.payment_links.fx_snapshots?.[0];

    // Only show fiat equivalent for crypto payments with settlement snapshots
    if (
      !settlementSnapshot ||
      !amountReceived ||
      !currencyReceived ||
      currencyReceived === invoiceCurrency
    ) {
      return null;
    }

    const rate = Number(settlementSnapshot.rate);
    if (!rate || rate === 0) return null;

    const fiatAmount = amountReceived * rate;
    return {
      amount: fiatAmount,
      currency: invoiceCurrency,
      rate,
      capturedAt: settlementSnapshot.captured_at,
    };
  };

  return (
    <TooltipProvider>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[150px]">Date</TableHead>
              <TableHead className="min-w-[120px]">Payment Link</TableHead>
              <TableHead className="min-w-[180px]">Description</TableHead>
              <TableHead className="min-w-[100px]">Method</TableHead>
              <TableHead className="min-w-[180px]">Transaction ID</TableHead>
              <TableHead className="text-right min-w-[180px]">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => {
              const fiatEquivalent = getFiatEquivalent(event);
              const receivedAmount = Number(event.amount_received || event.payment_links.amount);
              const receivedCurrency = event.currency_received || event.payment_links.currency;

              return (
                <TableRow key={event.id}>
                  <TableCell className="font-mono text-sm">
                    {formatDate(new Date(event.created_at))}
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
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="font-medium">
                        {formatAmount(receivedAmount, receivedCurrency)}
                      </span>
                      {fiatEquivalent && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs text-muted-foreground flex items-center gap-1 cursor-help">
                              <ArrowRightLeft className="h-3 w-3" />
                              ~{formatAmount(fiatEquivalent.amount, fiatEquivalent.currency)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="text-xs">
                            <p>Settlement rate: {fiatEquivalent.rate.toFixed(8)}</p>
                            <p className="text-muted-foreground">
                              Captured at {formatDate(new Date(fiatEquivalent.capturedAt))}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}

