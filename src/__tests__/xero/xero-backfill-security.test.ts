const fs = require('fs');
const path = require('path');

const BACKFILL_ROUTE = path.join(
  __dirname,
  '..',
  '..',
  'app',
  'api',
  'xero',
  'queue',
  'backfill',
  'route.ts'
);
const BACKFILL_SERVER = path.join(
  __dirname,
  '..',
  '..',
  'lib',
  'xero',
  'xero-backfill.server.ts'
);
const BACKFILL_TRACE = path.join(
  __dirname,
  '..',
  '..',
  'lib',
  'xero',
  'xero-backfill-trace.ts'
);
const XERO_SYNC_QUEUE = path.join(
  __dirname,
  '..',
  '..',
  'components',
  'dashboard',
  'settings',
  'xero-sync-queue.tsx'
);
const QUEUE_SERVICE = path.join(__dirname, '..', '..', 'lib', 'xero', 'queue-service.ts');
const CONFIRM_PAYMENT = path.join(
  __dirname,
  '..',
  '..',
  'lib',
  'services',
  'payment-confirmation.ts'
);

describe('Xero backfill authorization (tenant scoping)', () => {
  const routeSource = fs.readFileSync(BACKFILL_ROUTE, 'utf-8');
  const serverSource = fs.readFileSync(BACKFILL_SERVER, 'utf-8');
  const traceSource = fs.readFileSync(BACKFILL_TRACE, 'utf-8');
  const uiSource = fs.readFileSync(XERO_SYNC_QUEUE, 'utf-8');

  it('route delegates to authorizeXeroBackfill before processing', () => {
    expect(routeSource).toContain('authorizeXeroBackfill');
    expect(routeSource).toContain('executeXeroBackfill');
    expect(routeSource).toContain('previewXeroBackfill');
    expect(routeSource).not.toMatch(
      /payment_links\.findMany\([\s\S]*status:\s*'PAID'[\s\S]*\)(?!.*organization)/
    );
  });

  it('server scopes queries by organization_id when not global', () => {
    expect(serverSource).toContain('organization_id: organizationId');
    expect(serverSource).toContain('hasOrganizationPermission');
    expect(serverSource).toContain("'manage_settings'");
    expect(serverSource).not.toContain("where: { status: 'PAID' }");
  });

  it('global scope requires checkAdminAuth', () => {
    expect(serverSource).toContain('checkAdminAuth');
    expect(serverSource).toContain("scope: 'global'");
    expect(serverSource).toContain('BACKFILL_GLOBAL_ADMIN_REQUIRED');
  });

  it('does not run global scan without organization filter in execute path', () => {
    const executeSection = serverSource.split('executeXeroBackfill')[1] ?? '';
    expect(executeSection).toContain('paidLinksMissingSyncWhere');
    expect(executeSection).not.toMatch(
      /findMany\(\{\s*where:\s*\{\s*status:\s*'PAID'\s*\}/
    );
  });

  it('emits backfill observability stages', () => {
    expect(traceSource).toContain('backfill_requested');
    expect(traceSource).toContain('backfill_completed');
    expect(traceSource).toContain('backfill_denied');
    expect(serverSource).toContain('xeroBackfillTrace');
  });

  it('writes audit log on execute', () => {
    expect(serverSource).toContain('audit_logs.create');
    expect(serverSource).toContain('XERO_BACKFILL_EXECUTED');
  });

  it('UI sends organizationId and organization scope', () => {
    expect(uiSource).toContain("scope: 'organization'");
    expect(uiSource).toContain('organizationId');
  });
});

describe('Xero backfill — cross-tenant denial (contract)', () => {
  const serverSource = fs.readFileSync(BACKFILL_SERVER, 'utf-8');

  it('denies missing organization for merchant scope', () => {
    expect(serverSource).toContain('BACKFILL_ORGANIZATION_REQUIRED');
  });

  it('denies without manage_settings permission', () => {
    expect(serverSource).toContain('BACKFILL_FORBIDDEN');
  });
});

describe('Existing Xero sync paths unchanged', () => {
  const confirmSource = fs.readFileSync(CONFIRM_PAYMENT, 'utf-8');
  const queueSource = fs.readFileSync(QUEUE_SERVICE, 'utf-8');

  it('confirmPayment still upserts xero_syncs in settlement txn', () => {
    expect(confirmSource).toContain('xero_syncs.upsert');
  });

  it('queueXeroSync export preserved for backfill', () => {
    expect(queueSource).toContain('export async function queueXeroSync');
    expect(fs.readFileSync(BACKFILL_SERVER, 'utf-8')).toContain('queueXeroSync');
  });
});
