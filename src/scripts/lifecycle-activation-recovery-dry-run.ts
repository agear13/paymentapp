import './lib/register-server-only-stub';

import fs from 'fs';
import path from 'path';
import { config as loadEnv } from 'dotenv';

const SRC_ROOT = path.resolve(__dirname, '..');
loadEnv({ path: path.join(SRC_ROOT, '.env.local') });
loadEnv({ path: path.join(SRC_ROOT, '.env') });
loadEnv({ path: path.join(SRC_ROOT, '..', '.env.local') });
loadEnv({ path: path.join(SRC_ROOT, '..', '.env') });

async function main() {
  const { runActivationRecoveryDryRun } = await import(
    '@/lib/email/lifecycle/activation-recovery-dry-run'
  );

  console.log('====================================================');
  console.log('Provvy Activation Recovery Campaign — DRY RUN');
  console.log('====================================================');
  console.log('SAFETY NOTICE: This is a DRY RUN only.');
  console.log('NO EMAILS WILL BE SENT.\n');

  const report = await runActivationRecoveryDryRun();

  console.log('----------------------------------------------------');
  console.log('Dry Run Summary:');
  console.log(`  Total Auth Users Examined: ${report.totalExamined}`);
  console.log(`  Verified: ${report.totalVerified}`);
  console.log(`  Unverified: ${report.totalUnverified}`);
  console.log(`  Eligible: ${report.totalEligible}`);
  console.log(`  Excluded: ${report.totalExcluded}`);
  console.log('----------------------------------------------------');
  console.log('Exclusion Breakdown:');
  for (const [reason, count] of Object.entries(report.exclusionBreakdown)) {
    console.log(`  - ${reason}: ${count}`);
  }
  console.log('----------------------------------------------------');

  const eligible = report.candidates.filter((c) => c.status === 'eligible');
  if (eligible.length > 0) {
    console.log('\nEligible Users (masked):');
    for (const c of eligible.slice(0, 20)) {
      console.log(`  ${c.email} (User: ${c.userId}, created: ${c.userCreatedAt})`);
    }
    if (eligible.length > 20) {
      console.log(`  ... and ${eligible.length - 20} more`);
    }
  }

  const outputDir = path.join(process.cwd(), 'scripts', 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(
    outputDir,
    'lifecycle-activation-recovery-dry-run-report.json'
  );
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nFull report written to: ${outputPath}`);
  console.log('\nTo send later, after reviewing this audience:');
  console.log(
    '  npx tsx scripts/lifecycle-activation-recovery-send.ts --confirm-send --limit=5'
  );
}

main().catch((err) => {
  console.error('Error running activation recovery dry run:', err);
  process.exit(1);
});
