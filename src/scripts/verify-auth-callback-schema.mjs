/**
 * READ-ONLY diagnostic for /auth/callback database dependencies.
 *
 * Checks tables, columns, and _prisma_migrations against schema.prisma expectations.
 * Does NOT write, migrate, or alter anything.
 *
 * Safe to run on production — prints host/database/user only (never passwords or full URLs).
 *
 * Railway production (recommended — see repo docs / team runbook):
 *   railway link  # select production project + web service
 *   railway run npm run verify:auth-callback-schema
 *
 * Or inside the running Railway service shell (after deploy):
 *   node scripts/verify-auth-callback-schema.mjs
 *
 * Local (only if DATABASE_URL intentionally points at the target DB):
 *   npm run verify:auth-callback-schema
 */
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: resolve(process.cwd(), '.env.local'), override: true });

const EXPECTED_TABLES = ['user_auth_profiles', 'deal_network_pilot_participants'];

const EXPECTED_PARTICIPANT_COLUMNS = [
  'authenticated_user_id',
  'source_organization_id',
  'converted_organization_id',
  'converted_at',
];

/** Columns Prisma upserts/selects on user_auth_profiles (20260624120000 migration). */
const EXPECTED_USER_AUTH_PROFILE_COLUMNS = [
  'user_id',
  'last_login_at',
  'last_login_browser',
  'last_login_os',
  'last_login_location',
  'last_login_ip_hash',
  'previous_login_at',
  'previous_login_location',
  'suspicious_login_pending',
  'suspicious_login_reason',
  'created_at',
  'updated_at',
];

const EXPECTED_MIGRATIONS = [
  '20260624120000_user_auth_profiles',
  '20260821090000_participant_authenticated_user_id',
  '20260823200000_participant_workspace_attribution',
];

function parseDbTarget(rawUrl) {
  if (!rawUrl?.trim()) {
    return { configured: false };
  }
  try {
    const u = new URL(rawUrl.replace(/^postgresql:/, 'postgres:'));
    const host = u.hostname || '(unknown)';
    let providerHint = 'PostgreSQL';
    if (host.includes('railway') || host.includes('rlwy.net')) {
      providerHint = 'Railway Postgres (expected for Provvy production app DB)';
    } else if (host.includes('render.com') || host.startsWith('dpg-')) {
      providerHint = 'Render Postgres';
    } else if (host.includes('supabase')) {
      providerHint = 'Supabase Postgres (often auth; verify this is the app Prisma DB)';
    } else if (host.includes('neon.tech')) {
      providerHint = 'Neon Postgres';
    }
    return {
      configured: true,
      host,
      port: u.port || '5432',
      database: u.pathname.replace(/^\//, '') || '(unknown)',
      user: u.username || '(unknown)',
      providerHint,
    };
  } catch {
    return { configured: true, host: '(unparseable URL — check DATABASE_URL is set)' };
  }
}

async function tableExists(prisma, tableName) {
  const rows = await prisma.$queryRaw`
    SELECT 1 AS ok
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
    LIMIT 1
  `;
  return Array.isArray(rows) && rows.length > 0;
}

async function listColumns(prisma, tableName) {
  const rows = await prisma.$queryRaw`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
    ORDER BY ordinal_position
  `;
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => String(row.column_name));
}

async function fetchMigrationRows(prisma, migrationNames) {
  const rows = await prisma.$queryRaw`
    SELECT migration_name, finished_at, applied_steps_count, started_at, logs
    FROM _prisma_migrations
    WHERE migration_name = ANY(${migrationNames})
    ORDER BY migration_name
  `;
  return Array.isArray(rows) ? rows : [];
}

function columnStatus(existingColumns, expectedColumns) {
  const existing = new Set(existingColumns);
  return Object.fromEntries(
    expectedColumns.map((column) => [column, existing.has(column) ? 'EXISTS' : 'MISSING'])
  );
}

