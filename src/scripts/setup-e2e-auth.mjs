/**
 * Provisions or updates the Playwright E2E test user via Supabase Admin API.
 * Reads secrets from environment / .env.local only — never writes credentials to disk.
 *
 * Usage:
 *   E2E_EMAIL=e2e-agreement-intelligence@yourdomain.test npm run e2e:setup-auth
 */
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { resolve } from 'node:path';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: resolve(process.cwd(), '..', '.env.local') });

const email = process.env.E2E_EMAIL?.trim();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!email) {
  console.error('E2E_EMAIL is required (e.g. e2e-agreement-intelligence@yourdomain.test)');
  process.exit(1);
}
if (!supabaseUrl) {
  console.error('NEXT_PUBLIC_SUPABASE_URL is required.');
  process.exit(1);
}

let password =
  process.env.E2E_PASSWORD?.trim() || crypto.randomBytes(18).toString('base64url');

if (serviceKey?.startsWith('eyJ') || serviceKey?.startsWith('sb_secret_')) {
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    const alreadyExists =
      /already|registered|exists/i.test(createError.message) || createError.status === 422;

    if (!alreadyExists) {
      console.error('Failed to create E2E user:', createError.message);
      process.exit(1);
    }

    const { data: listData, error: listError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listError) {
      console.error('Failed to list users:', listError.message);
      process.exit(1);
    }

    const existing = listData.users.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase()
    );
    if (!existing) {
      console.error('E2E user exists but could not be resolved for password update.');
      process.exit(1);
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (updateError) {
      console.error('Failed to update E2E user password:', updateError.message);
      process.exit(1);
    }
    console.log(`Updated password for existing E2E user: ${email}`);
  } else {
    console.log(`Created E2E user: ${created.user?.email ?? email}`);
  }
} else if (anonKey) {
  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signUpError } = await client.auth.signUp({ email, password });
  if (signUpError && !/already|registered|exists/i.test(signUpError.message)) {
    console.error('Anon signUp failed:', signUpError.message);
    process.exit(1);
  }
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) {
    console.error(
      'Could not sign in E2E user after signUp. Set a valid SUPABASE_SERVICE_ROLE_KEY JWT or E2E_PASSWORD manually.',
      signInError.message
    );
    process.exit(1);
  }
  console.log(`E2E user ready via anon auth: ${email}`);
} else {
  console.error(
    'Provide SUPABASE_SERVICE_ROLE_KEY (JWT) or NEXT_PUBLIC_SUPABASE_ANON_KEY to provision the E2E account.'
  );
  process.exit(1);
}

console.log('\nAdd to src/.env.local (do NOT commit):\n');
console.log(`E2E_EMAIL=${email}`);
if (!process.env.E2E_PASSWORD) {
  console.log(`E2E_PASSWORD=${password}`);
} else {
  console.log('E2E_PASSWORD=(unchanged — already set in environment)');
}
console.log('\nThen run: npm run test:e2e:p3c:headed');
