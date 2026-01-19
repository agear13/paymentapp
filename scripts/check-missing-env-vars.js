#!/usr/bin/env node
/**
 * Check which environment variables are missing or invalid
 * Run this in Render Shell or locally with Render env vars
 */

console.log('\n🔍 Checking Required Environment Variables\n');
console.log('='.repeat(60));

const required = {
  // Core - MUST BE SET
  NODE_ENV: { required: true, expected: 'production' },
  NEXT_PUBLIC_APP_URL: { required: true, mustBeUrl: true },
  
  // Database - MUST BE SET
  DATABASE_URL: { required: true, minLength: 10 },
  
  // Supabase - MUST BE SET
  NEXT_PUBLIC_SUPABASE_URL: { required: true, mustBeUrl: true },
  NEXT_PUBLIC_SUPABASE_ANON_KEY: { required: true, minLength: 20 },
  SUPABASE_SERVICE_ROLE_KEY: { required: true, minLength: 20 },
  
  // Stripe - MUST BE SET (LIVE MODE)
  STRIPE_SECRET_KEY: { required: true, minLength: 20, mustStartWith: 'sk_' },
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: { required: true, minLength: 20, mustStartWith: 'pk_' },
  STRIPE_WEBHOOK_SECRET: { required: true, minLength: 20, mustStartWith: 'whsec_' },
  
  // Hedera - MUST BE SET
  NEXT_PUBLIC_HEDERA_NETWORK: { required: true, oneOf: ['mainnet', 'testnet', 'previewnet'] },
  NEXT_PUBLIC_HEDERA_MIRROR_NODE_URL: { required: true, mustBeUrl: true },
  
  // Security - MUST BE SET
  ENCRYPTION_KEY: { required: true, minLength: 20 },
};

const errors = [];
const warnings = [];
const success = [];

Object.entries(required).forEach(([key, rules]) => {
  const value = process.env[key];
  
  // Check if required but missing
  if (rules.required && (!value || value.trim() === '')) {
    errors.push(`❌ ${key}: NOT SET (required)`);
    return;
  }
  
  if (!value) {
    return; // Optional and not set
  }
  
  // Check if it's a placeholder
  if (value.includes('placeholder') || value.includes('example.com')) {
    errors.push(`❌ ${key}: Still has placeholder value`);
    return;
  }
  
  // Check expected value
  if (rules.expected && value !== rules.expected) {
    warnings.push(`⚠️  ${key}: Expected "${rules.expected}", got "${value}"`);
  }
  
  // Check minimum length
  if (rules.minLength && value.length < rules.minLength) {
    errors.push(`❌ ${key}: Too short (${value.length} chars, need ${rules.minLength}+)`);
    return;
  }
  
  // Check starts with
  if (rules.mustStartWith && !value.startsWith(rules.mustStartWith)) {
    errors.push(`❌ ${key}: Should start with "${rules.mustStartWith}", got "${value.substring(0, 10)}..."`);
    return;
  }
  
  // Check one of
  if (rules.oneOf && !rules.oneOf.includes(value)) {
    errors.push(`❌ ${key}: Must be one of [${rules.oneOf.join(', ')}], got "${value}"`);
    return;
  }
  
  // Check URL
  if (rules.mustBeUrl) {
    try {
      new URL(value);
    } catch {
      errors.push(`❌ ${key}: Invalid URL format`);
      return;
    }
  }
  
  // All checks passed
  const preview = value.length > 30 ? value.substring(0, 30) + '...' : value;
  success.push(`✅ ${key}: ${preview}`);
});

console.log('\n📊 RESULTS:\n');

if (success.length > 0) {
  console.log('✅ VALID:\n');
  success.forEach(s => console.log('  ' + s));
  console.log('');
}

if (warnings.length > 0) {
  console.log('⚠️  WARNINGS:\n');
  warnings.forEach(w => console.log('  ' + w));
  console.log('');
}

if (errors.length > 0) {
  console.log('❌ ERRORS (MUST FIX):\n');
  errors.forEach(e => console.log('  ' + e));
  console.log('');
}

console.log('='.repeat(60));
console.log('');

if (errors.length === 0 && warnings.length === 0) {
  console.log('🎉 All required environment variables are set correctly!\n');
  process.exit(0);
} else {
  console.log(`❌ Found ${errors.length} error(s) and ${warnings.length} warning(s)\n`);
  console.log('Fix the errors above, then redeploy.\n');
  process.exit(1);
}

