/**
 * Manual-wallet crypto settlement — posts to the same holding account code as Xero resolver.
 */

import { Prisma } from '@prisma/client';
import { resolveSettlementAccount } from '@/lib/accounting/settlement-account-resolver';
import { LedgerEntryService, type JournalEntry } from '../ledger-entry-service';
import { LEDGER_ACCOUNTS } from '../account-mapping';
import { loggers } from '@/lib/logger';

export interface ResolverCryptoSettlementParams {
  paymentLinkId: string;
  organizationId: string;
  paymentAsset: string;
  grossAmount: string;
  currency: string;
  transactionId: string;
  correlationId?: string;
}

async function provisionLedgerAccountIfMissing(
  db: Prisma.TransactionClient,
  organizationId: string,
  code: string,
  name: string
): Promise<void> {
  const existing = await db.ledger_accounts.findUnique({
    where: {
      organization_id_code: {
        organization_id: organizationId,
        code,
      },
    },
  });

  if (existing) return;

  try {
    await db.ledger_accounts.create({
      data: {
        organization_id: organizationId,
        code,
        name,
        account_type: 'ASSET',
      },
    });
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: string }).code === 'P2002'
    ) {
      return;
    }
    throw err;
  }
}

export async function postResolverCryptoSettlement(
  params: ResolverCryptoSettlementParams,
  tx: Prisma.TransactionClient
): Promise<void> {
  const {
    paymentLinkId,
    organizationId,
    paymentAsset,
    grossAmount,
    currency,
    transactionId,
    correlationId,
  } = params;

  const settings = await tx.merchant_settings.findFirst({
    where: { organization_id: organizationId },
    select: {
      xero_stripe_clearing_account_id: true,
      xero_wise_clearing_account_id: true,
      xero_hbar_clearing_account_id: true,
      xero_usdc_clearing_account_id: true,
      xero_usdt_clearing_account_id: true,
      xero_audd_clearing_account_id: true,
    },
  });

  if (!settings) {
    throw new Error('Merchant settings not found for crypto settlement posting');
  }

  const resolution = resolveSettlementAccount({
    paymentRail: 'crypto',
    collectionMethod: 'manual_wallet',
    paymentAsset,
    settings,
  });

  if (resolution.status !== 'resolved') {
    throw new Error(
      `Crypto holding account not configured for ${paymentAsset}. Link the holding account in Xero setup.`
    );
  }

  const clearingAccountCode = resolution.xeroAccountCode;
  const clearingAccountName = resolution.target.accountName;

  await provisionLedgerAccountIfMissing(
    tx,
    organizationId,
    clearingAccountCode,
    clearingAccountName
  );
  await provisionLedgerAccountIfMissing(
    tx,
    organizationId,
    LEDGER_ACCOUNTS.ACCOUNTS_RECEIVABLE,
    'Accounts Receivable'
  );

  const description = [
    `Manual wallet crypto payment`,
    `Asset: ${paymentAsset}`,
    `Reference: ${transactionId}`,
    `Amount: ${grossAmount} ${currency}`,
  ].join(' — ');

  const entries: JournalEntry[] = [
    {
      accountCode: clearingAccountCode,
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

  const ledgerService = new LedgerEntryService();
  await ledgerService.postJournalEntries({
    entries,
    paymentLinkId,
    organizationId,
    idempotencyKey: `manual-crypto-${transactionId}`,
    correlationId,
    tx,
  });

  loggers.ledger.info(
    'Manual wallet crypto settlement posted (resolver-aligned)',
    {
      paymentLinkId,
      paymentAsset,
      clearingAccountCode,
      transactionId,
      correlationId,
    }
  );
}
