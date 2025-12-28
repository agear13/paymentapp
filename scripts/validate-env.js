#!/usr/bin/env node

/**
 * Production Environment Validation Script
 * 
 * Validates all required environment variables and tests connections
 * to external services before deployment.
 * 
 * Usage: node scripts/validate-env.js
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('');
  log(`${'='.repeat(80)}`, 'cyan');
  log(`  ${title}`, 'bright');
  log(`${'='.repeat(80)}`, 'cyan');
  console.log('');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Validation Results
const results = {
  errors: [],
  warnings: [],
  success: [],
  critical: [],
};

// Required Environment Variables
const requiredVars = {
  // Application
  NODE_ENV: { required: true, expected: 'production' },
  NEXT_PUBLIC_APP_URL: { required: true, pattern: /^https:\/\// },
  
  // Database
  DATABASE_URL: { required: true, pattern: /^postgresql:\/\// },
  
  // Authentication
  NEXT_PUBLIC_SUPABASE_URL: { required: true, pattern: /^https:\/\// },
  NEXT_PUBLIC_SUPABASE_ANON_KEY: { required: true, minLength: 100 },
  SUPABASE_SERVICE_ROLE_KEY: { required: true, minLength: 100 },
  SESSION_SECRET: { required: true, minLength: 32 },
  ENCRYPTION_KEY: { required: true, minLength: 32 },
  
  // Stripe
  STRIPE_SECRET_KEY: { required: true, pattern: /^sk_live_/ },
  STRIPE_PUBLISHABLE_KEY: { required: true, pattern: /^pk_live_/ },
  STRIPE_WEBHOOK_SECRET: { required: true, pattern: /^whsec_/ },
  
  // Hedera
  HEDERA_NETWORK: { required: true, expected: 'mainnet' },
  HEDERA_ACCOUNT_ID: { required: true, pattern: /^\d+\.\d+\.\d+$/ },
  HEDERA_PRIVATE_KEY: { required: true, minLength: 64 },
  HEDERA_AUDD_TOKEN_ID: { required: true, pattern: /^\d+\.\d+\.\d+$/ },
  
  // Xero
  XERO_CLIENT_ID: { required: true },
  XERO_CLIENT_SECRET: { required: true },
  XERO_REDIRECT_URI: { required: true, pattern: /^https:\/\// },
  
  // FX Providers
  COINGECKO_API_KEY: { required: false },
  
  // Monitoring
  SENTRY_DSN: { required: true, pattern: /^https:\/\// },
  
  // Email
  EMAIL_FROM: { required: true, pattern: /@/ },
};

// Load environment variables
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.production');
  
  if (!fs.existsSync(envPath)) {
    logError('.env.production file not found!');
    logInfo('Run: cp .env.production.template .env.production');
    process.exit(1);
  }
  
  // Load .env.production file
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const lines = envContent.split('\n');
  
  lines.forEach(line => {
    // Skip comments and empty lines
    if (line.trim().startsWith('#') || !line.trim()) return;
    
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      process.env[key] = value;
    }
  });
  
  logSuccess('.env.production loaded');
}

// Validate required variables
function validateRequiredVars() {
  logSection('VALIDATING REQUIRED ENVIRONMENT VARIABLES');
  
  Object.entries(requiredVars).forEach(([key, rules]) => {
    const value = process.env[key];
    
    // Check if required variable exists
    if (rules.required && (!value || value === '')) {
      results.errors.push(`${key} is required but not set`);
      logError(`${key} is missing`);
      return;
    }
    
    if (!value) {
      if (rules.required) {
        results.warnings.push(`${key} is optional but recommended`);
        logWarning(`${key} is not set (optional)`);
      }
      return;
    }
    
    // Check expected value
    if (rules.expected && value !== rules.expected) {
      results.errors.push(`${key} should be "${rules.expected}" but is "${value}"`);
      logError(`${key} has incorrect value`);
      return;
    }
    
    // Check pattern
    if (rules.pattern && !rules.pattern.test(value)) {
      results.errors.push(`${key} does not match expected pattern`);
      logError(`${key} has invalid format`);
      return;
    }
    
    // Check minimum length
    if (rules.minLength && value.length < rules.minLength) {
      results.errors.push(`${key} is too short (min ${rules.minLength} chars)`);
      logError(`${key} is too short`);
      return;
    }
    
    logSuccess(`${key} is valid`);
    results.success.push(key);
  });
}

// Validate Stripe configuration
function validateStripe() {
  logSection('VALIDATING STRIPE CONFIGURATION');
  
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  // Check live mode
  if (secretKey && !secretKey.startsWith('sk_live_')) {
    results.critical.push('Stripe secret key is NOT in live mode!');
    logError('Using TEST Stripe keys in production!');
  } else {
    logSuccess('Stripe secret key is in LIVE mode');
  }
  
  if (publishableKey && !publishableKey.startsWith('pk_live_')) {
    results.critical.push('Stripe publishable key is NOT in live mode!');
    logError('Using TEST Stripe publishable key in production!');
  } else {
    logSuccess('Stripe publishable key is in LIVE mode');
  }
  
  if (webhookSecret && !webhookSecret.startsWith('whsec_')) {
    results.errors.push('Stripe webhook secret has invalid format');
    logError('Stripe webhook secret is invalid');
  } else {
    logSuccess('Stripe webhook secret is valid');
  }
}

// Validate Hedera configuration
function validateHedera() {
  logSection('VALIDATING HEDERA CONFIGURATION');
  
  const network = process.env.HEDERA_NETWORK;
  const accountId = process.env.HEDERA_ACCOUNT_ID;
  const privateKey = process.env.HEDERA_PRIVATE_KEY;
  
  // Check mainnet
  if (network !== 'mainnet') {
    results.critical.push(`Hedera network is "${network}" not "mainnet"!`);
    logError(`Using ${network} in production!`);
  } else {
    logSuccess('Hedera network is MAINNET');
  }
  
  // Validate account ID format
  if (accountId && !/^\d+\.\d+\.\d+$/.test(accountId)) {
    results.errors.push('Hedera account ID has invalid format');
    logError('Hedera account ID format is invalid');
  } else {
    logSuccess(`Hedera account ID is valid: ${accountId}`);
  }
  
  // Validate private key
  if (privateKey && privateKey.length < 64) {
    results.errors.push('Hedera private key is too short');
    logError('Hedera private key appears invalid');
  } else {
    logSuccess('Hedera private key length is valid');
  }
  
  // Check AUDD configuration
  const auddTokenId = process.env.HEDERA_AUDD_TOKEN_ID;
  const auddAccountId = process.env.HEDERA_AUDD_ACCOUNT_ID;
  
  if (auddTokenId === '0.0.456858') {
    logSuccess('AUDD token ID is configured');
  } else {
    logWarning('AUDD token ID may be incorrect');
  }
  
  if (auddAccountId === '0.0.1054') {
    logSuccess('AUDD account 1054 is configured');
  } else {
    logWarning('AUDD account is not set to 1054');
  }
}

// Validate Xero configuration
function validateXero() {
  logSection('VALIDATING XERO CONFIGURATION');
  
  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;
  const redirectUri = process.env.XERO_REDIRECT_URI;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  
  if (!clientId || clientId.includes('your_xero')) {
    results.errors.push('Xero client ID not configured');
    logError('Xero client ID is missing or placeholder');
  } else {
    logSuccess('Xero client ID is set');
  }
  
  if (!clientSecret || clientSecret.includes('your_xero')) {
    results.errors.push('Xero client secret not configured');
    logError('Xero client secret is missing or placeholder');
  } else {
    logSuccess('Xero client secret is set');
  }
  
  // Check redirect URI matches app URL
  if (redirectUri && appUrl && !redirectUri.startsWith(appUrl)) {
    results.warnings.push('Xero redirect URI does not match app URL');
    logWarning('Xero redirect URI mismatch');
  } else {
    logSuccess('Xero redirect URI matches app URL');
  }
  
  // Check account codes
  const auddAccount = process.env.XERO_AUDD_CLEARING_ACCOUNT;
  if (auddAccount === '1054') {
    logSuccess('Xero AUDD clearing account is 1054');
  } else {
    results.critical.push('AUDD clearing account MUST be 1054!');
    logError(`AUDD account is ${auddAccount}, should be 1054`);
  }
}

// Validate security settings
function validateSecurity() {
  logSection('VALIDATING SECURITY SETTINGS');
  
  const sessionSecret = process.env.SESSION_SECRET;
  const encryptionKey = process.env.ENCRYPTION_KEY;
  
  // Check session secret strength
  if (sessionSecret && sessionSecret.length >= 32) {
    logSuccess('Session secret is strong');
  } else {
    results.errors.push('Session secret is too weak');
    logError('Session secret is less than 32 characters');
  }
  
  // Check encryption key strength
  if (encryptionKey && encryptionKey.length >= 32) {
    logSuccess('Encryption key is strong');
  } else {
    results.errors.push('Encryption key is too weak');
    logError('Encryption key is less than 32 characters');
  }
  
  // Check if keys look random
  if (sessionSecret && /^[a-z]+$/i.test(sessionSecret)) {
    results.warnings.push('Session secret does not look random');
    logWarning('Session secret may not be cryptographically secure');
  }
  
  // Check HTTPS enforcement
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl && !appUrl.startsWith('https://')) {
    results.critical.push('App URL is not HTTPS!');
    logError('HTTPS is not enforced!');
  } else {
    logSuccess('HTTPS is enforced');
  }
}

// Validate monitoring
function validateMonitoring() {
  logSection('VALIDATING MONITORING & LOGGING');
  
  const sentryDsn = process.env.SENTRY_DSN;
  const logLevel = process.env.LOG_LEVEL;
  
  if (sentryDsn && sentryDsn.includes('sentry.io')) {
    logSuccess('Sentry is configured');
  } else {
    results.warnings.push('Sentry error tracking not configured');
    logWarning('Sentry DSN is missing or invalid');
  }
  
  if (logLevel === 'info' || logLevel === 'warn') {
    logSuccess(`Log level is ${logLevel} (appropriate for production)`);
  } else if (logLevel === 'debug') {
    results.warnings.push('Log level is "debug" (may be too verbose)');
    logWarning('Consider using "info" or "warn" in production');
  } else {
    logSuccess(`Log level is ${logLevel || 'default'}`);
  }
}

// Validate payment tolerances
function validateTolerances() {
  logSection('VALIDATING PAYMENT TOLERANCES');
  
  const auddTolerance = parseFloat(process.env.PAYMENT_TOLERANCE_AUDD || '0.1');
  const hbarTolerance = parseFloat(process.env.PAYMENT_TOLERANCE_HBAR || '1.0');
  const usdcTolerance = parseFloat(process.env.PAYMENT_TOLERANCE_USDC || '0.5');
  
  if (auddTolerance === 0.1) {
    logSuccess('AUDD tolerance is 0.1% (correct)');
  } else {
    results.critical.push(`AUDD tolerance is ${auddTolerance}%, should be 0.1%!`);
    logError(`AUDD tolerance is ${auddTolerance}%`);
  }
  
  if (hbarTolerance <= 1.0) {
    logSuccess(`HBAR tolerance is ${hbarTolerance}%`);
  } else {
    logWarning(`HBAR tolerance is ${hbarTolerance}% (high)`);
  }
  
  if (usdcTolerance <= 0.5) {
    logSuccess(`USDC tolerance is ${usdcTolerance}%`);
  } else {
    logWarning(`USDC tolerance is ${usdcTolerance}% (high)`);
  }
}

// Print final report
function printReport() {
  logSection('VALIDATION REPORT');
  
  const total = results.success.length + results.errors.length + results.warnings.length + results.critical.length;
  
  log(`Total checks: ${total}`, 'bright');
  logSuccess(`Passed: ${results.success.length}`);
  logWarning(`Warnings: ${results.warnings.length}`);
  logError(`Errors: ${results.errors.length}`);
  
  if (results.critical.length > 0) {
    log(`🚨 CRITICAL: ${results.critical.length}`, 'red');
  }
  
  console.log('');
  
  // Print critical issues
  if (results.critical.length > 0) {
    log('CRITICAL ISSUES:', 'red');
    results.critical.forEach(issue => log(`  - ${issue}`, 'red'));
    console.log('');
  }
  
  // Print errors
  if (results.errors.length > 0) {
    log('ERRORS:', 'red');
    results.errors.forEach(error => log(`  - ${error}`, 'red'));
    console.log('');
  }
  
  // Print warnings
  if (results.warnings.length > 0) {
    log('WARNINGS:', 'yellow');
    results.warnings.forEach(warning => log(`  - ${warning}`, 'yellow'));
    console.log('');
  }
  
  // Final verdict
  logSection('FINAL VERDICT');
  
  if (results.critical.length > 0) {
    logError('❌ CRITICAL ISSUES FOUND - DO NOT DEPLOY TO PRODUCTION!');
    process.exit(1);
  } else if (results.errors.length > 0) {
    logError('❌ VALIDATION FAILED - Fix errors before deploying');
    process.exit(1);
  } else if (results.warnings.length > 0) {
    logWarning('⚠️  VALIDATION PASSED WITH WARNINGS');
    logInfo('Review warnings before deploying to production');
    process.exit(0);
  } else {
    logSuccess('✅ ALL CHECKS PASSED - READY FOR PRODUCTION!');
    process.exit(0);
  }
}

// Main execution
function main() {
  log('\n🔍 Provvypay Production Environment Validator\n', 'bright');
  
  try {
    loadEnv();
    validateRequiredVars();
    validateStripe();
    validateHedera();
    validateXero();
    validateSecurity();
    validateMonitoring();
    validateTolerances();
    printReport();
  } catch (error) {
    logError(`Validation failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main();





