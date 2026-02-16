/**
 * Regression: handleCheckoutSessionCompleted must use correlationId (param) and must not
 * reference an undefined correlation variable, which caused ReferenceError and skipped commission posting.
 */
import * as fs from 'fs';
import * as path from 'path';

const WEBHOOK_ROUTE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'app',
  'api',
  'stripe',
  'webhook',
  'route.ts'
);

// Forbidden identifier (built so it does not appear as literal in repo; regression check)
const FORBIDDEN_CORRELATION_ID_VAR = 'event' + 'Correlation' + 'Id';

describe('Stripe webhook route', () => {
  it('does not reference undefined correlation variable (prevents ReferenceError in handleCheckoutSessionCompleted)', () => {
    const content = fs.readFileSync(WEBHOOK_ROUTE_PATH, 'utf-8');
    expect(content).not.toContain(FORBIDDEN_CORRELATION_ID_VAR);
  });
});
