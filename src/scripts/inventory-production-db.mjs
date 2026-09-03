/**
 * READ-ONLY production database inventory — counts and date ranges only.
 * No dotenv: uses DATABASE_URL already in the environment (e.g. railway run).
 * Does not print credentials, row contents, or PII.
 */
import { PrismaClient } from '@prisma/client';

const LABEL = process.env.INVENTORY_LABEL || 'database';

const TABLE_SPECS = [
  { key: 'organizations', table: 'organizations', dateCol: 'created_at' },
  { key: 'user_organizations', table: 'user_organizations', dateCol: 'created_at' },
  { key: 'user_auth_profiles', table: 'user_auth_profiles', dateCol: 'created_at' },
  { key: 'merchant_settings', table: 'merchant_settings', dateCol: 'created_at' },
  { key: 'payment_links', table: 'payment_links', dateCol: 'created_at' },
  { key: 'payment_events', table: 'payment_events', dateCol: 'created_at' },
  { key: 'multi_currency_invoices', table: 'multi_currency_invoices', dateCol: 'created_at' },
  { key: 'organization_workflow_agreements', table: 'organization_workflow_agreements', dateCol: 'created_at' },
  { key: 'organization_workflows', table: 'organization_workflows', dateCol: 'created_at' },
  { key: 'ledger_entries', table: 'ledger_entries', dateCol: 'created_at' },
  { key: 'deal_network_pilot_deals', table: 'deal_network_pilot_deals', dateCol: 'created_at' },
  { key: 'deal_network_pilot_participants', table: 'deal_network_pilot_participants', dateCol: 'created_at' },
  { key: 'xero_connections', table: 'xero_connections', dateCol: 'created_at' },
  { key: 'referral_links', table: 'referral_links', dateCol: 'created_at' },
  { key: 'audit_logs', table: 'audit_logs', dateCol: 'created_at' },
];

