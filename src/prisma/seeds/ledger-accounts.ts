/**
 * Ledger Accounts Seeding Script
 * Initializes default chart of accounts for an organization
 * Includes 4 separate crypto clearing accounts for HBAR, USDC, USDT, AUDD
 */

import { LedgerAccountType } from '@prisma/client';
import { prisma } from '../../lib/server/prisma';

export interface LedgerAccountDefinition {
  code: string;
  name: string;
  accountType: LedgerAccountType;
  description: string;
}

/**
 * Default chart of accounts
 * 
 * CRITICAL: Each crypto token has its own clearing account
 * - 1051: HBAR payments
 * - 1052: USDC payments
 * - 1053: USDT payments
 * - 1054: AUDD payments
 */
export const DEFAULT_CHART_OF_ACCOUNTS: LedgerAccountDefinition[] = [
  {
    code: '1200',
    name: 'Accounts Receivable',
    accountType: 'ASSET',
    description: 'Invoice amounts owed by customers',
  },
  {
    code: '1050',
    name: 'Stripe Clearing',
    accountType: 'ASSET',
    description: 'Stripe credit card payments pending settlement',
  },
  {
    code: '1051',
    name: 'Crypto Clearing - HBAR',
    accountType: 'ASSET',
    description: 'HBAR cryptocurrency payments on Hedera network',
  },
  {
    code: '1052',
    name: 'Crypto Clearing - USDC',
    accountType: 'ASSET',
    description: 'USDC stablecoin payments on Hedera network',
  },
  {
    code: '1053',
    name: 'Crypto Clearing - USDT',
    accountType: 'ASSET',
    description: 'USDT stablecoin payments on Hedera network',
  },
  {
    code: '1054',
    name: 'Crypto Clearing - AUDD',
    accountType: 'ASSET',
    description: 'AUDD (Australian Dollar) stablecoin payments on Hedera network',
  },
  {
    code: '6100',
    name: 'Processor Fee Expense',
    accountType: 'EXPENSE',
    description: 'Payment processing fees (Stripe, network fees)',
  },
  {
    code: '4000',
    name: 'Revenue',
    accountType: 'REVENUE',
    description: 'Sales revenue from payment links',
  },
];

/**
 * Seed ledger accounts for an organization
 * Idempotent - checks if accounts already exist
 */
export async function seedLedgerAccounts(
  organizationId: string
): Promise<{
  created: number;
  existing: number;
  accounts: any[];
}> {
  console.log(`Seeding ledger accounts for organization: ${organizationId}`);

  const created: any[] = [];
  const existing: any[] = [];

  for (const accountDef of DEFAULT_CHART_OF_ACCOUNTS) {
    // Check if account already exists
    const existingAccount = await prisma.ledger_accounts.findUnique({
      where: {
        organization_id_code: {
          organization_id: organizationId,
          code: accountDef.code,
        },
      },
    });

    if (existingAccount) {
      console.log(`  ✓ Account ${accountDef.code} already exists: ${accountDef.name}`);
      existing.push(existingAccount);
      continue;
    }

    // Create new account
    const newAccount = await prisma.ledger_accounts.create({
      data: {
        organization_id: organizationId,
        code: accountDef.code,
        name: accountDef.name,
        account_type: accountDef.accountType,
      },
    });

    console.log(`  ✓ Created account ${accountDef.code}: ${accountDef.name}`);
    created.push(newAccount);
  }

  console.log(
    `\nSeeding complete: ${created.length} created, ${existing.length} already existed`
  );

  return {
    created: created.length,
    existing: existing.length,
    accounts: [...created, ...existing],
  };
}

/**
 * Verify all required accounts exist for an organization
 */
export async function verifyLedgerAccounts(
  organizationId: string
): Promise<{
  isComplete: boolean;
  missing: string[];
  existing: string[];
}> {
  const requiredCodes = DEFAULT_CHART_OF_ACCOUNTS.map((a) => a.code);

  const existingAccounts = await prisma.ledger_accounts.findMany({
    where: {
      organization_id: organizationId,
      code: { in: requiredCodes },
    },
    select: { code: true },
  });

  const existingCodes = existingAccounts.map((a) => a.code);
  const missingCodes = requiredCodes.filter((code) => !existingCodes.includes(code));

  return {
    isComplete: missingCodes.length === 0,
    missing: missingCodes,
    existing: existingCodes,
  };
}

/**
 * Get all crypto clearing accounts for an organization
 */
export async function getCryptoClearing Accounts(organizationId: string) {
  return await prisma.ledger_accounts.findMany({
    where: {
      organization_id: organizationId,
      code: { in: ['1051', '1052', '1053', '1054'] },
    },
    orderBy: { code: 'asc' },
  });
}

/**
 * CLI execution for manual seeding
 */
if (require.main === module) {
  const organizationId = process.argv[2];

  if (!organizationId) {
    console.error('Usage: tsx ledger-accounts.ts <organization_id>');
    process.exit(1);
  }

  seedLedgerAccounts(organizationId)
    .then((result) => {
      console.log('\n✅ Seeding successful!');
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}