function analyzeMismatches(input) {
  const mismatches = [];

  for (const table of EXPECTED_TABLES) {
    if (input.tables[table] === 'MISSING') {
      mismatches.push(`Table public.${table} is MISSING`);
    }
  }

  for (const [column, status] of Object.entries(input.participantColumns)) {
    if (status === 'MISSING') {
      mismatches.push(`Column deal_network_pilot_participants.${column} is MISSING`);
    }
  }

  for (const [column, status] of Object.entries(input.userAuthProfileColumns)) {
    if (status === 'MISSING') {
      mismatches.push(`Column user_auth_profiles.${column} is MISSING`);
    }
  }

  for (const migration of EXPECTED_MIGRATIONS) {
    const row = input.migrations[migration];
    if (!row?.recorded) {
      mismatches.push(`Migration ${migration} is NOT recorded in _prisma_migrations`);
    }
  }

  // Cross-check: migration recorded but schema object still missing
  if (
    input.migrations['20260624120000_user_auth_profiles']?.recorded &&
    input.tables.user_auth_profiles === 'MISSING'
  ) {
    mismatches.push(
      'Migration 20260624120000_user_auth_profiles is recorded but table user_auth_profiles is MISSING (history/schema drift)'
    );
  }

  if (
    input.migrations['20260821090000_participant_authenticated_user_id']?.recorded &&
    input.participantColumns.authenticated_user_id === 'MISSING'
  ) {
    mismatches.push(
      'Migration 20260821090000_participant_authenticated_user_id is recorded but column authenticated_user_id is MISSING (history/schema drift)'
    );
  }

  if (
    input.migrations['20260823200000_participant_workspace_attribution']?.recorded &&
    (input.participantColumns.source_organization_id === 'MISSING' ||
      input.participantColumns.converted_organization_id === 'MISSING' ||
      input.participantColumns.converted_at === 'MISSING')
  ) {
    mismatches.push(
      'Migration 20260823200000_participant_workspace_attribution is recorded but attribution columns are MISSING (history/schema drift)'
    );
  }

  // Column exists without migration recorded
  if (
    !input.migrations['20260821090000_participant_authenticated_user_id']?.recorded &&
    input.participantColumns.authenticated_user_id === 'EXISTS'
  ) {
    mismatches.push(
      'Column authenticated_user_id EXISTS but migration 20260821090000_participant_authenticated_user_id is NOT recorded (manual DDL or partial history)'
    );
  }

  if (
    input.tables.deal_network_pilot_participants === 'EXISTS' &&
    input.participantColumns.authenticated_user_id === 'MISSING' &&
    input.migrations['20260821090000_participant_authenticated_user_id']?.recorded
  ) {
    mismatches.push(
      'LIKELY /auth/callback FAILURE: Prisma queries authenticated_user_id but the column is missing despite migration history'
    );
  }

  if (
    input.tables.deal_network_pilot_participants === 'EXISTS' &&
    input.participantColumns.authenticated_user_id === 'MISSING' &&
    !input.migrations['20260821090000_participant_authenticated_user_id']?.recorded
  ) {
    mismatches.push(
      'LIKELY /auth/callback FAILURE: deal_network_pilot_participants base table exists but Aug 2026 participant columns were never migrated'
    );
  }

  return mismatches;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl?.trim()) {
    console.error(
      'DATABASE_URL is not set. Link the Railway production web service (railway link) and run via railway run, or use the service shell.'
    );
    process.exit(1);
  }

  const target = parseDbTarget(databaseUrl);
  const prisma = new PrismaClient();

  try {
    const dbMeta = await prisma.$queryRaw`
      SELECT current_database() AS database, current_user AS db_user, version() AS postgres_version
    `;
    const meta = Array.isArray(dbMeta) && dbMeta[0] ? dbMeta[0] : {};

    const tables = {};
    for (const table of EXPECTED_TABLES) {
      tables[table] = (await tableExists(prisma, table)) ? 'EXISTS' : 'MISSING';
    }

    const participantColumnList =
      tables.deal_network_pilot_participants === 'EXISTS'
        ? await listColumns(prisma, 'deal_network_pilot_participants')
        : [];

    const userAuthColumnList =
      tables.user_auth_profiles === 'EXISTS' ? await listColumns(prisma, 'user_auth_profiles') : [];

    const participantColumns = columnStatus(participantColumnList, EXPECTED_PARTICIPANT_COLUMNS);
    const userAuthProfileColumns = columnStatus(userAuthColumnList, EXPECTED_USER_AUTH_PROFILE_COLUMNS);

    const migrationRows = await fetchMigrationRows(prisma, EXPECTED_MIGRATIONS);
    const migrations = Object.fromEntries(
      EXPECTED_MIGRATIONS.map((name) => [name, { recorded: false, finished_at: null, applied_steps_count: null }])
    );
    for (const row of migrationRows) {
      migrations[row.migration_name] = {
        recorded: true,
        finished_at: row.finished_at ? new Date(row.finished_at).toISOString() : null,
        applied_steps_count: row.applied_steps_count ?? null,
        started_at: row.started_at ? new Date(row.started_at).toISOString() : null,
      };
    }

    const mismatches = analyzeMismatches({
      tables,
      participantColumns,
      userAuthProfileColumns,
      migrations,
    });

    const report = {
      diagnostic: 'auth-callback-schema',
      generatedAt: new Date().toISOString(),
      readOnly: true,
      target: {
        ...target,
        runtimeDatabase: meta.database ?? null,
        runtimeUser: meta.db_user ?? null,
        postgresVersion: typeof meta.postgres_version === 'string' ? meta.postgres_version.split(',')[0] : null,
        railwayEnvironment: process.env.RAILWAY_ENVIRONMENT ?? null,
        railwayServiceName: process.env.RAILWAY_SERVICE_NAME ?? null,
        railwayProjectName: process.env.RAILWAY_PROJECT_NAME ?? null,
      },
      tables,
      participantColumns,
      userAuthProfileColumns,
      migrations: Object.fromEntries(
        EXPECTED_MIGRATIONS.map((name) => [
          name,
          migrations[name].recorded ? 'APPLIED' : 'NOT_RECORDED',
        ])
      ),
      migrationDetails: migrations,
      mismatches,
      verdict: mismatches.length === 0 ? 'PASS' : 'FAIL',
      mismatchCount: mismatches.length,
      prismaSchemaExpectations: {
        tables: EXPECTED_TABLES,
        deal_network_pilot_participants_columns: EXPECTED_PARTICIPANT_COLUMNS,
        user_auth_profiles_columns: EXPECTED_USER_AUTH_PROFILE_COLUMNS,
        migrations: EXPECTED_MIGRATIONS,
      },
    };

    console.log('=== AUTH CALLBACK SCHEMA DIAGNOSTIC (READ-ONLY) ===');
    console.log(`Generated: ${report.generatedAt}`);
    console.log('');
    console.log('--- TARGET (no secrets) ---');
    console.log(`Host:     ${report.target.host ?? '(unknown)'}`);
    console.log(`Port:     ${report.target.port ?? '(unknown)'}`);
    console.log(`Database: ${report.target.runtimeDatabase ?? report.target.database ?? '(unknown)'}`);
    console.log(`User:     ${report.target.runtimeUser ?? report.target.user ?? '(unknown)'}`);
    console.log(`Provider: ${report.target.providerHint ?? 'PostgreSQL'}`);
    if (report.target.railwayEnvironment || report.target.railwayServiceName) {
      console.log(`Railway env:     ${report.target.railwayEnvironment ?? '(unset)'}`);
      console.log(`Railway service: ${report.target.railwayServiceName ?? '(unset)'}`);
      console.log(`Railway project: ${report.target.railwayProjectName ?? '(unset)'}`);
    }
    console.log('');
    console.log('--- TABLES ---');
    for (const table of EXPECTED_TABLES) {
      console.log(`${table}: ${tables[table]}`);
    }
    console.log('');
    console.log('--- COLUMNS (deal_network_pilot_participants) ---');
    for (const column of EXPECTED_PARTICIPANT_COLUMNS) {
      console.log(`${column}: ${participantColumns[column]}`);
    }
    console.log('');
    console.log('--- COLUMNS (user_auth_profiles) ---');
    for (const column of EXPECTED_USER_AUTH_PROFILE_COLUMNS) {
      console.log(`${column}: ${userAuthProfileColumns[column]}`);
    }
    console.log('');
    console.log('--- MIGRATIONS (_prisma_migrations) ---');
    for (const migration of EXPECTED_MIGRATIONS) {
      const detail = migrations[migration];
      const status = detail.recorded ? 'APPLIED' : 'NOT_RECORDED';
      const finished = detail.finished_at ? ` @ ${detail.finished_at}` : '';
      console.log(`${migration}: ${status}${finished}`);
    }
    console.log('');
    console.log('--- MISMATCH ANALYSIS ---');
    if (mismatches.length === 0) {
      console.log('No mismatches detected. Schema matches Prisma expectations for /auth/callback.');
    } else {
      mismatches.forEach((line, index) => {
        console.log(`${index + 1}. ${line}`);
      });
    }
    console.log('');
    console.log(`--- VERDICT: ${report.verdict} (${report.mismatchCount} issue(s)) ---`);
    console.log('');
    console.log('--- PASTE BACK TO CURSOR (JSON) ---');
    console.log(JSON.stringify(report, null, 2));

    process.exit(mismatches.length === 0 ? 0 : 1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Diagnostic failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
