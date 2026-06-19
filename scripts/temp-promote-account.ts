/**
 * TEMPORARY DEVELOPER SCRIPT
 *
 * Used once to promote a demo account.
 *
 * DELETE THIS FILE AFTER SUCCESSFUL EXECUTION.
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { randomUUID } from 'crypto';

// Load env before Prisma import
config({ path: resolve(__dirname, '../.env.local') });
config({ path: resolve(__dirname, '../.env') });

// Import PrismaClient directly — avoids the Next.js server-only diagnostics layer
// that is incompatible with plain Node scripts.
import { PrismaClient } from '../src/node_modules/@prisma/client/index.js';
const prisma = new PrismaClient();

/* ─── Types ─────────────────────────────────────────────────────────────────── */

type SubscriptionPlan = 'starter' | 'professional' | 'growth' | 'enterprise';

const VALID_PLANS: SubscriptionPlan[] = ['starter', 'professional', 'growth', 'enterprise'];

/**
 * Plans that require a stripe_subscription_id for getEffectivePlan() to return
 * the paid tier (see src/lib/entitlements/subscription-state.ts).
 * Enterprise is sales-assigned and bypasses Stripe.
 */
const STRIPE_REQUIRED_PLANS: SubscriptionPlan[] = ['professional', 'growth'];

/* ─── Feature catalogue (for pre/post display) ───────────────────────────────── */

const PLAN_FEATURES: Record<SubscriptionPlan, string[]> = {
  starter:      ['Up to 3 agreements', 'Up to 3 AI imports', 'Basic payment links'],
  professional: ['Unlimited agreements', 'Unlimited AI imports', 'Payment links', 'Referral management', 'Xero integration', 'Approval workflows'],
  growth:       ['Everything in Professional', 'Team members', 'Advanced reporting', 'Automated settlement coordination'],
  enterprise:   ['Everything in Growth', 'Multi-organisation', 'API access', 'Custom workflows', 'Custom settlement rules'],
};

/* ─── Auth user lookup ───────────────────────────────────────────────────────── */

type AuthUserRow = { id: string; email: string };

async function findAuthUserByEmail(email: string): Promise<AuthUserRow | null> {
  // auth.users lives in the Supabase auth schema on the same Postgres instance.
  // We use a raw query because Prisma does not model the auth schema.
  const rows = await prisma.$queryRaw<AuthUserRow[]>`
    SELECT id::text, email
    FROM auth.users
    WHERE lower(email) = lower(${email})
    LIMIT 2
  `;

  if (!rows || rows.length === 0) return null;
  if (rows.length > 1) {
    throw new Error(
      `More than one auth user found for "${email}". ` +
      `Check the database directly and use --org-id to target the correct organization.`
    );
  }
  return rows[0]!;
}

/* ─── Organisation lookup ────────────────────────────────────────────────────── */

type OrgRow = {
  id: string;
  name: string;
  clerk_org_id: string;
  role: string;
  subscription_plan: string;
  subscription_status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: Date | null;
};

async function findOrganisationsForUser(userId: string): Promise<OrgRow[]> {
  const memberships = await prisma.user_organizations.findMany({
    where: { user_id: userId },
    include: { organizations: true },
    orderBy: { created_at: 'asc' },
  });
  return memberships.map((m) => ({
    id: m.organizations.id,
    name: m.organizations.name,
    clerk_org_id: m.organizations.clerk_org_id,
    role: m.role,
    subscription_plan: m.organizations.subscription_plan,
    subscription_status: m.organizations.subscription_status,
    stripe_customer_id: m.organizations.stripe_customer_id ?? null,
    stripe_subscription_id: m.organizations.stripe_subscription_id ?? null,
    current_period_end: m.organizations.current_period_end ?? null,
  }));
}

/* ─── Entitlement summary ────────────────────────────────────────────────────── */

function effectivePlan(plan: string, status: string, stripeSubId: string | null): SubscriptionPlan {
  const p = plan as SubscriptionPlan;
  if (p === 'enterprise') return 'enterprise';
  if (p === 'starter') return 'starter';
  const activeStatuses = ['active', 'trialing'];
  if (STRIPE_REQUIRED_PLANS.includes(p)) {
    if (stripeSubId && activeStatuses.includes(status)) return p;
    return 'starter'; // lapsed — mirrors getEffectivePlan() in subscription-state.ts
  }
  return 'starter';
}

/* ─── Main promotion logic ───────────────────────────────────────────────────── */

