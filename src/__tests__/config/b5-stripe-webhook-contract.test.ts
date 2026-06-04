const fs = require('fs');
const path = require('path');

const WEBHOOK_ROUTE = path.join(
  __dirname,
  '..',
  '..',
  'app',
  'api',
  'stripe',
  'webhook',
  'route.ts'
);

const ENV_PATH = path.join(__dirname, '..', '..', 'lib', 'config', 'env.ts');

describe('B5 Stripe webhook contract', () => {
  it('env.ts invokes production guards after Zod parse', () => {
    const source = fs.readFileSync(ENV_PATH, 'utf-8');
    expect(source).toContain('assertProductionEnvGuards');
  });

  it('webhook route still guards disabled secret at request time (defense in depth)', () => {
    const source = fs.readFileSync(WEBHOOK_ROUTE, 'utf-8');
    expect(source).toContain("'disabled'");
    expect(source).toContain('confirmPayment');
  });
});
