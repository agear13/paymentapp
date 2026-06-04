/**
 * B1: Xero debug endpoint removed — no global cross-tenant diagnostics.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

const DEBUG_ROUTE = path.join(ROOT, 'app', 'api', 'xero', 'debug', 'route.ts');
const XERO_SYNC_QUEUE = path.join(
  ROOT,
  'components',
  'dashboard',
  'settings',
  'xero-sync-queue.tsx'
);
const SYNC_STATS_ROUTE = path.join(ROOT, 'app', 'api', 'xero', 'sync', 'stats', 'route.ts');
const SYNC_FAILED_ROUTE = path.join(ROOT, 'app', 'api', 'xero', 'sync', 'failed', 'route.ts');

describe('B1 — xero debug removed', () => {
  it('does not ship GET /api/xero/debug route handler', () => {
    expect(fs.existsSync(DEBUG_ROUTE)).toBe(false);
  });

  it('settings UI does not link to /api/xero/debug', () => {
    const source = fs.readFileSync(XERO_SYNC_QUEUE, 'utf-8');
    expect(source).not.toContain('/api/xero/debug');
    expect(source).not.toContain('View detailed sync diagnostics');
  });
});

describe('B1 — org-scoped Xero sync APIs preserved', () => {
  it('sync stats route requires organization_id', () => {
    const source = fs.readFileSync(SYNC_STATS_ROUTE, 'utf-8');
    expect(source).toContain('organization_id');
    expect(source).toContain('hasOrganizationPermission');
  });

  it('sync failed route requires organization_id', () => {
    const source = fs.readFileSync(SYNC_FAILED_ROUTE, 'utf-8');
    expect(source).toContain('organization_id');
    expect(source).toContain('hasOrganizationPermission');
  });
});

const BACKFILL_ROUTE = path.join(ROOT, 'app', 'api', 'xero', 'queue', 'backfill', 'route.ts');
const BACKFILL_SERVER = path.join(ROOT, 'lib', 'xero', 'xero-backfill.server.ts');

describe('Xero backfill tenant scoping', () => {
  it('backfill route uses authorizeXeroBackfill (not global PAID scan)', () => {
    const routeSource = fs.readFileSync(BACKFILL_ROUTE, 'utf-8');
    expect(routeSource).toContain('authorizeXeroBackfill');
    expect(routeSource).not.toContain("where: { status: 'PAID' }");
  });

  it('backfill server enforces organization_id and manage_settings', () => {
    const serverSource = fs.readFileSync(BACKFILL_SERVER, 'utf-8');
    expect(serverSource).toContain('hasOrganizationPermission');
    expect(serverSource).toContain('organization_id: organizationId');
    expect(serverSource).toContain('checkAdminAuth');
  });
});