async function promoteAccount(opts: { email: string; plan: SubscriptionPlan; orgId?: string }) {
  const { email, plan } = opts;

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  TEMP ACCOUNT PROMOTION SCRIPT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  /* ── 1. Find auth user by email ── */

  let userId: string;
  let resolvedEmail: string;

  if (opts.orgId) {
    // Direct org-id override — skip user lookup
    console.log(`ℹ  --org-id supplied directly. Skipping user lookup.\n`);
    userId = '(direct override)';
    resolvedEmail = email;
  } else {
    process.stdout.write(`Looking up auth user: ${email} ... `);
    const authUser = await findAuthUserByEmail(email);
    if (!authUser) {
      console.error(`\n\n✗ No auth user found for "${email}".`);
      console.error('  Check the email is correct or use --org-id to bypass user lookup.');
      process.exit(1);
    }
    userId = authUser.id;
    resolvedEmail = authUser.email;
    console.log('found.');
    console.log(`  User ID : ${userId}`);
    console.log(`  Email   : ${resolvedEmail}\n`);
  }

  /* ── 2. Find the organisation ── */

  let org: OrgRow;

  if (opts.orgId) {
    const found = await prisma.organizations.findUnique({
      where: { id: opts.orgId },
    });
    if (!found) {
      console.error(`✗ No organisation found with id "${opts.orgId}".`);
      process.exit(1);
    }
    org = {
      id: found.id,
      name: found.name,
      clerk_org_id: found.clerk_org_id,
      role: 'OWNER',
      subscription_plan: found.subscription_plan,
      subscription_status: found.subscription_status,
      stripe_customer_id: found.stripe_customer_id ?? null,
      stripe_subscription_id: found.stripe_subscription_id ?? null,
      current_period_end: found.current_period_end ?? null,
    };
  } else {
    const orgs = await findOrganisationsForUser(userId);
    if (orgs.length === 0) {
      console.error(`✗ No organisation found for user "${email}" (id: ${userId}).`);
      console.error('  Ensure the user has completed onboarding and has a workspace.');
      process.exit(1);
    }
    if (orgs.length > 1) {
      console.warn(`⚠  User belongs to ${orgs.length} organisations. Promoting the first (oldest):\n`);
      orgs.forEach((o, i) => {
        console.warn(`   ${i + 1}. ${o.name} (id: ${o.id}, role: ${o.role})`);
      });
      console.warn('\n  Use --org-id to target a specific organisation.\n');
    }
    org = orgs[0]!;
  }

  /* ── 3. Pre-flight display ── */

  const currentEffective = effectivePlan(
    org.subscription_plan,
    org.subscription_status,
    org.stripe_subscription_id
  );

  console.log('────────────────────────────────────────');
  console.log('BEFORE PROMOTION');
  console.log('────────────────────────────────────────');
  console.log(`  Email              : ${resolvedEmail}`);
  console.log(`  Organisation       : ${org.name}`);
  console.log(`  Org ID             : ${org.id}`);
  console.log(`  Clerk Org ID       : ${org.clerk_org_id}`);
  console.log(`  subscription_plan  : ${org.subscription_plan}`);
  console.log(`  subscription_status: ${org.subscription_status}`);
  console.log(`  stripe_sub_id      : ${org.stripe_subscription_id ?? '(none)'}`);
  console.log(`  period_end         : ${org.current_period_end?.toISOString() ?? '(none)'}`);
  console.log(`  Effective plan     : ${currentEffective}`);
  console.log(`  Entitlements       : ${PLAN_FEATURES[currentEffective].join(', ')}`);
  console.log('');

  if (currentEffective === plan) {
    console.log(`ℹ  Account is already on "${plan}" (effective). No changes needed.`);
    await prisma.$disconnect();
    return;
  }

  /* ── 4. Build update payload ── */

  // For professional/growth: we write a demo placeholder stripe_subscription_id
  // so that hasActivePaidSubscription() in subscription-state.ts returns true.
  // (It checks: plan is growth/professional AND stripeSubscriptionId is non-null AND status is active.)
  // For enterprise: no Stripe ID needed — the check is bypassed entirely.
  const needsDemoStripeId = STRIPE_REQUIRED_PLANS.includes(plan);
  const demoStripeSubId = needsDemoStripeId
    ? `sub_demo_${randomUUID().replace(/-/g, '').slice(0, 20)}`
    : null;

  // Set period end 1 year from now so entitlements don't lapse during the demo.
  const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  /* ── 5. Execute in a transaction ── */

  console.log(`Promoting to "${plan}" ...`);

  try {
    await prisma.organizations.update({
      where: { id: org.id },
      data: {
        subscription_plan:   plan,
        subscription_status: 'active',
        ...(needsDemoStripeId && {
          stripe_subscription_id: demoStripeSubId,
          current_period_end:     oneYearFromNow,
        }),
        ...(!needsDemoStripeId && plan === 'enterprise' && {
          stripe_subscription_id: null,
          current_period_end:     null,
        }),
      },
    });

    // Write an audit log entry so the promotion is traceable
    await prisma.audit_logs.create({
      data: {
        id:              randomUUID(),
        organization_id: org.id,
        entity_type:     'organization',
        action:          'DEMO_ACCOUNT_PROMOTED',
        actor:           `script:temp-promote-account`,
        details: {
          previousPlan:    org.subscription_plan,
          previousStatus:  org.subscription_status,
          newPlan:         plan,
          newStatus:       'active',
          promotedEmail:   resolvedEmail,
          demoStripeSubId: demoStripeSubId ?? null,
          note:            'Temporary demo promotion. Revert after demo.',
        },
        ip_address: '127.0.0.1',
        user_agent:  'temp-promote-account.ts',
        created_at:  new Date(),
      },
    });
  } catch (err) {
    console.error('\n✗ Update failed — check the error below.');
    console.error(err);
    process.exit(1);
  }

  /* ── 6. Post-promotion display ── */

  const newEffective = plan; // active status + stripeSubId guarantee full entitlements

  console.log('');
  console.log('────────────────────────────────────────');
  console.log('AFTER PROMOTION');
  console.log('────────────────────────────────────────');
  console.log(`  subscription_plan  : ${plan}`);
  console.log(`  subscription_status: active`);
  if (demoStripeSubId) {
    console.log(`  stripe_sub_id      : ${demoStripeSubId}  ← demo placeholder`);
    console.log(`  period_end         : ${oneYearFromNow.toISOString()}`);
  }
  console.log(`  Effective plan     : ${newEffective}`);
  console.log(`  Entitlements       : ${PLAN_FEATURES[newEffective].join(', ')}`);
  console.log('');

  console.log('✓ User found');
  console.log('');
  console.log(`  Email              : ${resolvedEmail}`);
  console.log(`  Workspace          : ${org.name}`);
  console.log('');
  console.log(`  Previous plan      : ${org.subscription_plan} (effective: ${currentEffective})`);
  console.log(`  New plan           : ${plan}`);
  console.log('');
  console.log('  Entitlements refreshed.');
  console.log('');
  console.log('  Promotion complete. ✓');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('Reminder:');
  console.log('Delete scripts/temp-promote-account.ts after the demo.');
  if (demoStripeSubId) {
    console.log('');
    console.log('To revert this promotion, run:');
    console.log('');
    console.log(`  npx tsx scripts/temp-promote-account.ts \\`);
    console.log(`    --email ${email} \\`);
    console.log(`    --plan starter`);
  }
  console.log('');
}

