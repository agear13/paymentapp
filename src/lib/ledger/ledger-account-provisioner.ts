/**
 * Provisions required ledger accounts for Stripe settlement posting.
 * Idempotent and concurrency-safe (upsert per account).
 */

import type { PrismaClient } from '@prisma/client';
import { LEDGER_ACCOUNTS } from './account-mapping';
import { loggers } from '@/lib/logger';

/** Commission posting requires these account codes (Option B + generic splits) */
const COMMISSION_REQUIRED_ACCOUNTS = [
  { code: LEDGER_ACCOUNTS.COMMISSION_EXPENSE, name: 'Commission Expense', account_type: 'EXPENSE' as const },
  { code: LEDGER_ACCOUNTS.CONSULTANT_PAYABLE, name: 'Consultant Payable', account_type: 'LIABILITY' as const },
  { code: LEDGER_ACCOUNTS.BD_PARTNER_PAYABLE, name: 'BD Partner Payable', account_type: 'LIABILITY' as const },
  { code: LEDGER_ACCOUNTS.PARTNER_PAYABLE_UNASSIGNED, name: 'Partner Payable (Unassigned)', account_type: 'LIABILITY' as const },
];

/** Stripe settlement requires these account codes */
const STRIPE_REQUIRED_ACCOUNTS = [
  { code: LEDGER_ACCOUNTS.STRIPE_CLEARING, name: 'Stripe Clearing', account_type: 'ASSET' as const },
  { code: LEDGER_ACCOUNTS.ACCOUNTS_RECEIVABLE, name: 'Accounts Receivable', account_type: 'ASSET' as const },
  { code: LEDGER_ACCOUNTS.PROCESSOR_FEE_EXPENSE, name: 'Stripe Fees', account_type: 'EXPENSE' as const },
];

/** Wise settlement requires Wise Clearing + AR */
const WISE_REQUIRED_ACCOUNTS = [
  { code: LEDGER_ACCOUNTS.WISE_CLEARING, name: 'Wise Clearing', account_type: 'ASSET' as const },
  { code: LEDGER_ACCOUNTS.ACCOUNTS_RECEIVABLE, name: 'Accounts Receivable', account_type: 'ASSET' as const },
];

/**
 * Provisions missing ledger accounts for an organization.
 * Uses upsert per account (idempotent, concurrency-safe).
 *
 * @param prisma - Prisma client
 * @param organizationId - Organization UUID
 * @param correlationId - Optional correlation ID for logging
 * @returns Object with created and alreadyExisted codes
 */
export async function provisionStripeLedgerAccounts(
  prisma: PrismaClient,
  organizationId: string,
  correlationId?: string
): Promise<{ created: string[]; alreadyExisted: string[] }> {
  const created: string[] = [];
  const alreadyExisted: string[] = [];

  for (const def of STRIPE_REQUIRED_ACCOUNTS) {
    const existing = await prisma.ledger_accounts.findUnique({
      where: {
        organization_id_code: {
          organization_id: organizationId,
          code: def.code,
        },
      },
    });

    if (existing) {
      alreadyExisted.push(def.code);
      continue;
    }

    try {
      await prisma.ledger_accounts.create({
        data: {
          organization_id: organizationId,
          code: def.code,
          name: def.name,
          account_type: def.account_type,
        },
      });
      created.push(def.code);
    } catch (err: any) {
      // P2002 = unique constraint violation (concurrent create)
      if (err?.code === 'P2002') {
        alreadyExisted.push(def.code);
      } else {
        throw err;
      }
    }
  }

  loggers.ledger.info(
    {
      organizationId,
      correlationId,
      created,
      alreadyExisted,
    },
    'Ledger accounts provisioned'
  );

  return { created, alreadyExisted };
}

/**
 * Provisions missing ledger accounts for Wise settlement.
 */
export async function provisionWiseLedgerAccounts(
  prisma: PrismaClient,
  organizationId: string,
  correlationId?: string
): Promise<{ created: string[]; alreadyExisted: string[] }> {
  const created: string[] = [];
  const alreadyExisted: string[] = [];

  for (const def of WISE_REQUIRED_ACCOUNTS) {
    const existing = await prisma.ledger_accounts.findUnique({
      where: {
        organization_id_code: {
          organization_id: organizationId,
          code: def.code,
        },
      },
    });

    if (existing) {
      alreadyExisted.push(def.code);
      continue;
    }

    try {
      await prisma.ledger_accounts.create({
        data: {
          organization_id: organizationId,
          code: def.code,
          name: def.name,
          account_type: def.account_type,
        },
      });
      created.push(def.code);
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e?.code === 'P2002') {
        alreadyExisted.push(def.code);
      } else {
        throw err;
      }
    }
  }

  loggers.ledger.info(
    { organizationId, correlationId, created, alreadyExisted },
    'Wise ledger accounts provisioned'
  );
  return { created, alreadyExisted };
}

/**
 * Provisions missing ledger accounts for commission posting (Option B).
 * Uses upsert per account (idempotent, concurrency-safe).
 *
 * @param prisma - Prisma client
 * @param organizationId - Organization UUID
 * @param correlationId - Optional correlation ID for logging
 * @returns Object with created and alreadyExisted codes
 */
export async function provisionCommissionLedgerAccounts(
  prisma: PrismaClient,
  organizationId: string,
  correlationId?: string
): Promise<{ created: string[]; alreadyExisted: string[] }> {
  const created: string[] = [];
  const alreadyExisted: string[] = [];

  for (const def of COMMISSION_REQUIRED_ACCOUNTS) {
    const existing = await prisma.ledger_accounts.findUnique({
      where: {
        organization_id_code: {
          organization_id: organizationId,
          code: def.code,
        },
      },
    });

    if (existing) {
      alreadyExisted.push(def.code);
      continue;
    }

    try {
      await prisma.ledger_accounts.create({
        data: {
          organization_id: organizationId,
          code: def.code,
          name: def.name,
          account_type: def.account_type,
        },
      });
      created.push(def.code);
    } catch (err: any) {
      // P2002 = unique constraint violation (concurrent create)
      if (err?.code === 'P2002') {
        alreadyExisted.push(def.code);
      } else {
        throw err;
      }
    }
  }

  loggers.ledger.info(
    {
      organizationId,
      correlationId,
      created,
      alreadyExisted,
    },
    'Commission accounts provisioned'
  );

  return { created, alreadyExisted };
}
