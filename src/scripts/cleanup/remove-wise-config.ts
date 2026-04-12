/**
 * One-time data correction: clear Wise payout configuration from all merchant_settings rows.
 *
 * Clears only: wise_enabled, wise_profile_id, wise_currency.
 * Does NOT delete rows or modify Stripe, Hedera, Xero, or other columns.
 *
 * Usage (from repo root, DATABASE_URL in env):
 *   npx tsx src/scripts/cleanup/remove-wise-config.ts
 */

import { prisma } from '@/lib/server/prisma';

const LOG = '[remove-wise-config]';

async function main() {
  const total = await prisma.merchant_settings.count();

  const affectedBefore = await prisma.merchant_settings.count({
    where: {
      OR: [
        { wise_enabled: true },
        { wise_profile_id: { not: null } },
        { wise_currency: { not: null } },
      ],
    },
  });

  console.log(`${LOG} Total merchant_settings rows: ${total}`);
  console.log(`${LOG} Rows with any Wise field set (before): ${affectedBefore}`);

  const result = await prisma.merchant_settings.updateMany({
    where: {},
    data: {
      wise_enabled: false,
      wise_profile_id: null,
      wise_currency: null,
    },
  });

  console.log(`${LOG} updateMany updated: ${result.count} row(s).`);
  console.log(
    `${LOG} Done. Cleared wise_enabled → false, wise_profile_id → null, wise_currency → null.`
  );
}

main()
  .catch((e) => {
    console.error(`${LOG} Failed:`, e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
