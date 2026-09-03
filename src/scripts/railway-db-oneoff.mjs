/**
 * One-off Railway DB helper — uses DATABASE_URL from environment only.
 * Never prints credentials. Safe metadata/counts only.
 */
import { PrismaClient } from '@prisma/client';

const mode = process.argv[2] || 'ping';

function targetMeta(databaseUrl) {
  try {
    const u = new URL(databaseUrl.replace(/^postgresql:/, 'postgres:'));
    return {
      provider: u.hostname.includes('railway.internal') || u.hostname.includes('rlwy.net')
        ? 'Railway Postgres'
        : u.hostname.startsWith('dpg-')
          ? 'Render Postgres'
          : u.hostname.includes('supabase')
            ? 'Supabase Postgres'
            : 'PostgreSQL',
      host: u.hostname,
      port: u.port || '5432',
      database: u.pathname.replace(/^\//, '') || '(unknown)',
      user: u.username || '(unknown)',
    };
  } catch {
    return { provider: 'PostgreSQL', host: '(unparseable)' };
  }
}

function assertRailwayTarget(databaseUrl) {
  const meta = targetMeta(databaseUrl);
  const ok =
    meta.provider === 'Railway Postgres' &&
    meta.host === 'provvypay-db.railway.internal' &&
    meta.database === 'railway';
  if (!ok) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          error: 'Refusing: DATABASE_URL is not Railway provvypay-db',
          target: meta,
        },
        null,
        2
      )
    );
    process.exit(1);
  }
  return meta;
}

async function ping(databaseUrl) {
  const target = assertRailwayTarget(databaseUrl);
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const rows = await prisma.$queryRaw`
      SELECT current_database() AS db, 1::int AS ok
    `;
    console.log(
      JSON.stringify(
        {
          mode: 'ping',
          from: process.env.RAILWAY_SERVICE_NAME || 'local',
          readOnly: true,
          connected: true,
          target,
          result: rows[0] ?? null,
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

async function tables(databaseUrl) {
  const target = assertRailwayTarget(databaseUrl);
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const rows = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    const mig = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS count FROM _prisma_migrations WHERE finished_at IS NOT NULL
    `.catch(() => [{ count: null }]);
    console.log(
      JSON.stringify(
        {
          mode: 'tables',
          readOnly: true,
          target,
          migrationsApplied: mig[0]?.count ?? null,
          publicTableCount: rows.length,
          tables: rows.map((r) => r.table_name),
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.log(JSON.stringify({ error: 'DATABASE_URL is not set' }, null, 2));
    process.exit(1);
  }

  if (mode === 'ping') return ping(databaseUrl);
  if (mode === 'tables') return tables(databaseUrl);
  console.log(JSON.stringify({ error: `Unknown mode: ${mode}` }, null, 2));
  process.exit(1);
}

main().catch((error) => {
  console.log(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message.split('\n')[0] : String(error),
      },
      null,
      2
    )
  );
  process.exit(1);
});
