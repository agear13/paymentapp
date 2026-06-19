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

// Load env before any Prisma imports
config({ path: resolve(__dirname, '../.env.local') });
config({ path: resolve(__dirname, '../.env') });

import { prisma } from '../src/lib/server/prisma';

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
  return prisma.$queryRaw<OrgRow[]>`
    SELECT
      o.id,
      o.name,
      o.clerk_org_id,
      uo.role,
      o.subscription_plan,
      o.subscription_status,
      o.stripe_customer_id,
      o.stripe_subscription_id,
      o.current_period_end
    FROM organizations o
    INNER JOIN user_organizations uo ON uo.organization_id = o.id
    WHERE uo.user_id = ${userId}
    ORDER BY uo.created_at ASC
  `;
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
    const found = await prisma.$queryRaw<OrgRow[]>`
      SELECT
        id, name, clerk_org_id,
        'OWNER' as role,
        subscription_plan, subscription_status,
        stripe_customer_id, stripe_subscription_id, current_period_end
      FROM organizations
      WHERE id = ${opts.orgId}::uuid
      LIMIT 1
    `;
    if (!found || found.length === 0) {
      console.error(`✗ No organisation found with id "${opts.orgId}".`);
      process.exit(1);
    }
    org = found[0]!;
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
    await prisma.$transaction(async (tx) => {
      await tx.organizations.update({
        where: { id: org.id },
        data: {
          subscription_plan:   plan,
          subscription_status: 'active',
          ...(needsDemoStripeId && {
            stripe_subscription_id: demoStripeSubId,
            current_period_end:     oneYearFromNow,
          }),
          ...(!needsDemoStripeId && plan === 'enterprise' && {
            // Clear any stale Stripe subscription for enterprise
            stripe_subscription_id: null,
            current_period_end:     null,
          }),
        },
      });

      // Write an audit log entry so the promotion is traceable
      await tx.audit_logs.create({
        data: {
          id:              randomUUID(),
          organization_id: org.id,
          action:          'DEMO_ACCOUNT_PROMOTED',
          actor:           `script:temp-promote-account`,
          details: {
            previousPlan:   org.subscription_plan,
            previousStatus: org.subscription_status,
            newPlan:        plan,
            newStatus:      'active',
            promotedEmail:  resolvedEmail,
            demoStripeSubId: demoStripeSubId ?? null,
            note:           'Temporary demo promotion. Revert after demo.',
          },
          ip_address: '127.0.0.1',
          user_agent:  'temp-promote-account.ts',
          created_at:  new Date(),
        },
      });
    });
  } catch (err) {
    console.error('\n✗ Transaction failed — no changes were applied.');
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
