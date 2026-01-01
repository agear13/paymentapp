/**
 * Database Seeding Script for Development
 * Populates the database with sample data for testing
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(__dirname, '../../.env.local') });

import { logger } from '@/lib/logger';
import { prisma } from '../prisma';

// ============================================================================
// SEED DATA
// ============================================================================

const SEED_DATA = {
  organizations: [
    {
      clerkOrgId: 'org_dev_001',
      name: 'Acme Corporation',
    },
    {
      clerkOrgId: 'org_dev_002',
      name: 'TechStart Ventures',
    },
  ],
  
  defaultLedgerAccounts: [
    {
      code: '1200',
      name: 'Accounts Receivable',
      accountType: 'ASSET' as const,
    },
    {
      code: '1050',
      name: 'Stripe Clearing Account',
      accountType: 'ASSET' as const,
    },
    {
      code: '1051',
      name: 'Crypto Clearing Account (HBAR/USDC)',
      accountType: 'ASSET' as const,
    },
    {
      code: '6100',
      name: 'Payment Processor Fees',
      accountType: 'EXPENSE' as const,
    },
    {
      code: '4000',
      name: 'Revenue',
      accountType: 'REVENUE' as const,
    },
  ],
};

// ============================================================================
// SEED FUNCTIONS
// ============================================================================

const seedOrganizations = async () => {
  logger.info('Seeding organizations...');
  
  const organizations = [];
  
  for (const org of SEED_DATA.organizations) {
    const created = await prisma.organizations.upsert({
      where: { clerk_org_id: org.clerkOrgId },
      update: {},
      create: {
        clerk_org_id: org.clerkOrgId,
        name: org.name,
      },
    });
    
    organizations.push(created);
    logger.info(`Created organization: ${created.name} (${created.id})`);
  }
  
  return organizations;
};

const seedMerchantSettings = async (organizations: any[]) => {
  logger.info('Seeding merchant settings...');
  
  const merchantSettings = [];
  
  for (const org of organizations) {
    // Check if merchant settings already exist
    const existing = await prisma.merchant_settings.findFirst({
      where: { organization_id: org.id },
    });
    
    if (existing) {
      merchantSettings.push(existing);
      logger.info(`Merchant settings already exist for: ${org.name}`);
      continue;
    }
    
    const settings = await prisma.merchant_settings.create({
      data: {
        organization_id: org.id,
        display_name: `${org.name} - Merchant`,
        default_currency: 'AUD',
        stripe_account_id: `acct_test_${org.clerk_org_id}`,
        hedera_account_id: org.clerk_org_id === 'org_dev_001' ? '0.0.12345' : '0.0.67890',
      },
    });
    
    merchantSettings.push(settings);
    logger.info(`Created merchant settings for: ${org.name}`);
  }
  
  return merchantSettings;
};

const seedLedgerAccounts = async (organizations: any[]) => {
  logger.info('Seeding ledger accounts...');
  
  const ledgerAccounts = [];
  
  for (const org of organizations) {
    for (const account of SEED_DATA.defaultLedgerAccounts) {
      const created = await prisma.ledger_accounts.upsert({
        where: {
          organization_id_code: {
            organization_id: org.id,
            code: account.code,
          },
        },
        update: {},
        create: {
          organization_id: org.id,
          code: account.code,
          name: account.name,
          account_type: account.accountType,
        },
      });
      
      ledgerAccounts.push(created);
    }
    
    logger.info(`Created ${SEED_DATA.defaultLedgerAccounts.length} ledger accounts for: ${org.name}`);
  }
  
  return ledgerAccounts;
};

const seedPaymentLinks = async (organizations: any[]) => {
  logger.info('Seeding payment links...');
  
  const paymentLinks = [];
  
  // Create sample payment links for first organization
  const org = organizations[0];
  
  const sampleLinks = [
    {
      shortCode: 'ACME0001',
      status: 'DRAFT' as const,
      amount: 150.00,
      currency: 'AUD',
      description: 'Website Design Services',
      invoiceReference: 'INV-2024-001',
      customerEmail: 'client@example.com',
    },
    {
      shortCode: 'ACME0002',
      status: 'OPEN' as const,
      amount: 500.00,
      currency: 'USD',
      description: 'Monthly Subscription Fee',
      invoiceReference: 'INV-2024-002',
      customerEmail: 'subscriber@example.com',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    },
    {
      shortCode: 'ACME0003',
      status: 'PAID' as const,
      amount: 1250.00,
      currency: 'AUD',
      description: 'Consulting Services - Q4 2024',
      invoiceReference: 'INV-2024-003',
      customerEmail: 'enterprise@example.com',
    },
    {
      shortCode: 'ACME0004',
      status: 'EXPIRED' as const,
      amount: 75.00,
      currency: 'AUD',
      description: 'Product Purchase',
      invoiceReference: 'INV-2024-004',
      expiresAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    },
  ];
  
  for (const link of sampleLinks) {
    const created = await prisma.payment_links.upsert({
      where: { short_code: link.shortCode },
      update: {},
      create: {
        organization_id: org.id,
        short_code: link.shortCode,
        status: link.status,
        amount: link.amount,
        currency: link.currency,
        description: link.description,
        invoice_reference: link.invoiceReference,
        customer_email: link.customerEmail,
        customer_phone: link.customerPhone || null,
        expires_at: link.expiresAt || null,
        updated_at: new Date(),
      },
    });
    
    paymentLinks.push(created);
  }
  
  logger.info(`Created ${sampleLinks.length} payment links for: ${org.name}`);
  
  return paymentLinks;
};

const seedPaymentEvents = async (paymentLinks: any[]) => {
  logger.info('Seeding payment events...');
  
  const paymentEvents = [];
  
  // Create events for the PAID payment link
  const paidLink = paymentLinks.find(link => link.status === 'PAID');
  
  if (paidLink) {
    const events = [
      {
        payment_link_id: paidLink.id,
        event_type: 'CREATED' as const,
      },
      {
        payment_link_id: paidLink.id,
        event_type: 'OPENED' as const,
      },
      {
        payment_link_id: paidLink.id,
        event_type: 'PAYMENT_INITIATED' as const,
        payment_method: 'STRIPE' as const,
      },
      {
        payment_link_id: paidLink.id,
        event_type: 'PAYMENT_CONFIRMED' as const,
        payment_method: 'STRIPE' as const,
        stripe_payment_intent_id: 'pi_test_1234567890',
        amount_received: 1250.00,
        currency_received: 'AUD',
      },
    ];
    
    for (const event of events) {
      const created = await prisma.payment_events.create({
        data: event,
      });
      
      paymentEvents.push(created);
    }
    
    logger.info(`Created ${events.length} payment events for paid link`);
  }
  
  return paymentEvents;
};

const seedFxSnapshots = async (paymentLinks: any[]) => {
  logger.info('Seeding FX snapshots...');
  
  const fxSnapshots = [];
  
  // Create FX snapshots for payment links that have foreign currency
  for (const link of paymentLinks) {
    if (link.status === 'PAID' || link.status === 'OPEN') {
      // Creation snapshot
      const creationSnapshot = await prisma.fx_snapshots.create({
        data: {
          payment_link_id: link.id,
          snapshot_type: 'CREATION',
          token_type: 'HBAR',
          base_currency: 'USD',
          quote_currency: link.currency,
          rate: link.currency === 'USD' ? 1.0 : 1.52, // Example USD to currency rates
          provider: 'coingecko',
        },
      });
      
      fxSnapshots.push(creationSnapshot);
      
      // Settlement snapshot for paid links
      if (link.status === 'PAID') {
        const settlementSnapshot = await prisma.fx_snapshots.create({
          data: {
            payment_link_id: link.id,
            snapshot_type: 'SETTLEMENT',
            token_type: 'HBAR',
            base_currency: 'USD',
            quote_currency: link.currency,
            rate: link.currency === 'USD' ? 1.0 : 1.53, // Slightly different settlement rate
            provider: 'coingecko',
          },
        });
        
        fxSnapshots.push(settlementSnapshot);
      }
    }
  }
  
  logger.info(`Created ${fxSnapshots.length} FX snapshots`);
  
  return fxSnapshots;
};

const seedAuditLogs = async (organizations: any[], paymentLinks: any[]) => {
  logger.info('Seeding audit logs...');
  
  const auditLogs = [];
  
  // Create sample audit logs
  for (const link of paymentLinks.slice(0, 2)) {
    const log = await prisma.audit_logs.create({
      data: {
        organization_id: link.organization_id,
        user_id: 'user_dev_001',
        entity_type: 'PaymentLink',
        entity_id: link.id,
        action: 'CREATE',
        new_values: {
          status: link.status,
          amount: link.amount.toString(),
          currency: link.currency,
        },
        ip_address: '127.0.0.1',
        user_agent: 'Mozilla/5.0 (Development Seed)',
      },
    });
    
    auditLogs.push(log);
  }
  
  logger.info(`Created ${auditLogs.length} audit logs`);
  
  return auditLogs;
};

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

const main = async () => {
  try {
    logger.info('Starting database seeding...');
    
    // Seed in order (respecting foreign key constraints)
    const organizations = await seedOrganizations();
    const merchantSettings = await seedMerchantSettings(organizations);
    const ledgerAccounts = await seedLedgerAccounts(organizations);
    const paymentLinks = await seedPaymentLinks(organizations);
    const paymentEvents = await seedPaymentEvents(paymentLinks);
    const fxSnapshots = await seedFxSnapshots(paymentLinks);
    const auditLogs = await seedAuditLogs(organizations, paymentLinks);
    
    logger.info('Database seeding completed successfully!');
    logger.info('Summary:', {
      organizations: organizations.length,
      merchantSettings: merchantSettings.length,
      ledgerAccounts: ledgerAccounts.length,
      paymentLinks: paymentLinks.length,
      paymentEvents: paymentEvents.length,
      fxSnapshots: fxSnapshots.length,
      auditLogs: auditLogs.length,
    });
  } catch (error) {
    logger.error('Database seeding failed', { error });
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

// ============================================================================
// EXECUTE SEEDING
// ============================================================================

if (require.main === module) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export default main;




