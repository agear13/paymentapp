/**
 * Controlled existing-user catch-up send.
 *
 * Default: refuse to send.
 * Required for a real send:
 *   npx tsx scripts/lifecycle-catchup-send.ts --confirm-send --limit=<n>
 *
 * Always run the dry-run first:
 *   npx tsx scripts/lifecycle-catchup-dry-run.ts
 */

import './lib/register-server-only-stub';

import fs from 'fs';
import path from 'path';
import { config as loadEnv } from 'dotenv';

const SRC_ROOT = path.resolve(__dirname, '..');
// Prefer src/.env.local (same as other scripts), then repo root
loadEnv({ path: path.join(SRC_ROOT, '.env.local') });
loadEnv({ path: path.join(SRC_ROOT, '.env') });
loadEnv({ path: path.join(SRC_ROOT, '..', '.env.local') });
loadEnv({ path: path.join(SRC_ROOT, '..', '.env') });

function printUsage(): void {
  console.log(`Provvy lifecycle catch-up send

This script will NOT send anything unless both flags are present.

Usage (from src/):
  npx tsx scripts/lifecycle-catchup-dry-run.ts
  npx tsx scripts/lifecycle-catchup-send.ts --confirm-send --limit=5

Options:
  --confirm-send   Required acknowledgement that this is a real send
  --limit=<n>      Required max number of eligible users to email
  --help           Show this message
`);
}

function parseArgs(argv: string[]): { confirmSend: boolean; limit: number | null; help: boolean } {
  let confirmSend = false;
  let limit: number | null = null;
  let help = false;

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') help = true;
    if (arg === '--confirm-send') confirmSend = true;
    if (arg.startsWith('--limit=')) {
      const value = Number(arg.slice('--limit='.length));
      limit = Number.isFinite(value) ? value : null;
    }
  }

  return { confirmSend, limit, help };
}

async function main() {
  const { confirmSend, limit, help } = parseArgs(process.argv.slice(2));

  if (help || !confirmSend || !limit || limit < 1) {
    printUsage();
    if (!help && (!confirmSend || !limit || limit < 1)) {
      console.error('Refusing to send: --confirm-send and a positive --limit are both required.');
      process.exit(1);
    }
    return;
  }

  const { runExistingUserCatchupSend } = await import(
    '@/lib/email/lifecycle/catchup-dry-run'
  );

  console.log('====================================================');
  console.log('Provvy Lifecycle Email Catch-Up Campaign — SEND');
  console.log('====================================================');
  console.log(`Limit: ${limit}`);
  console.log('Each recipient is re-checked by sendLifecycleEmail() before dispatch.\n');

  const report = await runExistingUserCatchupSend({ limit });

  console.log('----------------------------------------------------');
  console.log('Send Summary:');
  console.log(`  Examined: ${report.totalExamined}`);
  console.log(`  Eligible: ${report.totalEligible}`);
  console.log(`  Selected: ${report.totalSelected}`);
  console.log(`  Sent: ${report.totalSent}`);
  console.log(`  Suppressed: ${report.totalSuppressed}`);
  console.log(`  Failed: ${report.totalFailed}`);
  console.log('----------------------------------------------------');

  const outputDir = path.join(process.cwd(), 'scripts', 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(
    outputDir,
    `lifecycle-catchup-send-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  );
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nFull report written to: ${outputPath}`);
}

main().catch((err) => {
  console.error('Error running catchup send:', err);
  process.exit(1);
});
