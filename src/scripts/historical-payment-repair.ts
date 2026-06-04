/**
 * Historical payment repair — dry-run by default.
 *
 * Usage (from src/):
 *   npx tsx scripts/historical-payment-repair.ts --help
 *   npx tsx scripts/historical-payment-repair.ts
 *   npx tsx scripts/historical-payment-repair.ts --cohort=A
 *   npx tsx scripts/historical-payment-repair.ts --cohort=F --org-ids=<uuid>
 *   npx tsx scripts/historical-payment-repair.ts --execute --limit=50
 *   npx tsx scripts/historical-payment-repair.ts --before=2026-06-04T00:00:00.000Z
 *
 * Writes JSON audit to scripts/.repair-audit/historical-payment-repair-<timestamp>.json
 */

import './lib/register-server-only-stub';

function printHelp(): void {
  console.log(`Historical Payment Repair CLI

Runs inventory and repair for pre-R1/R3/R4/R5 payment records.
Default mode is DRY-RUN (no database writes).

Usage (from src/):
  npx tsx scripts/historical-payment-repair.ts [options]

Options:
  --help              Show this message
  --execute           Apply repairs (default: dry-run only)
  --cohort=A|B|C|D|E|F|ALL
                      Filter cohort (default: ALL)
  --org-ids=<uuid>[,<uuid>]
                      Limit to organization(s)
  --limit=<n>         Max links/events per inventory query
  --before=<ISO8601>  Only payment_links/events created before date
  --actor=<id>        Audit log actor user id

Examples:
  npx tsx scripts/historical-payment-repair.ts --limit=10
  npx tsx scripts/historical-payment-repair.ts --cohort=A --org-ids=<uuid> --limit=25
  npx tsx scripts/historical-payment-repair.ts --before=2026-06-04T00:00:00.000Z --limit=50
`);
}

const cliArgv = process.argv.slice(2);
if (cliArgv.includes('--help') || cliArgv.includes('-h')) {
  printHelp();
  process.exit(0);
}

import { config } from 'dotenv';
import { resolve } from 'path';
import { mkdirSync, writeFileSync } from 'fs';

// Prefer src/.env.local (same as other scripts), then repo root
config({ path: resolve(__dirname, '../.env.local') });
config({ path: resolve(__dirname, '../.env') });
config({ path: resolve(__dirname, '../../.env.local') });
config({ path: resolve(__dirname, '../../.env') });

type HistoricalRepairCohort = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

function parseArgs(argv: string[]) {
  const execute = argv.includes('--execute');
  const cohortArg = argv.find((a) => a.startsWith('--cohort='))?.split('=')[1]?.toUpperCase();
  const limitArg = argv.find((a) => a.startsWith('--limit='))?.split('=')[1];
  const orgIdsArg = argv.find((a) => a.startsWith('--org-ids='))?.split('=')[1];
  const beforeArg = argv.find((a) => a.startsWith('--before='))?.split('=')[1];
  const actorArg = argv.find((a) => a.startsWith('--actor='))?.split('=')[1];

  const cohort =
    cohortArg && ['A', 'B', 'C', 'D', 'E', 'F', 'ALL'].includes(cohortArg)
      ? ((cohortArg === 'ALL' ? 'all' : cohortArg) as HistoricalRepairCohort | 'all')
      : 'all';

  return {
    execute,
    dryRun: !execute,
    cohort,
    limit: limitArg ? Number.parseInt(limitArg, 10) : undefined,
    organizationIds: orgIdsArg
      ? orgIdsArg.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined,
    createdBefore: beforeArg ? new Date(beforeArg) : undefined,
    actorUserId: actorArg?.trim() ?? 'system-historical-payment-repair',
  };
}

async function main() {
  const { runHistoricalPaymentRepair } = await import(
    '../lib/payments/historical-payment-repair.core'
  );

  const args = parseArgs(cliArgv);

  console.log('='.repeat(60));
  console.log('Historical Payment Repair');
  console.log('='.repeat(60));
  console.log('Mode:', args.dryRun ? 'DRY-RUN (default)' : 'EXECUTE');
  console.log('Cohort filter:', args.cohort);
  if (args.organizationIds?.length) {
    console.log('Organizations:', args.organizationIds.join(', '));
  }
  if (args.createdBefore) {
    console.log('Created before:', args.createdBefore.toISOString());
  }
  console.log('');

  const result = await runHistoricalPaymentRepair({
    dryRun: args.dryRun,
    cohort: args.cohort,
    organizationIds: args.organizationIds,
    limit: args.limit,
    createdBefore: args.createdBefore,
    actorUserId: args.actorUserId,
  });

  console.log('Summary:', JSON.stringify(result.summary, null, 2));
  console.log('');
  console.log('Planned records (first 20):');
  for (const row of result.records.slice(0, 20)) {
    console.log(
      `  [${row.cohort}] ${row.paymentLinkId} → ${row.plannedAction}${row.paymentEventId ? ` event=${row.paymentEventId}` : ''}${row.reason ? ` (${row.reason})` : ''}`
    );
  }
  if (result.records.length > 20) {
    console.log(`  ... and ${result.records.length - 20} more`);
  }

  const auditDir = resolve(__dirname, '../../scripts/.repair-audit');
  mkdirSync(auditDir, { recursive: true });
  const auditPath = resolve(
    auditDir,
    `historical-payment-repair-${Date.now()}.json`
  );
  writeFileSync(auditPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log('');
  console.log('Audit written:', auditPath);

  if (result.summary.failed > 0 && !args.dryRun) {
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error('Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
