/**
 * Fingerprints the Postgres database behind DATABASE_URL (same source as Transactions page).
 * Does not print passwords.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });
config({ path: resolve(__dirname, '../.env') });

function parseDbUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return {
      protocol: u.protocol,
      host: u.hostname,
      port: u.port || '5432',
      database: u.pathname.replace(/^\//, '') || 'postgres',
      username: u.username,
      providerHint: u.hostname.includes('supabase')
        ? 'Supabase Postgres (pooler or direct)'
        : u.hostname.includes('render.com') || u.hostname.startsWith('dpg-')
          ? 'Render Postgres'
          : u.hostname === 'localhost'
            ? 'Local Postgres'
            : 'Other Postgres host',
    };
  } catch {
    return { raw: 'unparseable' };
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_DATABASE_URL;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  console.log('=== ENV (no secrets) ===');
  console.log(
    JSON.stringify(
      {
        NODE_ENV: process.env.NODE_ENV ?? '(unset)',
        NEXT_PUBLIC_APP_URL: appUrl ?? '(unset)',
        NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ?? '(unset)',
        DATABASE_URL_target: parseDbUrl(databaseUrl),
        DIRECT_DATABASE_URL_target: parseDbUrl(directUrl),
      },
      null,
      2
    )
  );

  if (!databaseUrl) {
    console.log('NO DATABASE_URL');
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 25000,
  });

  await client.connect();

  const identity = await client.query(`
    SELECT
      current_database() AS database_name,
      current_user AS db_user,
      version() AS pg_version,
      inet_server_addr()::text AS server_addr,
      inet_server_port() AS server_port
  `);

  const counts = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM payment_events WHERE event_type::text = 'PAYMENT_CONFIRMED') AS payment_confirmed_count,
      (SELECT COUNT(*)::int FROM payment_events) AS payment_events_total,
      (SELECT COUNT(*)::int FROM payment_links) AS payment_links_total,
      (SELECT COUNT(*)::int FROM organizations) AS organizations_count
  `);

  const latestMigration = await client.query(`
    SELECT migration_name, finished_at
    FROM _prisma_migrations
    ORDER BY finished_at DESC NULLS LAST
    LIMIT 1
  `).catch(() => ({ rows: [{ migration_name: '(no _prisma_migrations)', finished_at: null }] }));

  const referralCol = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'payment_links' AND column_name = 'referral_link_id'
    ) AS has_referral_link_id
  `);

  const fingerprint = await client.query(`
    SELECT md5(string_agg(migration_name, ',' ORDER BY migration_name)) AS schema_fingerprint
    FROM _prisma_migrations
    WHERE finished_at IS NOT NULL
  `).catch(() => ({ rows: [{ schema_fingerprint: null }] }));

  const eventTypes = await client.query(`
    SELECT event_type::text, COUNT(*)::int AS count
    FROM payment_events
    GROUP BY 1
    ORDER BY count DESC
  `);

  await client.end();

  console.log('\n=== LIVE DB FINGERPRINT (via DATABASE_URL — same as Transactions page) ===');
  console.log(
    JSON.stringify(
      {
        identity: identity.rows[0],
        counts: counts.rows[0],
        latestMigration: latestMigration.rows[0],
        has_referral_link_id_on_payment_links: referralCol.rows[0]?.has_referral_link_id,
        schema_fingerprint_md5: fingerprint.rows[0]?.schema_fingerprint,
        payment_events_by_type: eventTypes.rows,
      },
      null,
      2
    )
  );

  console.log('\n=== PRODUCTION (render.yaml) EXPECTED ===');
  console.log(
    JSON.stringify(
      {
        service: 'provvypay-api',
        DATABASE_URL_source: 'Render managed Postgres provvypay-db (property connectionString)',
        region: 'oregon',
        databaseName: 'provvypay_production',
        note: 'Production does NOT use Supabase for Prisma unless manually overridden in Render env group',
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error('FAILED', e.message);
  process.exit(1);
});
