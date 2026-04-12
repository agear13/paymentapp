/**
 * Merchant Setup Script
 * Run this to configure payment methods for your organization
 * 
 * Usage: npx tsx scripts/setup-merchant.ts
 */

import { randomUUID } from 'crypto';
import { prisma } from '../lib/server/prisma';

async function setupMerchant() {
  try {
    console.log('🔍 Checking organizations...\n');
    
    // List all organizations
    const organizations = await prisma.organizations.findMany({
      select: {
        id: true,
        name: true,
        clerk_org_id: true,
      },
    });

    if (organizations.length === 0) {
      console.log('❌ No organizations found!');
      console.log('Please create an organization first through the UI.\n');
      process.exit(1);
    }

    console.log('📋 Found organizations:');
    organizations.forEach((org, index) => {
      console.log(`  ${index + 1}. ${org.name} (ID: ${org.id})`);
    });
    console.log();

    // For each organization, check/create merchant settings
    for (const org of organizations) {
      console.log(`\n⚙️  Configuring ${org.name}...`);

      const existing = await prisma.merchant_settings.findFirst({
        where: { organization_id: org.id },
      });

      if (existing) {
        console.log('  ✓ Merchant settings already exist');
        console.log(`    - Stripe enabled: ${!!existing.stripe_account_id}`);
        console.log(`    - Hedera enabled: ${!!existing.hedera_account_id}`);

        // Update to enable test payment methods if none are set
        if (!existing.stripe_account_id && !existing.hedera_account_id) {
          console.log('  📝 Enabling test payment methods...');
          
          await prisma.merchant_settings.update({
            where: { id: existing.id },
            data: {
              stripe_account_id: 'acct_test_' + Math.random().toString(36).substring(7),
              hedera_account_id: '0.0.1234', // Test account
              updated_at: new Date(),
            },
          });
          
          console.log('  ✅ Test payment methods enabled!');
        }
      } else {
        console.log('  📝 Creating new merchant settings...');

        await prisma.merchant_settings.create({
          data: {
            id: randomUUID(),
            organization_id: org.id,
            display_name: org.name,
            default_currency: 'USD',
            stripe_account_id: 'acct_test_' + Math.random().toString(36).substring(7),
            hedera_account_id: '0.0.1234', // Test account
            wise_profile_id: null,
            wise_enabled: false,
            wise_currency: null,
            created_at: new Date(),
            updated_at: new Date(),
          } as Parameters<typeof prisma.merchant_settings.create>[0]['data'],
        });

        console.log('  ✅ Merchant settings created with test payment methods!');
        console.log('     Wise: disabled (enable in merchant settings if needed)');
      }
    }

    console.log('\n✨ Setup complete!');
    console.log('\n📌 Next steps:');
    console.log('  1. Restart your development server');
    console.log('  2. Create a new payment link');
    console.log('  3. Payment methods should now be available');
    console.log('\n⚠️  Remember: These are TEST payment methods');
    console.log('   For production, configure real Stripe and Hedera credentials');
    console.log('   in the merchant settings UI or database.\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setupMerchant();

