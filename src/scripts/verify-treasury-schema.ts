import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '.env.local', override: true });

const EXPECTED_TABLES = [
  'treasury_integration_connections',
  'treasury_events',
  'treasury_event_links',
  'treasury_manual_reconciliations',
];

const EXPECTED_INDEXES = [
  'ux_treasury_connections_org_provider',
  'ux_treasury_events_idempotency',
  'ux_treasury_event_links_pair',
];

async function main(): Promise<void> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const tables = await client.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'treasury_%' ORDER BY tablename`
  );

  const indexes = await client.query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE '%treasury%' ORDER BY indexname`
  );

  const enums = await client.query<{ typname: string }>(
    `SELECT typname FROM pg_type WHERE typname IN ('TreasuryEventType', 'TreasuryEventStatus', 'TreasuryLinkType') ORDER BY typname`
  );

  const migration = await client.query<{ migration_name: string }>(
    `SELECT migration_name FROM _prisma_migrations WHERE migration_name = '20260816120000_treasury_foundation'`
  );

  console.log(JSON.stringify({
    migrationRecorded: (migration.rowCount ?? 0) > 0,
    tables: tables.rows.map((r) => r.tablename),
    tablesExpected: EXPECTED_TABLES,
    tablesOk: EXPECTED_TABLES.every((t) => tables.rows.some((r) => r.tablename === t)),
    indexes: indexes.rows.map((r) => r.indexname),
    keyIndexesPresent: EXPECTED_INDEXES.every((i) =>
      indexes.rows.some((r) => r.indexname === i)
    ),
    enums: enums.rows.map((r) => r.typname),
  }, null, 2));

  await client.end();
}

void main();
