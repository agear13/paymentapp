const fs = require('fs');
const path = require('path');

const RENDER_YAML = path.join(__dirname, '..', '..', '..', 'render.yaml');
const CRON_INVOKE = path.join(__dirname, '..', '..', 'scripts', 'render-cron-invoke.mjs');
const XERO_PROCESS = path.join(
  __dirname,
  '..',
  '..',
  'app',
  'api',
  'xero',
  'queue',
  'process',
  'route.ts'
);
const STRIPE_WEBHOOK = path.join(
  __dirname,
  '..',
  '..',
  'app',
  'api',
  'stripe',
  'webhook',
  'route.ts'
);

describe('B3 render cron invoke registry', () => {
  const source = fs.readFileSync(CRON_INVOKE, 'utf-8');

  it('defines all critical production targets', () => {
    const required = [
      'expired-links',
      'recurring-templates',
      'stuck-payments',
      'stripe-reconciliation',
      'ledger-integrity',
      'xero-queue',
      'system-integrity',
      'monitoring-alerts',
      'agreement-analyzer-jobs',
    ];
    for (const target of required) {
      expect(source).toContain(`'${target}'`);
    }
  });

  it('requires CRON_SECRET and base URL before fetch', () => {
    expect(source).toContain('CRON_SECRET is not set');
    expect(source).toContain('CRON_BASE_URL or NEXT_PUBLIC_APP_URL');
    expect(source).toContain('validateCronInvokeEnvironment');
  });

  it('routes agreement analyzer jobs to the secured queue processor', () => {
    expect(source).toContain("path: '/api/agreement-analyzer/jobs/process'");
    expect(source).toContain("auth: 'bearer'");
  });
});

describe('B3 render.yaml cron services', () => {
  const yaml = fs.readFileSync(RENDER_YAML, 'utf-8');

  it('enables cron services that invoke render-cron-invoke.mjs', () => {
    expect(yaml).toContain('type: cron');
    expect(yaml).toContain('render-cron-invoke.mjs expired-links');
    expect(yaml).toContain('render-cron-invoke.mjs xero-queue');
    expect(yaml).toContain('render-cron-invoke.mjs stripe-reconciliation');
    expect(yaml).toContain('render-cron-invoke.mjs agreement-analyzer-jobs');
    expect(yaml).toContain('provvypay-cron-agreement-analyzer-jobs');
  });

  it('preserves web health check', () => {
    expect(yaml).toContain('type: web');
    expect(yaml).toContain('healthCheckPath: /api/health');
  });

  it('does not enable a separate worker process', () => {
    expect(yaml).not.toMatch(/^\s+-\s+type:\s+worker/m);
  });
});

describe('B3 xero queue process auth hardening', () => {
  const routeSource = fs.readFileSync(XERO_PROCESS, 'utf-8');

  it('uses shared cron auth and rejects when secret missing', () => {
    expect(routeSource).toContain('verifyCronRequest');
    expect(routeSource).toContain('cronAuthFailureResponse');
    expect(routeSource).not.toMatch(/if \(cronSecret && authHeader/);
  });
});

describe('B3 payment flows unaffected', () => {
  const webhookSource = fs.readFileSync(STRIPE_WEBHOOK, 'utf-8');

  it('stripe webhook still uses confirmPayment', () => {
    expect(webhookSource).toContain('confirmPayment({');
    expect(webhookSource).toContain("provider: 'stripe'");
  });
});
