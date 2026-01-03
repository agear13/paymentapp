/**
 * Test script for merchant endpoint
 * Usage: npx tsx scripts/test-merchant-endpoint.ts [shortCode]
 */

import { prisma } from '../lib/server/prisma';

async function testMerchantEndpoint() {
  try {
    const shortCode = process.argv[2];

    console.log('🔍 Testing Merchant Endpoint');
    console.log('================================\n');

    // Step 1: Find a payment link
    if (!shortCode) {
      console.log('❌ No shortCode provided. Finding available payment links...\n');
      
      const paymentLinks = await prisma.payment_links.findMany({
        where: {
          status: 'OPEN',
        },
        select: {
          short_code: true,
          status: true,
          amount: true,
          currency: true,
          organization_id: true,
          organizations: {
            select: {
              name: true,
            },
          },
        },
        take: 5,
      });

      if (paymentLinks.length === 0) {
        console.log('⚠️  No OPEN payment links found in database.\n');
        console.log('To create test data, run:');
        console.log('  npx tsx scripts/setup-merchant.ts');
        return;
      }

      console.log('Available payment links:');
      console.log('------------------------');
      paymentLinks.forEach((link, index) => {
        console.log(`${index + 1}. Short Code: ${link.short_code}`);
        console.log(`   Status: ${link.status}`);
        console.log(`   Amount: ${link.currency} ${link.amount}`);
        console.log(`   Merchant: ${link.organizations.name}`);
        console.log('');
      });

      console.log('\n💡 To test the endpoint, run:');
      console.log(`   npx tsx scripts/test-merchant-endpoint.ts ${paymentLinks[0].short_code}`);
      console.log('\nOr test with curl:');
      console.log(`   curl http://localhost:3000/api/public/merchant/${paymentLinks[0].short_code}`);
      return;
    }

    // Step 2: Test database lookup directly
    console.log(`📋 Testing with shortCode: "${shortCode}"\n`);

    console.log('Step 1: Looking up payment link...');
    const paymentLink = await prisma.payment_links.findUnique({
      where: { short_code: shortCode },
      select: {
        id: true,
        short_code: true,
        status: true,
        organization_id: true,
        organizations: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!paymentLink) {
      console.log('❌ Payment link not found');
      console.log('   This will return 404 from the API');
      return;
    }

    console.log('✅ Payment link found:');
    console.log(`   ID: ${paymentLink.id}`);
    console.log(`   Status: ${paymentLink.status}`);
    console.log(`   Organization: ${paymentLink.organizations.name}`);
    console.log(`   Organization ID: ${paymentLink.organization_id}\n`);

    console.log('Step 2: Looking up merchant settings...');
    const merchantSettings = await prisma.merchant_settings.findFirst({
      where: { organization_id: paymentLink.organization_id },
      select: {
        id: true,
        hedera_account_id: true,
        display_name: true,
        stripe_account_id: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });

    if (!merchantSettings) {
      console.log('❌ Merchant settings not found');
      console.log('   This will return 404 from the API');
      console.log('\n💡 To fix, run:');
      console.log('   npx tsx scripts/setup-merchant.ts');
      return;
    }

    console.log('✅ Merchant settings found:');
    console.log(`   ID: ${merchantSettings.id}`);
    console.log(`   Display Name: ${merchantSettings.display_name}`);
    console.log(`   Hedera Account: ${merchantSettings.hedera_account_id || '(not set)'}`);
    console.log(`   Stripe Account: ${merchantSettings.stripe_account_id || '(not set)'}`);
    console.log(`   Created: ${merchantSettings.created_at.toISOString()}\n`);

    // Step 3: Test the API response format
    console.log('Step 3: API Response Format');
    console.log('----------------------------');
    const apiResponse = {
      data: {
        hederaAccountId: merchantSettings.hedera_account_id,
        displayName: merchantSettings.display_name,
        hasStripeAccount: !!merchantSettings.stripe_account_id,
        hasHederaAccount: !!merchantSettings.hedera_account_id,
      },
    };

    console.log(JSON.stringify(apiResponse, null, 2));

    // Step 4: Check if Hedera is enabled
    console.log('\n✅ Summary:');
    console.log('===========');
    if (merchantSettings.hedera_account_id) {
      console.log('✅ Hedera payments ENABLED');
      console.log(`   Merchant account: ${merchantSettings.hedera_account_id}`);
    } else {
      console.log('⚠️  Hedera payments DISABLED');
      console.log('   Merchant has not configured hedera_account_id');
    }

    if (merchantSettings.stripe_account_id) {
      console.log('✅ Stripe payments ENABLED');
    } else {
      console.log('⚠️  Stripe payments DISABLED');
    }

    // Step 5: Provide test command
    console.log('\n🧪 Test with curl:');
    console.log('==================');
    console.log(`curl http://localhost:3000/api/public/merchant/${shortCode}`);

    console.log('\n🌐 Test in browser:');
    console.log('===================');
    console.log(`http://localhost:3000/pay/${shortCode}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testMerchantEndpoint();
