/**
 * Explicit, idempotent backfill of legacy scalar revenue-share compensation profiles.
 *
 * Dry-run by default. Does not run on deploy. Uses a standalone Prisma client
 * (not the Next.js server prisma module).
 *
 *   cd src
 *   npx tsx scripts/backfill-scalar-compensation-profiles.ts
 *   npx tsx scripts/backfill-scalar-compensation-profiles.ts --env-file=.env.local
 *   npx tsx scripts/backfill-scalar-compensation-profiles.ts --execute --confirm-host=<host>
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import {
  assertExecuteAllowed,
  fingerprintDatabaseUrl,
  formatBackfillTargetReport,
  isUnusableDatabaseUrl,
  parseScalarCompensationBackfillArgs,
  resolveBackfillDatabaseUrl,
  SCALAR_COMPENSATION_CANDIDATE_TABLE,
} from '../lib/participants/scalar-compensation-backfill-cli';
import { runScalarCompensationProfileBackfill } from '../lib/participants/repair-scalar-compensation-backfill';

const DEFAULT_ENV_FILE = resolve(__dirname, '../.env.local');

function printHelp(): void {
  console.log(`Scalar compensation profile backfill

Dry-run is the default. --execute never runs unless --confirm-host matches
the identified database host.

Usage (from src/):
  npx tsx scripts/backfill-scalar-compensation-profiles.ts
  npx tsx scripts/backfill-scalar-compensation-profiles.ts --env-file=.env.local
  npx tsx scripts/backfill-scalar-compensation-profiles.ts --execute --confirm-host=<host>

Environment:
  Uses process DATABASE_URL if already set.
  Otherwise reads only src/.env.local (no silent fallback to another file).
  --env-file=<path> uses that file only.
  Placeholder / blank / non-postgres URLs fail closed.
`);
}

async function inspectCandidateTable(prisma: PrismaClient): Promise<{
  tablePresent: boolean;
  scannedRows: number | null;
  runtimeDatabase: string | null;
}> {
  const dbRows = await prisma.$queryRaw<Array<{ current_database: string }>>`
    SELECT current_database() AS current_database
  `;
  const runtimeDatabase = dbRows[0]?.current_database ?? null;
  const presence = await prisma.$queryRaw<Array<{ present: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${SCALAR_COMPENSATION_CANDIDATE_TABLE}
    ) AS present
  `;
  const tablePresent = Boolean(presence[0]?.present);
  if (!tablePresent) {
    return { tablePresent: false, scannedRows: null, runtimeDatabase };
  }
  const counted = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT COUNT(*)::bigint AS n FROM deal_network_pilot_participants
  `;
  return {
    tablePresent: true,
    scannedRows: Number(counted[0]?.n ?? 0),
    runtimeDatabase,
  };
}

async function main(): Promise<void> {
  const args = parseScalarCompensationBackfillArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const resolved = resolveBackfillDatabaseUrl({
    processEnv: process.env,
    envFilePath: args.envFile ? resolve(process.cwd(), args.envFile) : null,
    defaultEnvFilePath: DEFAULT_ENV_FILE,
    readFile: (path) => (existsSync(path) ? readFileSync(path, 'utf8') : null),
  });
  if (!resolved.ok) {
    console.error(resolved.error);
    process.exitCode = 1;
    return;
  }

  const target = fingerprintDatabaseUrl(resolved.url);
  if (!target.ok) {
    console.error(target.error);
    process.exitCode = 1;
    return;
  }

  process.env.DATABASE_URL = resolved.url;
  const direct = isUnusableDatabaseUrl(process.env.DIRECT_DATABASE_URL);
  if (direct.unusable) {
    process.env.DIRECT_DATABASE_URL = resolved.url;
  }

  const prisma = new PrismaClient({
    log: ['error'],
    datasources: { db: { url: resolved.url } },
  });

  try {
    const inspection = await inspectCandidateTable(prisma);
    console.log(
      formatBackfillTargetReport({
        mode: args.execute ? 'EXECUTE' : 'DRY-RUN',
        source: resolved.source,
        sourcePath: resolved.sourcePath,
        target: target.target,
        runtimeDatabase: inspection.runtimeDatabase,
        tablePresent: inspection.tablePresent,
        scannedRows: inspection.scannedRows,
      })
    );

    if (!inspection.tablePresent) {
      console.error(
        `Candidate table ${SCALAR_COMPENSATION_CANDIDATE_TABLE} is not present. Aborting.`
      );
      process.exitCode = 1;
      return;
    }

    const executeGuard = assertExecuteAllowed({
      execute: args.execute,
      confirmHost: args.confirmHost,
      target: target.target,
      tablePresent: inspection.tablePresent,
    });
    if (!executeGuard.ok) {
      console.error(executeGuard.error);
      process.exitCode = 1;
      return;
    }

    const result = await runScalarCompensationProfileBackfill({
      prisma,
      execute: args.execute,
    });

    console.log(`total candidates: ${result.totalCandidates}`);
    console.log(`would change: ${result.wouldChange}`);
    console.log(`changed: ${result.changed}`);
    console.log(`A. participationModel === 'revenue_share': ${result.revenueShareCount}`);
    console.log(
      `B. commissionKind === 'pct_deal_value' without revenue_share: ${result.pctDealValueWithoutRevenueShareCount}`
    );
    for (const candidate of result.candidates) {
      console.log(
        `  ${candidate.participantId}  deal=${candidate.dealId}  group=${candidate.group}`
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
