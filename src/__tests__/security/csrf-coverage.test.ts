import fs from 'node:fs';
import path from 'node:path';
import { CSRF_EXEMPT_PATH_PREFIXES } from '@/lib/security/csrf-policy';

const API_ROOT = path.join(process.cwd(), 'app', 'api');
const MUTATING_FN = /export async function (POST|PUT|PATCH|DELETE)\b/;
const CSRF_GUARD =
  /getCurrentUserForApi\(|requireAuth\(request|requireAuth\(req|requireUser\(request|requireUser\(req|enforceCsrfForRequest\(|verifyCronRequest\(|isAuthorizedCron\(|isValidInternalAdminRequest\(|requireAdminForApi\(|getAuthedParticipantForProgram\(|requireAgreementAnalyzerDashboardForApi\(/;
const LEGACY_UNGUARDED = /getCurrentUser\(\)|await requireAuth\(\)/;

function mutatingHandlers(content: string): string[] {
  const chunks = content.split(/(?=export async function )/);
  return chunks.filter((chunk) => {
    const match = chunk.match(/^export async function (POST|PUT|PATCH|DELETE)\b/);
    return Boolean(match);
  });
}

function walk(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    if (entry.name === 'route.ts') return [full];
    return [];
  });
}

function routePathFromFile(file: string): string {
  const rel = path.relative(API_ROOT, file).replace(/\\/g, '/');
  const segments = rel.split('/').slice(0, -1);
  return `/api/${segments.join('/')}`;
}

describe('CSRF coverage matrix', () => {
  const routes = walk(API_ROOT);

  it('has no unguarded legacy auth patterns in mutating route files', () => {
    const offenders: string[] = [];

    for (const file of routes) {
      const content = fs.readFileSync(file, 'utf8');
      const handlers = mutatingHandlers(content);
      if (!handlers.length) continue;
      if (handlers.some((handler) => LEGACY_UNGUARDED.test(handler))) {
        offenders.push(path.relative(process.cwd(), file));
      }
    }

    expect(offenders).toEqual([]);
  });

  it('documents intentional CSRF exemptions', () => {
    expect(CSRF_EXEMPT_PATH_PREFIXES).toEqual(
      expect.arrayContaining([
        '/api/public/',
        '/api/stripe/webhook',
        '/api/jobs/',
        '/api/auth/',
      ])
    );
  });

  it('every non-exempt mutating route file uses a CSRF guard import', () => {
    const missing: string[] = [];

    for (const file of routes) {
      const content = fs.readFileSync(file, 'utf8');
      const handlers = mutatingHandlers(content);
      if (!handlers.length) continue;

      const route = routePathFromFile(file);
      if (CSRF_EXEMPT_PATH_PREFIXES.some((prefix) => route.startsWith(prefix))) continue;

      if (handlers.some((handler) => !CSRF_GUARD.test(handler))) {
        missing.push(`${route} (${path.relative(process.cwd(), file)})`);
      }
    }

    expect(missing).toEqual([]);
  });
});
