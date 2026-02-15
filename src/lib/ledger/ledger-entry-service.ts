/**
 * Ledger Entry Service
 * Core service for double-entry accounting operations
 * 
 * Key features:
 * - Atomic transaction posting (DR = CR validation)
 * - Idempotency to prevent duplicate postings
 * - Account code validation
 * - Balance validation
 * - Entry reversal support
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';

/**
 * A single journal entry (DR or CR)
 */
export interface JournalEntry {
  accountCode: string;
  entryType: 'DEBIT' | 'CREDIT';
  amount: string; // Decimal string
  currency: string; // ISO 4217 code
  description: string;
}

/**
 * Parameters for posting journal entries
 */
export interface PostingParams {
  entries: JournalEntry[];
  paymentLinkId: string;
  organizationId: string;
  idempotencyKey: string;
  correlationId?: string; // Optional, for idempotent retry logging
}

/**
 * Result of posting operation
 */
export interface PostingResult {
  success: boolean;
  entriesPosted: number;
  totalDebits: string;
  totalCredits: string;
  idempotencyKey: string;
  message?: string;
}

/**
 * Parameters for reversing journal entries
 */
export interface ReversalParams {
  originalIdempotencyKey: string;
  reversalReason: string;
  organizationId: string;
}

/**
 * Ledger Entry Service
 * Handles all double-entry accounting operations
 */
export class LedgerEntryService {
  /**
   * Post journal entries atomically
   * 
   * Validates:
   * - Idempotency (no duplicates)
   * - Balance (DR = CR)
   * - Account existence
   * 
   * @param params - Posting parameters
   * @returns Posting result
   * @throws Error if validation fails
   */
  async postJournalEntries(params: PostingParams): Promise<PostingResult> {
    const { entries, paymentLinkId, organizationId, idempotencyKey, correlationId } = params;

    loggers.ledger.info(
      {
        paymentLinkId,
        idempotencyKey,
        entriesCount: entries.length,
      },
      'Starting journal entry posting'
    );

    // 1. Check idempotency - has this batch already been posted? (first entry key)
    const firstEntryKey = `${idempotencyKey}-0`;
    const alreadyPosted = await this.checkIdempotency(firstEntryKey);
    if (alreadyPosted) {
      loggers.ledger.info(
        { idempotencyKey, correlationId },
        'Ledger entries already exist (idempotent retry)'
      );

      return {
        success: true,
        entriesPosted: 0,
        totalDebits: '0',
        totalCredits: '0',
        idempotencyKey,
        message: 'Entries already posted (duplicate prevented)',
      };
    }

    // 2. Validate entries balance (DR = CR)
    this.validateBalance(entries);

    // 3. Get account IDs from codes
    const accountIds = await this.getAccountIds(organizationId, entries);

    // 4. Build batch with unique idempotency_key per entry (deterministic)
    const totalDebits = entries
      .filter((e) => e.entryType === 'DEBIT')
      .reduce((sum, e) => sum.add(new Prisma.Decimal(e.amount)), new Prisma.Decimal(0));
    const totalCredits = entries
      .filter((e) => e.entryType === 'CREDIT')
      .reduce((sum, e) => sum.add(new Prisma.Decimal(e.amount)), new Prisma.Decimal(0));

    const data = entries.map((entry, i) => ({
      payment_link_id: paymentLinkId,
      ledger_account_id: accountIds[entry.accountCode],
      entry_type: entry.entryType,
      amount: new Prisma.Decimal(entry.amount),
      currency: entry.currency,
      description: entry.description,
      idempotency_key: `${idempotencyKey}-${i}`,
    }));

    // 5. Post via createMany with skipDuplicates (idempotent on retries)
    const result = await prisma.ledger_entries.createMany({
      data,
      skipDuplicates: true,
    });

    if (result.count === 0) {
      loggers.ledger.info(
        { idempotencyKey, correlationId, firstEntryKey: `${idempotencyKey}-0` },
        'Ledger entries already exist (idempotent retry, duplicates skipped)'
      );
    } else if (result.count < entries.length) {
      loggers.ledger.info(
        { idempotencyKey, correlationId, inserted: result.count, expected: entries.length },
        'Ledger entries partially already exist (idempotent retry)'
      );
    } else {
      loggers.ledger.info(
        {
          paymentLinkId,
          idempotencyKey,
          postedCount: result.count,
          totalDebits: totalDebits.toString(),
          totalCredits: totalCredits.toString(),
        },
        'Journal entries posted successfully'
      );
    }

    return {
      success: true,
      entriesPosted: result.count,
      totalDebits: totalDebits.toString(),
      totalCredits: totalCredits.toString(),
      idempotencyKey,
    };
  }

