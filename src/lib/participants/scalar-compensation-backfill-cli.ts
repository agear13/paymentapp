/**
 * CLI targeting / safety for the scalar compensation backfill.
 * Does not change repair predicate or compensation semantics.
 */

export const SCALAR_COMPENSATION_CANDIDATE_TABLE =
  'deal_network_pilot_participants';

const PLACEHOLDER_URL_PATTERNS = [
  /your_database_url_here/i,
  /<database_url>/i,
  /\$\{?database_url\}?/i,
  /^postgres(ql)?:\/\/user:password@host\b/i,
  /^postgres(ql)?:\/\/USER:PASSWORD@HOST\b/i,
];

export type BackfillDatabaseSource = 'process' | 'env-file';

export type BackfillEnvironmentLabel = 'supabase' | 'neon' | 'render' | 'unknown';

export type BackfillCliArgs = {
  execute: boolean;
  confirmHost: string | null;
  envFile: string | null;
  help: boolean;
};

export type BackfillDatabaseTarget = {
  host: string;
  port: string;
  database: string;
  environment: BackfillEnvironmentLabel;
};

export function parseScalarCompensationBackfillArgs(argv: string[]): BackfillCliArgs {
  const execute = argv.includes('--execute');
  const help = argv.includes('--help') || argv.includes('-h');
  return {
    execute,
    confirmHost: readFlagValue(argv, '--confirm-host'),
    envFile: readFlagValue(argv, '--env-file'),
    help,
  };
}

export function isUnusableDatabaseUrl(
  value: string | undefined | null
): { unusable: true; reason: string } | { unusable: false; url: string } {
  if (value == null) {
    return { unusable: true, reason: 'DATABASE_URL is missing' };
  }
  const url = value.trim().replace(/^['"]|['"]$/g, '');
  if (!url) {
    return { unusable: true, reason: 'DATABASE_URL is blank' };
  }
  if (PLACEHOLDER_URL_PATTERNS.some((pattern) => pattern.test(url))) {
    return { unusable: true, reason: 'DATABASE_URL is a placeholder' };
  }
  if (!/^postgres(ql)?:\/\//i.test(url)) {
    return {
      unusable: true,
      reason: 'DATABASE_URL must be a postgres or postgresql URL',
    };
  }
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.trim()) {
      return { unusable: true, reason: 'DATABASE_URL host is missing' };
    }
  } catch {
    return { unusable: true, reason: 'DATABASE_URL is not a valid URL' };
  }
  return { unusable: false, url };
}