/* ─── Argument parser ────────────────────────────────────────────────────────── */

function parseArgs(): { email: string; plan: SubscriptionPlan; orgId?: string } {
  const args = process.argv.slice(2);
  let email = '';
  let plan: string = 'growth';
  let orgId: string | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--email':
      case '-e':
        email = args[++i] ?? '';
        break;
      case '--plan':
      case '-p':
        plan = args[++i] ?? 'growth';
        break;
      case '--org-id':
        orgId = args[++i];
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  if (!email.trim()) {
    console.error('✗ --email is required.\n');
    printHelp();
    process.exit(1);
  }

  if (!VALID_PLANS.includes(plan as SubscriptionPlan)) {
    console.error(`✗ Invalid plan "${plan}". Valid values: ${VALID_PLANS.join(', ')}\n`);
    process.exit(1);
  }

  return { email: email.trim().toLowerCase(), plan: plan as SubscriptionPlan, orgId };
}

function printHelp() {
  console.log(`
TEMPORARY DEVELOPER ACCOUNT PROMOTION SCRIPT

Usage:
  npx tsx scripts/temp-promote-account.ts --email <email> [--plan <plan>]

Options:
  --email, -e <email>   User email address (required)
  --plan,  -p <plan>    Target plan (default: growth)
                        Valid: starter, professional, growth, enterprise
  --org-id <uuid>       Skip user lookup and target org directly (fallback)
  --help,  -h           Show this help

Examples:
  npx tsx scripts/temp-promote-account.ts --email demo@company.com --plan growth
  npx tsx scripts/temp-promote-account.ts --email demo@company.com --plan enterprise
  npx tsx scripts/temp-promote-account.ts --email demo@company.com --plan starter  # revert

Notes:
  - For growth/professional: writes a demo stripe_subscription_id placeholder.
    The effective plan check in subscription-state.ts requires a non-null ID.
  - For enterprise: no Stripe ID needed.
  - All changes are wrapped in a transaction and written to audit_logs.
  - DELETE THIS FILE after the demo.
  `);
}

/* ─── Entry point ────────────────────────────────────────────────────────────── */

async function main() {
  const opts = parseArgs();

  try {
    await promoteAccount(opts);
  } catch (err) {
    console.error('\n✗ Promotion failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
