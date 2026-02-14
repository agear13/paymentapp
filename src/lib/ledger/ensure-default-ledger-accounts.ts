/**
 * Ensures required internal ledger accounts exist for an organization.
 * Used before Stripe settlement posting to avoid 500s from missing accounts.
 * Idempotent: createMany with skipDuplicates.
 */

import type { PrismaClient } from '@prisma/client';
import { LEDGER_ACCOUNTS } from './account-mapping';
import { loggers } from '@/lib/logger';

/** Stripe settlement requires these account codes */
const STRIPE_REQUIRED_CODES = [
  LEDGER_ACCOUNTS.STRIPE_CLEARING, // 1050
  LEDGER_ACCOUNTS.ACCOUNTS_RECEIVABLE, // 1200
  LEDGER_ACCOUNTS.PROCESSOR_FEE_EXPENSE, // 6100
] as const;

const ACCOUNT_DEFINITIONS: Array<{
  code: string;
  name: string;
  account_type: 'ASSET' | 'EXPENSE';
}> = [
  { code: '1050', name: 'Stripe Clearing', account_type: 'ASSET' },
  { code: '1200', name: 'Accounts Receivable', account_type: 'ASSET' },
  { code: '6100', name: 'Processor Fee Expense', account_type: 'EXPENSE' },
];

/**
 * Ensure default ledger accounts exist for an organization.
 * Creates missing accounts with createMany(skipDuplicates: true).
 * Does NOT create Xero accounts; xero_account_id remains null.
 *
 * @param prisma - Prisma client (or transaction client)
 * @param organizationId - Organization UUID
 * @param correlationId - Optional correlation ID for logging
 * @returns Object with created count and any missing codes (before creation)
 */
export async function ensureDefaultLedgerAccounts(
  prisma: PrismaClient,
  organizationId: string,
  correlationId?: string
): Promise<{ createdCount: number; missingBefore: string[] }> {
  const existing = await prisma.ledger_accounts.findMany({
    where: {
      organization_id: organizationId,
      code: { in: [...STRIPE_REQUIRED_CODES] },
    },
    select: { code: true },
  });

  const existingCodes = new Set(existing.map((a) => a.code));
  const missingBefore = STRIPE_REQUIRED_CODES.filter((c) => !existingCodes.has(c));

  if (missingBefore.length === 0) {
    loggers.ledger.debug(
      { organizationId, correlationId },
      'Default ledger accounts ensured (all exist)'
    );
    return { createdCount: 0, missingBefore: [] };
  }

  const data = ACCOUNT_DEFINITIONS.filter((def) => missingBefore.includes(def.code)).map(
    (def) => ({
      organization_id: organizationId,
      code: def.code,
      name: def.name,
      account_type: def.account_type,
    })
  );

  const result = await prisma.ledger_accounts.createMany({
    data,
    skipDuplicates: true,
  });

  loggers.ledger.info(
    {
      organizationId,
      correlationId,
      createdCount: result.count,
      createdCodes: data.map((d) => d.code),
      missingBefore,
    },
    'Default ledger accounts ensured'
  );

  return { createdCount: result.count, missingBefore };
}