export function fingerprintDatabaseUrl(
  url: string
): { ok: true; target: BackfillDatabaseTarget } | { ok: false; error: string } {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.trim();
    if (!host) {
      return { ok: false, error: 'DATABASE_URL host is missing' };
    }
    return {
      ok: true,
      target: {
        host,
        port: parsed.port || (host.includes('pooler') ? '6543' : '5432'),
        database: decodeURIComponent(parsed.pathname.replace(/^\//, '').split('/')[0] || ''),
        environment: environmentLabelForHost(host),
      },
    };
  } catch {
    return { ok: false, error: 'DATABASE_URL is not a valid URL' };
  }
}

export function resolveBackfillDatabaseUrl(input: {
  processEnv: NodeJS.ProcessEnv;
  envFilePath: string | null;
  defaultEnvFilePath: string;
  readFile: (path: string) => string | null;
}):
  | { ok: true; url: string; source: BackfillDatabaseSource; sourcePath?: string }
  | { ok: false; error: string } {
  if (input.envFilePath) {
    return urlFromEnvFile(input.envFilePath, input.readFile, 'explicit --env-file');
  }

  const fromProcess = input.processEnv.DATABASE_URL;
  if (fromProcess !== undefined) {
    const checked = isUnusableDatabaseUrl(fromProcess);
    if (checked.unusable) {
      return {
        ok: false,
        error: `${checked.reason} in the process environment (no file fallback)`,
      };
    }
    return { ok: true, url: checked.url, source: 'process' };
  }

  return urlFromEnvFile(input.defaultEnvFilePath, input.readFile, 'default src/.env.local');
}

export function assertExecuteAllowed(input: {
  execute: boolean;
  confirmHost: string | null;
  target: BackfillDatabaseTarget;
  tablePresent: boolean;
}): { ok: true } | { ok: false; error: string } {
  if (!input.execute) return { ok: true };
  if (!input.tablePresent) {
    return {
      ok: false,
      error: `Refusing --execute: candidate table ${SCALAR_COMPENSATION_CANDIDATE_TABLE} is not present`,
    };
  }
  if (input.target.environment === 'unknown') {
    return {
      ok: false,
      error:
        'Refusing --execute: database host is not positively identified (expected supabase, neon, or render)',
    };
  }
  const confirmHost = input.confirmHost?.trim().toLowerCase() ?? '';
  if (!confirmHost) {
    return {
      ok: false,
      error: `Refusing --execute: pass --confirm-host=${input.target.host} to target this database`,
    };
  }
  if (confirmHost !== input.target.host.toLowerCase()) {
    return {
      ok: false,
      error: `Refusing --execute: --confirm-host does not match identified host ${input.target.host}`,
    };
  }
  return { ok: true };
}

export function formatBackfillTargetReport(input: {
  mode: 'DRY-RUN' | 'EXECUTE';
  source: BackfillDatabaseSource;
  sourcePath?: string;
  target: BackfillDatabaseTarget;
  runtimeDatabase?: string | null;
  tablePresent: boolean | null;
  scannedRows: number | null;
}): string {
  const lines = [
    `MODE: ${input.mode}`,
    'TARGET',
    `  source: ${input.source}${input.sourcePath ? ` (${input.sourcePath})` : ''}`,
    `  host: ${input.target.host}`,
    `  port: ${input.target.port}`,
    `  database: ${input.runtimeDatabase || input.target.database || '(unknown)'}`,
    `  environment: ${input.target.environment}`,
    `  candidateTable: ${SCALAR_COMPENSATION_CANDIDATE_TABLE}`,
    `  tablePresent: ${input.tablePresent === null ? 'unchecked' : String(input.tablePresent)}`,
    `  scannedRows: ${input.scannedRows === null ? 'unchecked' : String(input.scannedRows)}`,
  ];
  return lines.join('\n');
}

export function parseDotenvDatabaseUrl(contents: string): string | undefined {
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^DATABASE_URL\s*=\s*(.*)$/);
    if (!match) continue;
    return stripEnvQuotes(match[1]);
  }
  return undefined;
}

function urlFromEnvFile(
  path: string,
  readFile: (path: string) => string | null,
  label: string
):
  | { ok: true; url: string; source: 'env-file'; sourcePath: string }
  | { ok: false; error: string } {
  const contents = readFile(path);
  if (contents == null) {
    return { ok: false, error: `DATABASE_URL file not found (${label}): ${path}` };
  }
  const raw = parseDotenvDatabaseUrl(contents);
  const checked = isUnusableDatabaseUrl(raw);
  if (checked.unusable) {
    return { ok: false, error: `${checked.reason} in ${label}` };
  }
  return { ok: true, url: checked.url, source: 'env-file', sourcePath: path };
}

function environmentLabelForHost(host: string): BackfillEnvironmentLabel {
  const lower = host.toLowerCase();
  if (lower.includes('supabase.co') || lower.includes('supabase.com')) return 'supabase';
  if (lower.includes('neon.tech')) return 'neon';
  if (lower.includes('render.com') || lower.startsWith('dpg-')) return 'render';
  return 'unknown';
}

function readFlagValue(argv: string[], flag: string): string | null {
  const prefix = `${flag}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length).trim() || null;
  const index = argv.indexOf(flag);
  if (index >= 0 && argv[index + 1] && !argv[index + 1].startsWith('-')) {
    return argv[index + 1].trim() || null;
  }
  return null;
}

function stripEnvQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}
