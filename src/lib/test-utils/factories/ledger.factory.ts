/**
 * Ledger Entry Test Factory
 */

import type { LedgerEntry } from '@prisma/client'

export function createMockLedgerEntry(
  overrides?: Partial<LedgerEntry>
): LedgerEntry {
  return {
    id: overrides?.id || `ledger-entry-${Date.now()}`,
    organizationId: overrides?.organizationId || 'test-org-123',
    paymentLinkId: overrides?.paymentLinkId || 'test-link-123',
    accountCode: overrides?.accountCode || '1200',
    entryType: overrides?.entryType || 'DEBIT',
    amount: overrides?.amount || '100.00',
    currency: overrides?.currency || 'AUD',
    description: overrides?.description || 'Test ledger entry',
    referenceId: overrides?.referenceId || `ref-${Date.now()}`,
    postedAt: overrides?.postedAt || new Date(),
    createdAt: overrides?.createdAt || new Date(),
    metadata: overrides?.metadata || null,
  } as LedgerEntry
}

export function createMockAuddLedgerEntries(
  paymentLinkId: string,
  amount: string = '100.00',
  cryptoAmount: string = '100.000000',
  fxRate: string = '1.00000000'
): LedgerEntry[] {
  const timestamp = new Date()
  const transactionId = `0.0.123@${Date.now()}.000000000`
  
  return [
    // DR Crypto Clearing - AUDD (Account 1054)
    createMockLedgerEntry({
      paymentLinkId,
      accountCode: '1054', // ⭐ AUDD Clearing Account
      entryType: 'DEBIT',
      amount,
      currency: 'AUD',
      description: `AUDD payment received - ${cryptoAmount} AUDD @ ${fxRate} = ${amount} AUD - TX: ${transactionId}`,
      referenceId: transactionId,
      postedAt: timestamp,
    }),
    // CR Accounts Receivable (Account 1200)
    createMockLedgerEntry({
      paymentLinkId,
      accountCode: '1200',
      entryType: 'CREDIT',
      amount,
      currency: 'AUD',
      description: `AUDD payment - Invoice settled - TX: ${transactionId}`,
      referenceId: transactionId,
      postedAt: timestamp,
    }),
  ]
}

export function createMockLedgerEntriesForToken(
  paymentLinkId: string,
  tokenType: 'HBAR' | 'USDC' | 'USDT' | 'AUDD',
  amount: string = '100.00'
): LedgerEntry[] {
  const accountCodeMap = {
    HBAR: '1051',
    USDC: '1052',
    USDT: '1053',
    AUDD: '1054',
  }
  
  const clearingAccountCode = accountCodeMap[tokenType]
  const timestamp = new Date()
  
  return [
    createMockLedgerEntry({
      paymentLinkId,
      accountCode: clearingAccountCode,
      entryType: 'DEBIT',
      amount,
      description: `${tokenType} payment received`,
      postedAt: timestamp,
    }),
    createMockLedgerEntry({
      paymentLinkId,
      accountCode: '1200', // Accounts Receivable
      entryType: 'CREDIT',
      amount,
      description: `${tokenType} payment - Invoice settled`,
      postedAt: timestamp,
    }),
  ]
}

// Verify ledger balance (DR = CR)
export function verifyLedgerBalance(entries: LedgerEntry[]): boolean {
  const debits = entries
    .filter(e => e.entryType === 'DEBIT')
    .reduce((sum, e) => sum + parseFloat(e.amount), 0)
  
  const credits = entries
    .filter(e => e.entryType === 'CREDIT')
    .reduce((sum, e) => sum + parseFloat(e.amount), 0)
  
  return Math.abs(debits - credits) < 0.01 // Allow for floating point precision
}







