#!/usr/bin/env node
/**
 * Validate Render Environment Variables
 * 
 * This script helps you verify all required environment variables
 * are set correctly before deploying to Render.
 * 
 * Usage:
 *   node scripts/validate-render-env.js
 * 
 * Or check specific variables:
 *   node scripts/validate-render-env.js SUPABASE_SERVICE_ROLE_KEY STRIPE_SECRET_KEY
 */

const requiredVars = [
  'NEXT_PUBLIC_APP_URL',
  'DATABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_HEDERA_NETWORK',
  'NEXT_PUBLIC_HEDERA_MIRROR_NODE_URL',
  'ENCRYPTION_KEY',
];

const productionJobVars = [
  'CRON_SECRET',
  'STORAGE_PROVIDER',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL',
];

const recommendedProductionVars = [
  'ADMIN_EMAIL_ALLOWLIST',
];

const optionalVars = [
  'CRON_BASE_URL',
  'ADMIN_EMAILS',
  'ALLOW_STRIPE_TEST_KEYS',
  'DIRECT_URL',
  'SESSION_SECRET',
  'NEXT_PUBLIC_HEDERA_USDC_TOKEN_ID',
  'NEXT_PUBLIC_HEDERA_USDT_TOKEN_ID',
  'NEXT_PUBLIC_HEDERA_AUDD_TOKEN_ID',
  'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID',
  'XERO_CLIENT_ID',
  'XERO_CLIENT_SECRET',
  'XERO_REDIRECT_URI',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'RESEND_API_KEY',
  'ENABLE_HEDERA_PAYMENTS',
  'ENABLE_HEDERA_STABLECOINS',
  'ENABLE_XERO_SYNC',
  'ENABLE_BETA_OPS',
  'ADMIN_EMAIL_ALLOWLIST',
  'SENTRY_DSN',
];

function validateUrl(url, varName) {
  try {
    new URL(url);
    return { valid: true };
  } catch {
    return { valid: false, error: `${varName} must be a valid URL` };
  }
}

function validateHederaAccountId(id, varName) {
  if (!/^0\.0\.\d+$/.test(id)) {
    return { valid: false, error: `${varName} must be in format "0.0.x"` };
  }
  return { valid: true };
}

function validateLength(value, minLength, varName) {
  if (value.length < minLength) {
    return { valid: false, error: `${varName} must be at least ${minLength} characters` };
  }
  return { valid: true };
}

function validateVariable(varName, value) {
  if (!value) {
    return { valid: false, error: `${varName} is not set` };
  }

  // Specific validations
  if (varName.includes('URL') && !varName.includes('DATABASE_URL')) {
    return validateUrl(value, varName);
  }

  if (varName === 'NEXT_PUBLIC_HEDERA_NETWORK') {
    if (!['mainnet', 'testnet', 'previewnet'].includes(value)) {
      return { valid: false, error: 'Must be "mainnet", "testnet", or "previewnet"' };
    }
  }

  if (varName === 'ENCRYPTION_KEY') {
    return validateLength(value, 32, varName);
  }

  if (varName.includes('STRIPE_SECRET_KEY')) {
    if (!value.startsWith('sk_')) {
      return { valid: false, error: 'Must start with "sk_"' };
    }
  }

  if (varName.includes('STRIPE_PUBLISHABLE_KEY')) {
    if (!value.startsWith('pk_')) {
      return { valid: false, error: 'Must start with "pk_"' };
    }
  }

  if (varName === 'STRIPE_WEBHOOK_SECRET') {
    if (value.toLowerCase() === 'disabled') {
      return { valid: false, error: 'Must not be "disabled" in production (B5 C1)' };
    }
    if (!value.startsWith('whsec_')) {
      return { valid: false, error: 'Must start with "whsec_"' };
    }
  }

  if (varName === 'CRON_SECRET') {
    if (value.length < 16) {
      return { valid: false, error: 'Must be at least 16 characters (B5 C3)' };
    }
  }

  return { valid: true };
}