function parseTarget(rawUrl) {
  if (!rawUrl?.trim()) return { configured: false };
  try {
    const u = new URL(rawUrl.replace(/^postgresql:/, 'postgres:'));
    const host = u.hostname || '(unknown)';
    let provider = 'PostgreSQL';
    if (host.includes('railway.internal') || host.includes('rlwy.net')) provider = 'Railway Postgres';
    else if (host.includes('render.com') || host.startsWith('dpg-')) provider = 'Render Postgres';
    else if (host.includes('supabase')) provider = 'Supabase Postgres';
    return {
      configured: true,
      provider,
      host,
      port: u.port || '5432',
      database: u.pathname.replace(/^\//, '') || '(unknown)',
      user: u.username || '(unknown)',
    };
  } catch {
    return { configured: true, provider: 'PostgreSQL', host: '(unparseable)' };
  }
}

async function tableExists(prisma, tableName) {
  const rows = await prisma.$queryRaw`
    SELECT 1 AS ok
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ${tableName}
    LIMIT 1
  `;
  return Array.isArray(rows) && rows.length > 0;
}

async function tableInventory(prisma, spec) {
  const exists = await tableExists(prisma, spec.table);
  if (!exists) {
    return { exists: false, count: null, earliest: null, latest: null };
  }

  const countRows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::bigint AS count FROM "${spec.table}"`
  );
  const count = Number(countRows?.[0]?.count ?? 0);

  let earliest = null;
  let latest = null;
  try {
    const dateRows = await prisma.$queryRawUnsafe(
      `SELECT MIN("${spec.dateCol}") AS earliest, MAX("${spec.dateCol}") AS latest FROM "${spec.table}"`
    );
    const row = dateRows?.[0];
    earliest = row?.earliest ? new Date(row.earliest).toISOString() : null;
    latest = row?.latest ? new Date(row.latest).toISOString() : null;
  } catch {
    /* date column may be absent on some legacy tables */
  }

  return { exists: true, count, earliest, latest };
}

function classifyDataset(totals) {
  const orgs = totals.organizations?.count ?? 0;
  const links = totals.payment_links?.count ?? 0;
  const payments = totals.payment_events?.count ?? 0;
  const profiles = totals.user_auth_profiles?.count ?? 0;

  if (orgs === 0 && links === 0 && payments === 0 && profiles === 0) {
    return 'empty_or_fresh';
  }
  if (orgs <= 3 && links <= 10 && payments <= 20) {
    return 'likely_test_or_seed';
  }
  if (orgs >= 5 || links >= 20 || payments >= 50) {
    return 'likely_production_populated';
  }
  return 'small_ambiguous';
}

function renderExternalCandidates(host) {
  if (!host.startsWith('dpg-')) return [];
  if (host.includes('render.com')) return [];
  const regions = [
    'oregon-postgres.render.com',
    'virginia-postgres.render.com',
    'frankfurt-postgres.render.com',
    'singapore-postgres.render.com',
  ];
  return regions.map((region) => `${host}.${region}`);
}

function rewriteDatabaseUrlHost(rawUrl, host, options = {}) {
  const u = new URL(rawUrl.replace(/^postgresql:/, 'postgres:'));
  u.hostname = host;
  if (options.ssl) {
    u.searchParams.set('sslmode', 'require');
  }
  return u.toString().replace(/^postgres:/, 'postgresql:');
}

async function connectClient(databaseUrl) {
  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });
  await prisma.$queryRaw`SELECT 1`;
  return prisma;
}

async function connectWithFallback(databaseUrl) {
  const errors = [];
  try {
    return { prisma: await connectClient(databaseUrl), connectionHost: new URL(databaseUrl.replace(/^postgresql:/, 'postgres:')).hostname };
  } catch (error) {
    errors.push(error instanceof Error ? error.message.split('\n')[0] : String(error));
  }

  const baseHost = parseTarget(databaseUrl).host;
  for (const host of renderExternalCandidates(baseHost)) {
    for (const ssl of [true, false]) {
      const candidate = rewriteDatabaseUrlHost(databaseUrl, host, { ssl });
      try {
        return {
          prisma: await connectClient(candidate),
          connectionHost: host,
          usedRenderExternalFallback: true,
        };
      } catch (error) {
        errors.push(
          `${host}${ssl ? '+ssl' : ''}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`
        );
      }
    }
  }

  throw new Error(errors.join(' | '));
}
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const report = {
    label: LABEL,
    generatedAt: new Date().toISOString(),
    readOnly: true,
    target: parseTarget(databaseUrl),
    connected: false,
    connectionHost: null,
    usedRenderExternalFallback: false,
    runtime: null,
    migrationsApplied: null,
    tables: {},
    summary: null,
    error: null,
  };

  if (!databaseUrl?.trim()) {
    report.error = 'DATABASE_URL is not set';
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  let prisma;

  try {
    const connected = await connectWithFallback(databaseUrl);
    prisma = connected.prisma;
    report.connectionHost = connected.connectionHost;
    report.usedRenderExternalFallback = Boolean(connected.usedRenderExternalFallback);

    const runtimeRows = await prisma.$queryRaw`
      SELECT current_database() AS database, current_user AS db_user, version() AS version
    `;
    report.connected = true;
    const runtime = runtimeRows?.[0] ?? {};
    report.runtime = {
      database: runtime.database ?? null,
      user: runtime.db_user ?? null,
      postgresVersion: typeof runtime.version === 'string' ? runtime.version.split(',')[0] : null,
    };

    const migRows = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS count FROM _prisma_migrations WHERE finished_at IS NOT NULL
    `.catch(() => [{ count: null }]);
    report.migrationsApplied = migRows?.[0]?.count ?? null;

    for (const spec of TABLE_SPECS) {
      report.tables[spec.key] = await tableInventory(prisma, spec);
    }

    report.summary = {
      classification: classifyDataset(report.tables),
      totalOrganizations: report.tables.organizations?.count ?? 0,
      totalUserProfiles: report.tables.user_auth_profiles?.count ?? 0,
      totalUserOrgMemberships: report.tables.user_organizations?.count ?? 0,
      totalPaymentLinks: report.tables.payment_links?.count ?? 0,
      totalPaymentEvents: report.tables.payment_events?.count ?? 0,
      totalInvoices: report.tables.multi_currency_invoices?.count ?? 0,
      totalAgreements: report.tables.organization_workflow_agreements?.count ?? 0,
      totalLedgerEntries: report.tables.ledger_entries?.count ?? 0,
    };
  } catch (error) {
    report.error = error instanceof Error ? error.message.split('\n')[0] : String(error);
  } finally {
    if (prisma) await prisma.$disconnect();
  }

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.connected && !report.error ? 0 : 1);
}

main();
