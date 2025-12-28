#!/usr/bin/env node

/**
 * Generate Secure Random Keys for Production
 * 
 * Generates cryptographically secure random keys for:
 * - SESSION_SECRET
 * - ENCRYPTION_KEY
 * 
 * Usage: node scripts/generate-keys.js
 */

const crypto = require('crypto');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function generateSecureKey(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

function main() {
  console.log('');
  log('='.repeat(80), 'cyan');
  log('  🔐 Provvypay Secure Key Generator', 'bright');
  log('='.repeat(80), 'cyan');
  console.log('');
  
  const sessionSecret = generateSecureKey(32);
  const encryptionKey = generateSecureKey(32);
  
  log('Generated secure keys for production:', 'green');
  console.log('');
  
  log('SESSION_SECRET:', 'yellow');
  log(sessionSecret, 'bright');
  console.log('');
  
  log('ENCRYPTION_KEY:', 'yellow');
  log(encryptionKey, 'bright');
  console.log('');
  
  log('='.repeat(80), 'cyan');
  log('  Add these to your .env.production file', 'bright');
  log('='.repeat(80), 'cyan');
  console.log('');
  
  log('⚠️  SECURITY NOTICE:', 'yellow');
  log('  1. Never commit these keys to version control', 'yellow');
  log('  2. Store them securely (password manager, vault)', 'yellow');
  log('  3. Rotate keys periodically', 'yellow');
  log('  4. Use different keys for staging and production', 'yellow');
  console.log('');
}

main();





