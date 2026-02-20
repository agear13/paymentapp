/**
 * Wise Settlement Posting Rules
 * Double-entry: DR Wise Clearing (1055), CR Accounts Receivable (1200)
 */

import { LedgerEntryService, JournalEntry } from '../ledger-entry-service';
import { LEDGER_ACCOUNTS } from '../account-mapping';
import { provisionWiseLedgerAccounts } from '../ledger-account-provisioner';
import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';

export interface WiseSettlementParams {
  paymentLinkId: string;
  organizationId: string;
  wiseTransferId: string;
  grossAmount: string;
  currency: string;
  correlationId?: string;
}

export async function postWiseSettlement(params: WiseSettlementParams): Promise<void> {
  const {
    paymentLinkId,
    organizationId,
    wiseTransferId,
    grossAmount,
    currency,
    correlationId,
  } = params;

  loggers.ledger.info(
    { paymentLinkId, wiseTransferId, grossAmount, currency },
    'Starting Wise settlement posting'
  );

  await provisionWiseLedgerAccounts(prisma, organizationId, correlationId);

  const ledgerService = new LedgerEntryService();
  const description = `Wise transfer received – Transfer ID: ${wiseTransferId}, Amount: ${grossAmount} ${currency}`;

  const entries: JournalEntry[] = [
    {
      accountCode: LEDGER_ACCOUNTS.WISE_CLEARING,
      entryType: 'DEBIT',
      amount: grossAmount,
      currency,
      description,
    },
    {
      accountCode: LEDGER_ACCOUNTS.ACCOUNTS_RECEIVABLE,
      entryType: 'CREDIT',
      amount: grossAmount,
      currency,
      description,
    },
  ];

  await ledgerService.postJournalEntries({
    entries,
    paymentLinkId,
    organizationId,
    idempotencyKey: `wise-transfer-${wiseTransferId}`,
    correlationId,
  });

  loggers.ledger.info(
    { paymentLinkId, wiseTransferId },
    'Wise settlement posting complete'
  );
}
