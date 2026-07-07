/**
 * Reproduce Wise invoice-create API calls with debug logging.
 *
 * Usage:
 *   WISE_DEBUG_API=1 WISE_API_TOKEN=... tsx scripts/debug-wise-invoice-api.ts <profileId> [currency]
 *
 * Or load org Wise settings from DB:
 *   WISE_DEBUG_API=1 WISE_API_TOKEN=... tsx scripts/debug-wise-invoice-api.ts --org <organizationId>
 */

import { prisma } from '../lib/server/prisma';
import { getBankDetails, hasWiseCredentials } from '../lib/wise/client';

async function main() {
  process.env.WISE_DEBUG_API = process.env.WISE_DEBUG_API || '1';

  if (!hasWiseCredentials()) {
    console.error('WISE_API_TOKEN is missing. Set it in the environment before running this script.');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  let profileId: string | undefined;
  let currency = 'AUD';

  if (args[0] === '--org') {
    const organizationId = args[1];
    if (!organizationId) {
      console.error('Usage: tsx scripts/debug-wise-invoice-api.ts --org <organizationId>');
      process.exit(1);
    }
    const settings = await prisma.merchant_settings.findFirst({
      where: { organization_id: organizationId },
      select: {
        wise_profile_id: true,
        wise_currency: true,
        wise_enabled: true,
        default_currency: true,
      },
    });
    if (!settings?.wise_enabled || !settings.wise_profile_id) {
      console.error('Wise is not enabled or profile ID is missing for this organization.');
      process.exit(1);
    }
    profileId = settings.wise_profile_id;
    currency = settings.wise_currency || settings.default_currency || currency;
    console.log(`Using merchant_settings: profileId=${profileId}, currency=${currency}`);
  } else {
    profileId = args[0];
    currency = args[1] || currency;
    if (!profileId) {
      console.error(
        'Usage: tsx scripts/debug-wise-invoice-api.ts <profileId> [currency]\n' +
          '   or: tsx scripts/debug-wise-invoice-api.ts --org <organizationId>'
      );
      process.exit(1);
    }
  }

  console.log('\n=== Wise invoice-create debug (getBankDetails) ===\n');
  console.log(`Profile ID: ${profileId}`);
  console.log(`Currency:   ${currency}`);
  console.log('Check server logs for WISE_API_DEBUG request/response entries.\n');

  try {
    const details = await getBankDetails(profileId, currency);
    console.log('SUCCESS — bank details count:', details.length);
    console.log(JSON.stringify(details, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('\nFAILED:', message);
    console.error(
      '\nInspect WISE_API_DEBUG logs above for responseStatus=404 on request_1 vs request_2.'
    );
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
