/**
 * Controlled activation recovery send.
 *
 * Default: refuse to send.
 * Required for a real send:
 *   npx tsx scripts/lifecycle-activation-recovery-send.ts --confirm-send --limit=<n>
 *
 * Always run the dry-run first:
 *   npx tsx scripts/lifecycle-activation-recovery-dry-run.ts
 */

import './lib/register-server-only-stub';

import fs from 'fs';
import path from 'path';
import { config as loadEnv } from 'dotenv';

const SRC_ROOT = path.resolve(__dirname, '..');
loadEnv({ path: path.join(SRC_ROOT, '.env.local') });
loadEnv({ path: path.join(SRC_ROOT, '.env') });
loadEnv({ path: path.join(SRC_ROOT, '..', '.env.local') });
loadEnv({ path: path.join(SRC_ROOT, '..', '.env') });

function printUsage(): void {
  console.log(`Provvy activation recovery send

This script will NOT send anything unless both flags are present.

Usage (from src/):
  npx tsx scripts/lifecycle-activation-recovery-dry-run.ts
  npx tsx scripts/lifecycle-activation-recovery-send.ts --confirm-send --limit=5

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

  const { runActivationRecoverySend } = await import(
    '@/lib/email/lifecycle/activation-recovery-dry-run'
  );

  console.log('====================================================');
  console.log('Provvy Activation Recovery Campaign — SEND');
  console.log('====================================================');
  console.log(`Limit: ${limit}`);
  console.log('Each recipient is re-checked via Supabase before dispatch.\n');

  const report = await runActivationRecoverySend({ limit });

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
    `lifecycle-activation-recovery-send-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  );
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nFull report written to: ${outputPath}`);
}

main().catch((err) => {
  console.error('Error running activation recovery send:', err);
  process.exit(1);
});