function validateProductionStripeKeys() {
  if (process.env.ALLOW_STRIPE_TEST_KEYS === 'true') {
    return { valid: true };
  }
  const sk = process.env.STRIPE_SECRET_KEY;
  const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (sk && sk.startsWith('sk_test_')) {
    return { valid: false, error: 'STRIPE_SECRET_KEY must be sk_live_ in production (B5 C5) or set ALLOW_STRIPE_TEST_KEYS=true' };
  }
  if (pk && pk.startsWith('pk_test_')) {
    return { valid: false, error: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must be pk_live_ in production (B5 C5) or set ALLOW_STRIPE_TEST_KEYS=true' };
  }
  return { valid: true };
}

function main() {
  console.log('🔍 Validating Render Environment Variables...\n');

  const specificVars = process.argv.slice(2);
  const varsToCheck = specificVars.length > 0 ? specificVars : requiredVars;

  let hasErrors = false;
  let missingCount = 0;
  let validCount = 0;

  console.log('📋 REQUIRED VARIABLES:\n');

  varsToCheck.forEach(varName => {
    const value = process.env[varName];
    const validation = validateVariable(varName, value);

    if (!validation.valid) {
      console.log(`❌ ${varName}`);
      console.log(`   ${validation.error}\n`);
      hasErrors = true;
      missingCount++;
    } else {
      const maskedValue = value.length > 20 
        ? `${value.substring(0, 10)}...${value.substring(value.length - 5)}`
        : value;
      console.log(`✅ ${varName}`);
      console.log(`   ${maskedValue}\n`);
      validCount++;
    }
  });

  console.log('\n📋 BACKGROUND JOBS (B3 — required in production):\n');

  productionJobVars.forEach((varName) => {
    const value = process.env[varName];
    const validation = validateVariable(varName, value);
    if (!validation.valid) {
      console.log(`❌ ${varName}`);
      console.log(`   ${validation.error}\n`);
      hasErrors = true;
      missingCount++;
    } else {
      const maskedValue =
        value.length > 20
          ? `${value.substring(0, 6)}...${value.substring(value.length - 4)}`
          : '***';
      console.log(`✅ ${varName}`);
      console.log(`   ${maskedValue}\n`);
      validCount++;
    }
  });

  if (process.env.NODE_ENV === 'production') {
    console.log('\n📋 PRODUCTION HARDENING (B5):\n');
    const stripeProd = validateProductionStripeKeys();
    if (!stripeProd.valid) {
      console.log(`❌ Stripe live keys`);
      console.log(`   ${stripeProd.error}\n`);
      hasErrors = true;
      missingCount++;
    } else {
      console.log(`✅ Stripe live keys (or ALLOW_STRIPE_TEST_KEYS override)\n`);
      validCount++;
    }
  }

  console.log('\n📋 RECOMMENDED (production admin — B5 C4):\n');
  recommendedProductionVars.forEach((varName) => {
    const value = process.env[varName];
    if (value?.trim()) {
      console.log(`✅ ${varName} (configured)`);
    } else {
      console.log(`⚠️  ${varName} (not set — admin routes may deny access)`);
    }
  });

  console.log('\n📋 OPTIONAL VARIABLES:\n');

  optionalVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      const validation = validateVariable(varName, value);
      if (validation.valid) {
        console.log(`✅ ${varName} (optional, configured)`);
      } else {
        console.log(`⚠️  ${varName} (optional, but invalid: ${validation.error})`);
        hasErrors = true;
      }
    } else {
      console.log(`➖ ${varName} (optional, not set)`);
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Valid: ${validCount}`);
  console.log(`   ❌ Missing/Invalid: ${missingCount}`);

  if (hasErrors) {
    console.log('\n❌ Validation failed. Please fix the above issues before deploying.\n');
    console.log('💡 Tips:');
    console.log('   - Copy missing variables from your local .env file');
    console.log('   - Generate encryption keys: openssl rand -base64 32');
    console.log('   - Check RENDER_DEPLOYMENT_URGENT_FIX.md for complete guide\n');
    process.exit(1);
  } else {
    console.log('\n✅ All required environment variables are valid!\n');
    process.exit(0);
  }
}

main();

