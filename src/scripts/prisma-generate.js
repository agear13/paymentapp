#!/usr/bin/env node
/**
 * Cross-platform Prisma client generation for install/build hooks.
 * Uses the local prisma CLI from node_modules (Render-safe).
 */
const { spawnSync } = require('child_process');
const path = require('path');

const prismaBin = path.join(
  __dirname,
  '..',
  'node_modules',
  'prisma',
  'build',
  'index.js'
);

const fs = require('fs');
if (!fs.existsSync(prismaBin)) {
  const isProductionBuild =
    process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
  const message =
    '[prisma-generate] prisma CLI not found in node_modules/prisma — run npm install.';
  if (isProductionBuild) {
    console.error(message);
    process.exit(127);
  }
  console.warn(`${message} Skipping in non-production.`);
  process.exit(0);
}

const result = spawnSync(process.execPath, [prismaBin, 'generate'], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
