/**
 * Beta User Setup Script
 * 
 * This script helps set up a beta testing environment for a user by:
 * 1. Creating an organization for the beta tester
 * 2. Setting up merchant settings with test payment providers
 * 3. Seeding ledger accounts
 * 4. Creating sample payment links (optional)
 * 
 * Usage:
 *   npx tsx scripts/setup-beta-user.ts --email beta@example.com --name "Beta Tester"
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { randomUUID } from 'crypto';

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') });

import { prisma } from '../src/lib/server/prisma';
import { seedLedgerAccounts } from '../src/prisma/seeds/ledger-accounts';

interface BetaUserConfig {
  email: string;
  name: string;
  organizationName?: string;
  hederaAccountId?: string;
  createSampleLinks?: boolean;
}

async function setupBetaUser(config: BetaUserConfig) {
  console.log('\n🚀 Setting up beta testing environment...\n');
  console.log('Configuration:', {
    email: config.email,
    name: config.name,
    organizationName: config.organizationName || `${config.name} Beta Test`,
  });

  try {
    // Step 1: Check if organization already exists
    const orgName = config.organizationName || `${config.name} Beta Test`;
    const clerkOrgId = `beta_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    console.log('\n📋 Step 1: Creating organization...');
    
    let organization = await prisma.organizations.findFirst({
      where: { name: orgName },
    });

    if (organization) {
      console.log(`  ⚠️  Organization "${orgName}" already exists`);
      console.log(`  Using existing organization ID: ${organization.id}`);
    } else {
      organization = await prisma.organizations.create({
        data: {
          clerk_org_id: clerkOrgId,
          name: orgName,
        },
      });
      console.log(`  ✅ Created organization: ${organization.name}`);
      console.log(`     ID: ${organization.id}`);
    }

    // Step 2: Create or update merchant settings
    console.log('\n⚙️  Step 2: Setting up merchant settings...');
    
    let merchantSettings = await prisma.merchant_settings.findFirst({
      where: { organization_id: organization.id },
    });

    const merchantData = {
      display_name: `${config.name} Testing`,
      default_currency: 'USD',
      stripe_account_id: `acct_test_beta_${Math.random().toString(36).substring(7)}`,
      hedera_account_id: config.hederaAccountId || null,
      updated_at: new Date(),
    };

    if (merchantSettings) {
      console.log('  ℹ️  Merchant settings already exist, updating...');
      merchantSettings = await prisma.merchant_settings.update({
        where: { id: merchantSettings.id },
        data: merchantData,
      });
      console.log('  ✅ Updated merchant settings');
    } else {
      merchantSettings = await prisma.merchant_settings.create({
        data: {
          id: randomUUID(),
          organization_id: organization.id,
          ...merchantData,
          created_at: new Date(),
        },
      });
      console.log('  ✅ Created merchant settings');
    }

    console.log('     Display Name:', merchantSettings.display_name);
    console.log('     Currency:', merchantSettings.default_currency);
    console.log('     Stripe (Test):', merchantSettings.stripe_account_id);
    console.log('     Hedera:', merchantSettings.hedera_account_id || 'Not set (can be added later)');

    // Step 3: Seed ledger accounts
    console.log('\n💰 Step 3: Setting up ledger accounts...');
    
    const ledgerResult = await seedLedgerAccounts(organization.id);
    
    console.log(`  ✅ Ledger accounts ready: ${ledgerResult.created} created, ${ledgerResult.existing} already existed`);

    // Step 4: Create sample payment links (optional)
    if (config.createSampleLinks) {
      console.log('\n🔗 Step 4: Creating sample payment links...');
      
      const sampleLinks = [
        {
          short_code: `BETA${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
          amount: 10.00,
          description: 'Sample Payment Link - Stripe Test',
        },
        {
          short_code: `BETA${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
          amount: 25.00,
          description: 'Sample Payment Link - Hedera Test',
        },
      ];

      for (const link of sampleLinks) {
        const created = await prisma.payment_links.create({
          data: {
            id: randomUUID(),
            organization_id: organization.id,
            short_code: link.short_code,
            status: 'OPEN',
            amount: link.amount,
            currency: 'USD',
            description: link.description,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            created_at: new Date(),
            updated_at: new Date(),
          },
        });
        
        console.log(`  ✅ Created: ${link.description}`);
        console.log(`     URL: ${process.env.NEXT_PUBLIC_APP_URL}/pay/${created.short_code}`);
        console.log(`     Amount: $${link.amount}`);
      }
    }

    // Step 5: Create audit log entry
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        organization_id: organization.id,
        action: 'BETA_USER_SETUP',
        actor: 'system',
        details: {
          email: config.email,
          name: config.name,
          setupTimestamp: new Date().toISOString(),
        },
        ip_address: '127.0.0.1',
        user_agent: 'Beta Setup Script',
        created_at: new Date(),
      },
    });

    // Summary
    console.log('\n✨ Beta testing environment setup complete!\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📧 Beta Tester Information:');
    console.log('   Email:', config.email);
    console.log('   Name:', config.name);
    console.log('');
    console.log('🏢 Organization:');
    console.log('   Name:', organization.name);
    console.log('   ID:', organization.id);
    console.log('');
    console.log('⚙️  Merchant Settings:');
    console.log('   Display Name:', merchantSettings.display_name);
    console.log('   Currency:', merchantSettings.default_currency);
    console.log('   Stripe Account:', merchantSettings.stripe_account_id);
    console.log('   Hedera Account:', merchantSettings.hedera_account_id || 'Not set');
    console.log('');
    console.log('💰 Ledger Accounts:', ledgerResult.accounts.length, 'accounts ready');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('\n📌 Next Steps for Beta Tester:\n');
    console.log('1. Visit:', process.env.NEXT_PUBLIC_APP_URL || '[APP_URL]');
    console.log('2. Sign up with email:', config.email);
    console.log('3. During onboarding, use organization name:', organization.name);
    console.log('4. Follow the Beta Tester Quick Start Guide');
    console.log('');
    console.log('📚 Provide these documents to beta tester:');
    console.log('   - BETA_TESTER_QUICK_START.md');
    console.log('   - BETA_TESTING_SETUP_GUIDE.md (for reference)');
    console.log('');
    console.log('🔧 For Hedera testing:');
    console.log('   - Beta tester needs to install HashPack');
    console.log('   - Switch to TESTNET in HashPack');
    console.log('   - Get testnet HBAR from: https://portal.hedera.com/faucet');
    console.log('   - Add their Hedera Account ID in Settings → Merchant');
    console.log('');
    console.log('💳 For Stripe testing:');
    console.log('   - Use test card: 4242 4242 4242 4242');
    console.log('   - Any future expiry date');
    console.log('   - Any 3-digit CVC');
    console.log('');
    console.log('📊 For Xero testing:');
    console.log('   - Beta tester should use Xero Demo Company');
    console.log('   - Visit: https://developer.xero.com/');
    console.log('   - Connect via Settings → Integrations → Xero');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ Error setting up beta user:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config: Partial<BetaUserConfig> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = args[i + 1];

    switch (arg) {
      case '--email':
      case '-e':
        config.email = value;
        i++;
        break;
      case '--name':
      case '-n':
        config.name = value;
        i++;
        break;
      case '--org':
      case '-o':
        config.organizationName = value;
        i++;
        break;
      case '--hedera':
      case '-h':
        config.hederaAccountId = value;
        i++;
        break;
      case '--with-links':
      case '-l':
        config.createSampleLinks = true;
        break;
      case '--help':
        printHelp();
        process.exit(0);
    }
  }

  return config as BetaUserConfig;
}

function printHelp() {
  console.log(`
Beta User Setup Script

Usage:
  npx tsx scripts/setup-beta-user.ts [options]

Options:
  -e, --email <email>         Beta tester's email address (required)
  -n, --name <name>          Beta tester's name (required)
  -o, --org <orgName>        Custom organization name (optional)
  -h, --hedera <accountId>   Hedera testnet account ID (optional)
  -l, --with-links           Create sample payment links (optional)
  --help                     Show this help message

Examples:
  # Basic setup
  npx tsx scripts/setup-beta-user.ts --email jane@example.com --name "Jane Doe"

  # With custom organization name
  npx tsx scripts/setup-beta-user.ts -e jane@example.com -n "Jane Doe" -o "Jane's Beta Testing"

  # With Hedera account and sample links
  npx tsx scripts/setup-beta-user.ts -e jane@example.com -n "Jane Doe" -h "0.0.1234567" --with-links

Notes:
  - This script prepares the database for beta testing
  - Beta tester still needs to sign up via the application
  - All payment providers are configured in TEST/SANDBOX mode
  - Sample links are created in OPEN status (ready for payment)
  `);
}

// Main execution
if (require.main === module) {
  const config = parseArgs();

  if (!config.email || !config.name) {
    console.error('❌ Error: Email and name are required\n');
    printHelp();
    process.exit(1);
  }

  setupBetaUser(config)
    .then(() => {
      console.log('✅ Setup completed successfully!\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Setup failed:', error);
      process.exit(1);
    });
}

export { setupBetaUser, type BetaUserConfig };

