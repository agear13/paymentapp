import {
  assertExecuteAllowed,
  fingerprintDatabaseUrl,
  formatBackfillTargetReport,
  isUnusableDatabaseUrl,
  parseScalarCompensationBackfillArgs,
  resolveBackfillDatabaseUrl,
} from '@/lib/participants/scalar-compensation-backfill-cli';

const SUPABASE_URL =
  'postgresql://user:secret@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true';

describe('scalar compensation backfill CLI targeting', () => {
  it('rejects missing, blank, and placeholder DATABASE_URL values', () => {
    expect(isUnusableDatabaseUrl(undefined).unusable).toBe(true);
    expect(isUnusableDatabaseUrl('').unusable).toBe(true);
    expect(isUnusableDatabaseUrl('   ').unusable).toBe(true);
    expect(isUnusableDatabaseUrl('your_database_url_here').unusable).toBe(true);
    expect(
      isUnusableDatabaseUrl('postgresql://user:password@host:5432/db').unusable
    ).toBe(true);
    expect(isUnusableDatabaseUrl(SUPABASE_URL).unusable).toBe(false);
  });

  it('defaults to dry-run unless --execute is present', () => {
    expect(parseScalarCompensationBackfillArgs([]).execute).toBe(false);
    expect(parseScalarCompensationBackfillArgs(['--confirm-host=x']).execute).toBe(
      false
    );
    expect(parseScalarCompensationBackfillArgs(['--execute']).execute).toBe(true);
  });

  it('resolves process DATABASE_URL without falling back to another file', () => {
    const resolved = resolveBackfillDatabaseUrl({
      processEnv: { DATABASE_URL: SUPABASE_URL },
      envFilePath: null,
      defaultEnvFilePath: '/unused/.env.local',
      readFile: () => {
        throw new Error('must not read a fallback env file');
      },
    });
    expect(resolved).toEqual({
      ok: true,
      url: SUPABASE_URL,
      source: 'process',
    });
  });

  it('fails closed when process DATABASE_URL is a placeholder and does not fall back', () => {
    const resolved = resolveBackfillDatabaseUrl({
      processEnv: { DATABASE_URL: 'your_database_url_here' },
      envFilePath: null,
      defaultEnvFilePath: '/src/.env.local',
      readFile: () => `DATABASE_URL=${SUPABASE_URL}`,
    });
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      expect(resolved.error).toMatch(/placeholder/i);
      expect(resolved.error).toMatch(/no file fallback/i);
    }
  });

  it('uses only the default env file when process DATABASE_URL is unset', () => {
    const resolved = resolveBackfillDatabaseUrl({
      processEnv: {},
      envFilePath: null,
      defaultEnvFilePath: '/src/.env.local',
      readFile: (path) =>
        path === '/src/.env.local' ? `DATABASE_URL="${SUPABASE_URL}"` : null,
    });
    expect(resolved).toMatchObject({
      ok: true,
      url: SUPABASE_URL,
      source: 'env-file',
      sourcePath: '/src/.env.local',
    });
  });

  it('fails closed when the default env file is missing', () => {
    const resolved = resolveBackfillDatabaseUrl({
      processEnv: {},
      envFilePath: null,
      defaultEnvFilePath: '/src/.env.local',
      readFile: () => null,
    });
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      expect(resolved.error).toMatch(/not found/);
    }
  });

  it('uses an explicit --env-file and ignores process DATABASE_URL', () => {
    const resolved = resolveBackfillDatabaseUrl({
      processEnv: { DATABASE_URL: 'postgresql://other@example.com/db' },
      envFilePath: '/explicit.env',
      defaultEnvFilePath: '/src/.env.local',
      readFile: (path) =>
        path === '/explicit.env' ? `DATABASE_URL=${SUPABASE_URL}` : null,
    });
    expect(resolved).toMatchObject({
      ok: true,
      url: SUPABASE_URL,
      source: 'env-file',
      sourcePath: '/explicit.env',
    });
  });

  it('fingerprints host, database, and environment without credentials', () => {
    const result = fingerprintDatabaseUrl(SUPABASE_URL);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.target).toEqual({
        host: 'aws-1-ap-southeast-1.pooler.supabase.com',
        port: '6543',
        database: 'postgres',
        environment: 'supabase',
      });
    }
    const report = formatBackfillTargetReport({
      mode: 'DRY-RUN',
      source: 'env-file',
      sourcePath: '/src/.env.local',
      target: {
        host: 'aws-1-ap-southeast-1.pooler.supabase.com',
        port: '6543',
        database: 'postgres',
        environment: 'supabase',
      },
      runtimeDatabase: 'postgres',
      tablePresent: true,
      scannedRows: 1,
    });
    expect(report).toContain('MODE: DRY-RUN');
    expect(report).toContain('host: aws-1-ap-southeast-1.pooler.supabase.com');
    expect(report).toContain('environment: supabase');
    expect(report).toContain('candidateTable: deal_network_pilot_participants');
    expect(report).not.toContain('secret');
    expect(report).not.toContain(SUPABASE_URL);
  });

  it('refuses --execute without a matching --confirm-host', () => {
    const target = {
      host: 'aws-1-ap-southeast-1.pooler.supabase.com',
      port: '6543',
      database: 'postgres',
      environment: 'supabase' as const,
    };
    expect(
      assertExecuteAllowed({
        execute: false,
        confirmHost: null,
        target,
        tablePresent: true,
      }).ok
    ).toBe(true);
    expect(
      assertExecuteAllowed({
        execute: true,
        confirmHost: null,
        target,
        tablePresent: true,
      }).ok
    ).toBe(false);
    expect(
      assertExecuteAllowed({
        execute: true,
        confirmHost: 'other.example.com',
        target,
        tablePresent: true,
      }).ok
    ).toBe(false);
    expect(
      assertExecuteAllowed({
        execute: true,
        confirmHost: 'aws-1-ap-southeast-1.pooler.supabase.com',
        target,
        tablePresent: true,
      }).ok
    ).toBe(true);
  });

  it('fails closed on --execute when the host is not positively identified', () => {
    const result = assertExecuteAllowed({
      execute: true,
      confirmHost: 'localhost',
      target: {
        host: 'localhost',
        port: '5432',
        database: 'postgres',
        environment: 'unknown',
      },
      tablePresent: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/not positively identified/);
    }
  });

  it('fails closed on --execute when the candidate table is missing', () => {
    const result = assertExecuteAllowed({
      execute: true,
      confirmHost: 'aws-1-ap-southeast-1.pooler.supabase.com',
      target: {
        host: 'aws-1-ap-southeast-1.pooler.supabase.com',
        port: '6543',
        database: 'postgres',
        environment: 'supabase',
      },
      tablePresent: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/not present/);
    }
  });
});
