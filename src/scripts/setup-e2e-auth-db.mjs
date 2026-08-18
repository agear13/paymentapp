/**
 * Local-only E2E auth provisioning via Supabase Postgres (auth.users).
 * Does not write secrets to git — appends E2E_EMAIL/E2E_PASSWORD to src/.env.local.
 *
 * Requires: DATABASE_URL, DIRECT_DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, E2E_EMAIL
 */
import { config as loadEnv } from 'dotenv';
import crypto from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: resolve(process.cwd(), '..', '.env.local') });

const email = process.env.E2E_EMAIL?.trim();
if (!email) {
  console.error('Set E2E_EMAIL before running (e.g. jaynealisha77+e2ep3c@gmail.com)');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const password =
  process.env.E2E_PASSWORD?.trim() || crypto.randomBytes(18).toString('base64url');

const prisma = new PrismaClient();

function upsertEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local');
  const original = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
  const withoutE2e = original
    .split('\n')
    .filter((line) => {
      if (line.includes('# E2E Playwright')) return false;
      if (/^E2E_/.test(line)) return false;
      if (/^SUPABASE_SERVICE_ROLE_KEY=/.test(line)) return false;
      return true;
    })
    .join('\n')
    .trimEnd();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const serviceLine = serviceKey ? `SUPABASE_SERVICE_ROLE_KEY=${serviceKey}\n` : '';
  const e2eBlock = `\n# E2E Playwright (local only — do not commit)\nE2E_EMAIL=${email}\nE2E_PASSWORD=${password}\n${serviceLine}`;
  writeFileSync(envPath, `${withoutE2e}${e2eBlock}`);
}

try {
  const rows = await prisma.$queryRaw`
    SELECT id::text AS id FROM auth.users WHERE lower(email) = lower(${email}) LIMIT 1
  `;

  if (rows.length === 0) {
    console.error(
      `No auth.users row for ${email}. Create the account once via sign-up, or set SUPABASE_SERVICE_ROLE_KEY and run npm run e2e:setup-auth.`
    );
    process.exit(1);
  }

  await prisma.$executeRaw`
    UPDATE auth.users
    SET
      encrypted_password = extensions.crypt(${password}, extensions.gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      updated_at = NOW()
    WHERE lower(email) = lower(${email})
  `;

  upsertEnvLocal();

  const userId = rows[0]?.id;
  if (userId) {
    try {
      await prisma.user_auth_profiles.updateMany({
        where: { user_id: userId },
        data: {
          suspicious_login_pending: false,
          suspicious_login_reason: null,
        },
      });
    } catch {
      // Table may not exist on older dev databases — non-fatal for E2E setup.
    }

    const membership = await prisma.user_organizations.findFirst({
      where: { user_id: userId },
    });
    if (!membership) {
      await prisma.$transaction(async (tx) => {
        const organization = await tx.organizations.create({
          data: {
            name: 'E2E Agreement Intelligence',
            clerk_org_id: `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          },
        });
        await tx.user_organizations.create({
          data: {
            user_id: userId,
            organization_id: organization.id,
            role: 'OWNER',
          },
        });
        await tx.organizations.update({
          where: { id: organization.id },
          data: {
            subscription_plan: 'professional',
            subscription_status: 'active',
          },
        });
      });
      console.log('Provisioned E2E workspace organization for test user.');
    } else {
      await prisma.organizations.update({
        where: { id: membership.organization_id },
        data: {
          subscription_plan: 'professional',
          subscription_status: 'active',
        },
      });
    }
  }

  // Verify sign-in works
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or ANON key — cannot verify sign-in');
    process.exit(1);
  }
  const client = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) {
    console.error('Password set but sign-in verification failed:', signInError.message);
    process.exit(1);
  }

  console.log(`E2E account configured for ${email}`);
  console.log('Credentials saved to src/.env.local (local only).');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