  /**
   * Reverse journal entries
   * Creates opposite entries for the original posting
   * 
   * @param params - Reversal parameters
   * @returns Posting result for reversal entries
   * @throws Error if original entries not found
   */
  async reverseEntries(params: ReversalParams): Promise<PostingResult> {
    const { originalIdempotencyKey, reversalReason, organizationId } = params;

    loggers.ledger.info(
      {
        originalIdempotencyKey,
        reversalReason,
      },
      'Starting entry reversal'
    );

    // 1. Get original entries (support both exact key and suffixed keys e.g. key-0, key-1)
    const originalEntries = await prisma.ledger_entries.findMany({
      where: {
        OR: [
          { idempotency_key: originalIdempotencyKey },
          { idempotency_key: { startsWith: `${originalIdempotencyKey}-` } },
        ],
      },
      include: { ledger_accounts: true },
    });

    if (originalEntries.length === 0) {
      throw new Error(
        `No entries found for idempotency key: ${originalIdempotencyKey}`
      );
    }

    // 2. Create reversal entries (flip DR/CR)
    const reversalEntries: JournalEntry[] = originalEntries.map((entry) => ({
      accountCode: entry.ledger_accounts.code,
      entryType: entry.entry_type === 'DEBIT' ? ('CREDIT' as const) : ('DEBIT' as const),
      amount: entry.amount.toString(),
      currency: entry.currency,
      description: `REVERSAL: ${reversalReason}\n\nOriginal entry: ${entry.description}\nOriginal key: ${originalIdempotencyKey}`,
    }));

    // 3. Post reversal entries
    const result = await this.postJournalEntries({
      entries: reversalEntries,
      paymentLinkId: originalEntries[0].payment_link_id,
      organizationId,
      idempotencyKey: `reversal-${originalIdempotencyKey}`,
    });

    loggers.ledger.info(
      {
        originalIdempotencyKey,
        reversalIdempotencyKey: result.idempotencyKey,
        entriesReversed: result.entriesPosted,
      },
      'Entries reversed successfully'
    );

    return result;
  }

  /**
   * Validate that debits equal credits
   * 
   * @param entries - Journal entries to validate
   * @throws Error if entries don't balance
   * @private
   */
  private validateBalance(entries: JournalEntry[]): void {
    const debits = entries
      .filter((e) => e.entryType === 'DEBIT')
      .reduce((sum, e) => sum + parseFloat(e.amount), 0);

    const credits = entries
      .filter((e) => e.entryType === 'CREDIT')
      .reduce((sum, e) => sum + parseFloat(e.amount), 0);

    // Allow 0.01 variance for rounding
    const variance = Math.abs(debits - credits);

    if (variance > 0.01) {
      const error = `Ledger entries don't balance: DR=${debits.toFixed(2)}, CR=${credits.toFixed(2)}, Variance=${variance.toFixed(2)}`;
      
      loggers.ledger.error(
        {
          debits,
          credits,
          variance,
          entries,
        },
        error
      );

      throw new Error(error);
    }

    loggers.ledger.debug(
      {
        debits,
        credits,
        variance,
      },
      'Entries balance validated'
    );
  }

  /**
   * Check if entries already posted with this idempotency key
   * 
   * @param key - Idempotency key to check
   * @returns True if entries already exist
   * @private
   */
  private async checkIdempotency(key: string): Promise<boolean> {
    const count = await prisma.ledger_entries.count({
      where: { idempotency_key: key },
    });
    
    return count > 0;
  }

  /**
   * Get account IDs from account codes
   * Validates that all accounts exist
   * 
   * @param organizationId - Organization ID
   * @param entries - Journal entries
   * @returns Map of account code to account ID
   * @throws Error if any account not found
   * @private
   */
  private async getAccountIds(
    organizationId: string,
    entries: JournalEntry[]
  ): Promise<Record<string, string>> {
    // Get unique account codes
    const codes = [...new Set(entries.map((e) => e.accountCode))];

    // Fetch accounts
    const accounts = await prisma.ledger_accounts.findMany({
      where: {
        organization_id: organizationId,
        code: { in: codes },
      },
      select: {
        id: true,
        code: true,
      },
    });

    // Verify all accounts found
    if (accounts.length !== codes.length) {
      const foundCodes = accounts.map((a) => a.code);
      const missing = codes.filter((c) => !foundCodes.includes(c));
      
      const error = `Account codes not found: ${missing.join(', ')}`;
      loggers.ledger.error(
        {
          organizationId,
          requestedCodes: codes,
          foundCodes,
          missingCodes: missing,
        },
        error
      );

      throw new Error(error);
    }

    // Return code -> id mapping
    return accounts.reduce((map, account) => {
      map[account.code] = account.id;
      return map;
    }, {} as Record<string, string>);
  }

  /**
   * Get all entries for a payment link
   * 
   * @param paymentLinkId - Payment link ID
   * @returns Array of ledger entries
   */
  async getEntriesForPaymentLink(paymentLinkId: string) {
    return await prisma.ledger_entries.findMany({
      where: { payment_link_id: paymentLinkId },
      include: {
        ledger_accounts: {
          select: {
            code: true,
            name: true,
            account_type: true,
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });
  }

  /**
   * Get entries by idempotency key
   * 
   * @param idempotencyKey - Idempotency key
   * @returns Array of ledger entries
   */
  async getEntriesByIdempotencyKey(idempotencyKey: string) {
    return await prisma.ledger_entries.findMany({
      where: { idempotency_key: idempotencyKey },
      include: {
        ledger_accounts: {
          select: {
            code: true,
            name: true,
            account_type: true,
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });
  }
}

/**
 * Singleton instance
 */
export const ledgerEntryService = new LedgerEntryService();






