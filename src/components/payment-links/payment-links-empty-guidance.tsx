import Link from 'next/link';
import { Button } from '@/components/ui/button';

const CREATE_INVOICE_HREF = '/dashboard/payment-links#create-invoice';

/** Empty state for Ledger → Entries tab (no ledger rows yet). */
export function PaymentLinksLedgerEntriesEmpty() {
  return (
    <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-10 text-center">
      <p className="text-foreground mx-auto max-w-md text-sm leading-relaxed">
        This is your double-entry ledger. You&apos;ll start seeing entries here after your first payment.
      </p>
      <Button className="mt-4" variant="secondary" size="sm" asChild>
        <Link href={CREATE_INVOICE_HREF}>Create invoice</Link>
      </Button>
    </div>
  );
}

/** Empty state when the org has no payment transactions yet (All / Stripe / Hedera tabs). */
export function PaymentLinksTransactionsEmpty() {
  return (
    <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-10 text-center">
      <p className="text-foreground mx-auto max-w-md text-sm leading-relaxed">
        Transactions appear once payments are attempted or received.
      </p>
      <Button className="mt-4" variant="secondary" size="sm" asChild>
        <Link href={CREATE_INVOICE_HREF}>Create invoice</Link>
      </Button>
    </div>
  );
}
