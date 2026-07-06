/**
 * EVM Wallet Settlement Posting Rules
 *
 * DR token-specific crypto clearing, CR Accounts Receivable. The wallet brand
 * stays descriptive metadata; accounting follows the shared crypto token model.
 */

import { Prisma } from '@prisma/client';
import { LedgerEntryService, JournalEntry } from '../ledger-entry-service';
import {
  getCryptoClearingAccountCode,
  validateTokenAccountMapping,
  LEDGER_ACCOUNTS,
} from '../account-mapping';
import type { TokenType } from '@/lib/hedera/constants';
import { loggers } from '@/lib/logger';

export interface EvmWalletSettlementParams {
  paymentLinkId: string;
  organizationId: string;
  tokenType: TokenType;
  tokenAmount: string;
  invoiceAmount: string;
  invoiceCurrency: string;
  fxRate: number;
  transactionHash: string;
  walletAddress: string;
  network: string;
  walletProvider?: string;
  correlationId?: string;
  idempotencyKey?: string;
}

export async function postEvmWalletSettlement(
  params: EvmWalletSettlementParams,
  tx: Prisma.TransactionClient,
): Promise<void> {
  const {
    paymentLinkId,
    organizationId,
    tokenType,
    tokenAmount,
    invoiceAmount,
    invoiceCurrency,
    fxRate,
    transactionHash,
    walletAddress,
    network,
    walletProvider = 'evm_wallet',
    correlationId,
    idempotencyKey,
  } = params;

  loggers.ledger.info(
    {
      paymentLinkId,
      tokenType,
      tokenAmount,
      invoiceAmount,
      invoiceCurrency,
      fxRate,
      transactionHash,
      network,
      walletProvider,
      correlationId,
    },
    'Starting EVM wallet settlement posting'
  );

  const clearingAccountCode = getCryptoClearingAccountCode(tokenType);
  validateTokenAccountMapping(tokenType, clearingAccountCode);

  const description = [
    `EVM wallet payment via ${walletProvider}`,
    `Network: ${network}`,
    `Transaction hash: ${transactionHash}`,
    `Wallet address: ${walletAddress}`,
    `Token: ${tokenType}`,
    `Token amount: ${tokenAmount} ${tokenType}`,
    `Exchange rate: ${fxRate} ${tokenType}/${invoiceCurrency}`,
    `Invoice amount: ${invoiceAmount} ${invoiceCurrency}`,
  ].join('\n');

  const entries: JournalEntry[] = [
    {
      accountCode: clearingAccountCode,
      entryType: 'DEBIT',
      amount: invoiceAmount,
      currency: invoiceCurrency,
      description,
    },
    {
      accountCode: LEDGER_ACCOUNTS.ACCOUNTS_RECEIVABLE,
      entryType: 'CREDIT',
      amount: invoiceAmount,
      currency: invoiceCurrency,
      description,
    },
  ];

  const ledgerService = new LedgerEntryService();
  await ledgerService.postJournalEntries({
    entries,
    paymentLinkId,
    organizationId,
    idempotencyKey: idempotencyKey || `evm-wallet-settlement-${network}-${transactionHash}`,
    correlationId,
    tx,
  });

  loggers.ledger.info(
    {
      paymentLinkId,
      tokenType,
      clearingAccount: clearingAccountCode,
      transactionHash,
      network,
    },
    'EVM wallet settlement posted successfully'
  );
}
