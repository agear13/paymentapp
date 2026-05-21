import { formatAmount } from '@/lib/utils/format-amount';

type LedgerEntryForExplanation = {
  entry_type: 'DEBIT' | 'CREDIT';
  amount: number | string;
  currency: string;
  description: string;
  ledger_accounts: {
    code: string;
    name: string;
  };
  payment_links: {
    short_code: string;
    invoice_reference: string | null;
  };
};

function paymentRef(entry: LedgerEntryForExplanation): string {
  return entry.payment_links.invoice_reference ?? entry.payment_links.short_code;
}

/**
 * Human-friendly explanation for operators; accounting structure unchanged.
 */
export function getLedgerEntryExplanation(
  entry: LedgerEntryForExplanation
): string | null {
  const amount = formatAmount(Number(entry.amount), entry.currency);
  const ref = paymentRef(entry);
  const accountName = entry.ledger_accounts.name;
  const code = entry.ledger_accounts.code;
  const isDebit = entry.entry_type === 'DEBIT';
  const desc = entry.description.toLowerCase();

  if (code === '1050' || accountName.toLowerCase().includes('stripe clearing')) {
    if (isDebit) {
      return `Customer paid ${amount} via Stripe. Funds moved into Stripe clearing awaiting settlement.`;
    }
    return `Funds released or adjusted in Stripe clearing for ${ref}.`;
  }

  if (code === '1055' || accountName.toLowerCase().includes('wise clearing')) {
    if (isDebit) {
      return `Wise transfer of ${amount} received. Funds held in Wise clearing awaiting settlement.`;
    }
    return `Wise clearing adjusted for ${ref}.`;
  }

  if (
    ['1051', '1052', '1053', '1054'].includes(code) ||
    accountName.toLowerCase().includes('crypto clearing')
  ) {
    if (isDebit) {
      return `Customer paid ${amount} on Hedera. Funds moved into ${accountName} awaiting settlement.`;
    }
    return `Hedera clearing adjusted for ${ref}.`;
  }

  if (desc.includes('processing fee') || desc.includes('stripe fee')) {
    return `Stripe processing fee recorded against payment ${ref}.`;
  }

  if (desc.includes('commission') || code.startsWith('4')) {
    return `Commission or allocation recorded for ${ref}.`;
  }

  if (desc.includes('settlement') || desc.includes('payout')) {
    return `Settlement movement linked to ${ref}.`;
  }

  if (code === '1200' || accountName.toLowerCase().includes('receivable')) {
    if (isDebit) {
      return `Accounts receivable increased by ${amount} for ${ref}.`;
    }
    return `Accounts receivable reduced by ${amount} for ${ref}.`;
  }

  return null;
}
