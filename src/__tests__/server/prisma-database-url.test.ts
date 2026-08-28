import {
  isPostgresTransactionPoolerUrl,
  resolvePrismaRuntimeDatabaseUrl,
} from '@/lib/server/prisma-database-url';

const POOLER =
  'postgresql://postgres.example:secret@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres';
const DIRECT =
  'postgresql://postgres:secret@db.example.supabase.co:5432/postgres';

describe('resolvePrismaRuntimeDatabaseUrl', () => {
  it('adds pgbouncer=true for Supabase transaction pooler :6543', () => {
    expect(resolvePrismaRuntimeDatabaseUrl(POOLER)).toBe(
      `${POOLER}?pgbouncer=true`
    );
  });

  it('does not duplicate pgbouncer when already present', () => {
    const withFlag = `${POOLER}?pgbouncer=true&connection_limit=1`;
    expect(resolvePrismaRuntimeDatabaseUrl(withFlag)).toBe(withFlag);
  });

  it('leaves direct Postgres :5432 unchanged', () => {
    expect(resolvePrismaRuntimeDatabaseUrl(DIRECT)).toBe(DIRECT);
    expect(isPostgresTransactionPoolerUrl(DIRECT)).toBe(false);
  });

  it('appends PRISMA_CONNECTION_LIMIT only when connection_limit is absent', () => {
    expect(
      resolvePrismaRuntimeDatabaseUrl(POOLER, { connectionLimit: '1' })
    ).toBe(`${POOLER}?pgbouncer=true&connection_limit=1`);
    expect(
      resolvePrismaRuntimeDatabaseUrl(`${POOLER}?pgbouncer=true&connection_limit=5`, {
        connectionLimit: '1',
      })
    ).toBe(`${POOLER}?pgbouncer=true&connection_limit=5`);
  });
});
