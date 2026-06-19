#!/usr/bin/env node
/**
 * Temporary helper: loads .env.local then runs prisma migrate deploy.
 * Delete after use.
 */
const { execSync } = require('child_process');
const { config } = require('dotenv');
const { resolve } = require('path');

config({ path: resolve(__dirname, '../src/.env.local') });
config({ path: resolve(__dirname, '../src/.env') });

console.log('Running prisma migrate deploy with .env.local credentials...\n');

try {
  execSync('npx prisma migrate deploy', {
    cwd: resolve(__dirname, '../src'),
    stdio: 'inherit',
    env: process.env,
  });
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exit(1);
}
