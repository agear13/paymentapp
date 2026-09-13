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

async function main() {
  const { runExistingUserCatchupDryRun } = await import(
    '@/lib/email/lifecycle/catchup-dry-run'
  );

  console.log('====================================================');
  console.log('Provvy Lifecycle Email Catch-Up Campaign — DRY RUN');
  console.log('====================================================');
  console.log('SAFETY NOTICE: This is a DRY RUN only.');
  console.log('NO EMAILS WILL BE SENT.\n');

  const report = await runExistingUserCatchupDryRun();

  console.log('----------------------------------------------------');
  console.log('Dry Run Summary:');
  console.log(`  Total Users Examined: ${report.totalExamined}`);
  console.log(`  Total Eligible Users: ${report.totalEligible}`);
  console.log(`  Total Excluded Users: ${report.totalExcluded}`);
  console.log('----------------------------------------------------');
  console.log('Exclusion Breakdown:');
  for (const [reason, count] of Object.entries(report.exclusionBreakdown)) {
    console.log(`  - ${reason}: ${count}`);
  }
  console.log('----------------------------------------------------');

  if (report.candidates.length > 0) {
    console.log('\nSample Candidates:');
    const sample = report.candidates.slice(0, 10);
    for (const c of sample) {
      console.log(`  [${c.status.toUpperCase()}] ${c.email} (User: ${c.userId}) ${c.reason ? `-> Reason: ${c.reason}` : `-> Workspace: ${c.workspaceName}`}`);
    }
    if (report.candidates.length > 10) {
      console.log(`  ... and ${report.candidates.length - 10} more`);
    }
  }

  const outputDir = path.join(process.cwd(), 'scripts', 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'lifecycle-catchup-dry-run-report.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nFull report written to: ${outputPath}`);
  console.log('\nTo send later, after reviewing this audience:');
  console.log('  npx tsx scripts/lifecycle-catchup-send.ts --confirm-send --limit=<n>');
}

main().catch((err) => {
  console.error('Error running catchup dry run:', err);
  process.exit(1);
});
