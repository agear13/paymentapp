#!/usr/bin/env node
/**
 * Non-blocking prebuild checks for Render/production deploys.
 * Warns on missing optional tooling; never exits non-zero unless a required file is missing.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const REQUIRED_FILES = [
  'scripts/generate-build-info.js',
  'next.config.ts',
  'package.json',
  'prisma/schema.prisma',
];

const REQUIRED_SCRIPTS = ['build', 'start', 'prebuild'];

function warn(code, message, details = {}) {
  console.warn('[prebuild-validation]', JSON.stringify({ level: 'warn', code, message, ...details }));
}

function info(message, details = {}) {
  console.info('[prebuild-validation]', JSON.stringify({ level: 'info', message, ...details }));
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function main() {
  info('starting', {
    nodeEnv: process.env.NODE_ENV || 'development',
    render: Boolean(process.env.RENDER),
    gitCommit: process.env.RENDER_GIT_COMMIT || process.env.GIT_SHA || null,
  });

  for (const relativePath of REQUIRED_FILES) {
    if (!fileExists(relativePath)) {
      console.error(
        '[prebuild-validation]',
        JSON.stringify({
          level: 'error',
          code: 'missing_required_file',
          message: `Required file missing: ${relativePath}`,
        })
      );
      process.exit(1);
    }
  }

  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  for (const scriptName of REQUIRED_SCRIPTS) {
    if (!pkg.scripts?.[scriptName]) {
      console.error(
        '[prebuild-validation]',
        JSON.stringify({
          level: 'error',
          code: 'missing_required_script',
          message: `Required npm script missing: ${scriptName}`,
        })
      );
      process.exit(1);
    }
  }

  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (!deps.prisma && !deps['@prisma/client']) {
    warn('prisma_missing', 'Prisma packages not listed in dependencies — build may fail on Render.');
  } else if (!pkg.dependencies?.prisma) {
    warn(
      'prisma_dev_only',
      'prisma CLI is not in dependencies; Render production installs may skip devDependencies.'
    );
  }

  if (!process.env.NEXT_PUBLIC_APP_URL?.trim() && process.env.NODE_ENV === 'production') {
    warn(
      'next_public_app_url_missing',
      'NEXT_PUBLIC_APP_URL is unset during production build. Set at build time for customer-facing links.'
    );
  }

  if (!process.env.DATABASE_URL?.trim()) {
    warn('database_url_missing', 'DATABASE_URL is unset during build. Prisma generate may fail.');
  }

  info('completed', { status: 'ok' });
}

main();
