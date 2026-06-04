/**
 * Fingerprints the Postgres DB behind DATABASE_URL (same source as Transactions page prisma).
 * Does not print passwords.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Next.js load order for dev: .env then .env.local (local overrides)
config({ path: resolve(__dirname, '../.env') });
config({ path: resolve(__dirname, '../.env.local'), override: true });
config({ path: resolve(__dirname, '../.env.development.local'), override: true });

function parseDbUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url.replace(/^postgresql:/, 'postgres:'));
    return {
      host: u.hostname,
      port: u.port || '5432',
      database: u.pathname.replace(/^\//, '') || 'postgres',
      user: u.username,
      providerHint: u.hostname.includes('supabase')
        ? 'Supabase Postgres'
        : u.hostname.includes('render.com') || u.hostname.startsWith('dpg-')
          ? 'Render Postgres'
          : u.hostname.includes('neon.tech')
            ? 'Neon Postgres'
            : 'PostgreSQL (unknown host)',
    };
  } catch {
    return { raw: 'unparseable' };
  }
}

async function fingerprint(label, connectionString) {
  const parsed = parseDbUrl(connectionString);
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 20000 });
  try {
    await client.connect();
    const [dbMeta, counts, mig, cols] = await Promise.all([
      client.query(
        `SELECT current_database() AS db, current_user AS usr, version() AS version`
      ),
      client.query(`
        SELECT
          (SELECT COUNT(*)::int FROM payment_events WHERE event_type::text = 'PAYMENT_CONFIRMED') AS payment_confirmed,
          (SELECT COUNT(*)::int FROM payment_events) AS payment_events_total,
          (SELECT COUNT(*)::int FROM payment_links) AS payment_links_total,
          (SELECT COUNT(*)::int FROM organizations) AS organizations_total
      `),
      client.query(`
        SELECT migration_name, finished_at
        FROM _prisma_migrations
        ORDER BY finished_at DESC NULLS LAST
        LIMIT 3
      `).catch(() => ({ rows: [] })),
      client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payment_links'
          AND column_name IN ('referral_link_id', 'pilot_deal_id', 'commission_attribution_snapshot')
      `),
    ]);

    return {
      label,
      ok: true,
      connection: parsed,
      runtime: dbMeta.rows[0],
      counts: counts.rows[0],
      latestMigrations: mig.rows,
      paymentLinksAttributionColumns: cols.rows.map((r) => r.column_name),
    };
  } catch (e) {
    return { label, ok: false, connection: parsed, error: e.message };
  } finally {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_DATABASE_URL;

  console.log(
    JSON.stringify(
      {
        nodeEnv: process.env.NODE_ENV ?? '(unset)',
        nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL ?? '(unset)',
        envFilesLoaded: ['.env', '.env.local', '.env.development.local (if present)'],
        transactionsPageDataPath:
          'Server Component src/app/(dashboard)/dashboard/transactions/page.tsx → import prisma from @/lib/server/prisma → process.env.DATABASE_URL only (no API route, no Supabase for payment_events)',
        prismaSchema:
          'src/prisma/schema.prisma datasource db.url = env(DATABASE_URL); directUrl = env(DIRECT_DATABASE_URL) for migrations only',
        renderProductionNote:
          'render.yaml binds DATABASE_URL from Render native DB provvypay-db (not Supabase)',
        localConfigured: {
          databaseUrl: parseDbUrl(databaseUrl),
          directDatabaseUrl: parseDbUrl(directUrl),
        },
        fingerprints: [
          await fingerprint('DATABASE_URL (Transactions runtime)', databaseUrl),
          ...(directUrl && directUrl !== databaseUrl
            ? [await fingerprint('DIRECT_DATABASE_URL (migrations only)', directUrl)]
            : []),
        ],
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
