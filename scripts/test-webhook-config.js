#!/usr/bin/env node
/**
 * Stripe Webhook Configuration Checker
 * 
 * Run this script to diagnose webhook setup issues
 * 
 * Usage:
 *   node scripts/test-webhook-config.js
 */

const https = require('https');
const http = require('http');

console.log('🔍 Stripe Webhook Configuration Checker\n');
console.log('=' .repeat(60));

// Check environment variables
console.log('\n📋 Environment Variables Check:\n');

const requiredVars = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'
];

let hasIssues = false;

requiredVars.forEach(varName => {
  const value = process.env[varName];
  
  if (!value) {
    console.log(`❌ ${varName}: NOT SET`);
    hasIssues = true;
  } else if (value.toLowerCase() === 'disabled') {
    console.log(`⚠️  ${varName}: DISABLED`);
    hasIssues = true;
  } else {
    // Show first few characters for security
    const preview = value.substring(0, 10) + '...';
    console.log(`✅ ${varName}: ${preview}`);
  }
});

// Check webhook secret format
if (process.env.STRIPE_WEBHOOK_SECRET) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  
  console.log('\n🔐 Webhook Secret Validation:\n');
  
  if (secret.startsWith('whsec_')) {
    console.log('✅ Format: Valid (starts with whsec_)');
  } else {
    console.log('❌ Format: Invalid (should start with whsec_)');
    hasIssues = true;
  }
  
  if (secret.length > 30) {
    console.log('✅ Length: Valid');
  } else {
    console.log('❌ Length: Too short (suspicious)');
    hasIssues = true;
  }
  
  if (secret.trim() === secret) {
    console.log('✅ Whitespace: No extra spaces');
  } else {
    console.log('⚠️  Whitespace: Extra spaces detected');
    hasIssues = true;
  }
}

// Check Stripe API key format
if (process.env.STRIPE_SECRET_KEY) {
  const key = process.env.STRIPE_SECRET_KEY;
  
  console.log('\n🔑 Stripe API Key Validation:\n');
  
  if (key.startsWith('sk_test_')) {
    console.log('✅ Mode: TEST MODE (safe for testing)');
  } else if (key.startsWith('sk_live_')) {
    console.log('⚠️  Mode: LIVE MODE (production)');
  } else {
    console.log('❌ Format: Invalid Stripe secret key');
    hasIssues = true;
  }
}

// Check app URL
console.log('\n🌐 Application URL:\n');

if (process.env.NEXT_PUBLIC_APP_URL) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  console.log(`✅ APP_URL: ${appUrl}`);
  console.log(`📍 Expected webhook URL: ${appUrl}/api/stripe/webhook`);
  
  // Validate URL format
  try {
    new URL(appUrl);
    console.log('✅ URL format: Valid');
  } catch {
    console.log('❌ URL format: Invalid');
    hasIssues = true;
  }
} else {
  console.log('❌ NEXT_PUBLIC_APP_URL: NOT SET');
  hasIssues = true;
}

// Test webhook endpoint (if app is running)
console.log('\n🔌 Webhook Endpoint Test:\n');

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const webhookUrl = `${appUrl}/api/stripe/webhook`;

console.log(`Testing: ${webhookUrl}`);

const url = new URL(webhookUrl);
const protocol = url.protocol === 'https:' ? https : http;

const options = {
  hostname: url.hostname,
  port: url.port || (url.protocol === 'https:' ? 443 : 80),
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'stripe-signature': 'test'
  }
};

const req = protocol.request(options, (res) => {
  console.log(`\n📡 Response Status: ${res.statusCode}`);
  
  if (res.statusCode === 400 || res.statusCode === 401) {
    console.log('✅ Endpoint exists (returned error as expected without valid signature)');
  } else if (res.statusCode === 200) {
    console.log('✅ Endpoint exists and responded');
  } else {
    console.log('⚠️  Unexpected status code');
  }
  
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('Response:', json);
    } catch {
      console.log('Response:', data);
    }
    
    printSummary();
  });
});

req.on('error', (error) => {
  console.log(`❌ Cannot reach endpoint: ${error.message}`);
  console.log('   This is normal if app is not running');
  printSummary();
});

req.write(JSON.stringify({ test: true }));
req.end();

function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Summary:\n');
  
  if (!hasIssues) {
    console.log('✅ All checks passed!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Ensure webhook is created in Stripe Dashboard');
    console.log('   2. Verify webhook URL matches your deployment');
    console.log('   3. Test with a real payment');
  } else {
    console.log('❌ Issues found! Please fix the problems above.');
    console.log('\n📝 Common Fixes:');
    console.log('   • Set STRIPE_WEBHOOK_SECRET in environment');
    console.log('   • Get secret from: https://dashboard.stripe.com/webhooks');
    console.log('   • Create webhook if it doesn\'t exist');
    console.log('   • Ensure secret starts with whsec_');
  }
  
  console.log('\n📚 Full Guide: See STRIPE_WEBHOOK_DIAGNOSIS.md\n');
}

// Handle timeout
setTimeout(() => {
  req.destroy();
  console.log('\n⏱️  Request timeout');
  printSummary();
}, 5000);

