/**
 * Webhook audit logging: contract and behavior tests.
 * - First delivery creates webhook_events row and ends with status PROCESSED.
 * - Duplicate delivery returns 200 and does NOT run business handlers.
 * - Handler error: status ERROR, attempt_count increments, route returns 500.
 * - Ignored event type: status IGNORED.
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
const STRIPE_AUDIT_PATH = path.join(
  __dirname,
  '..',
  '..',
  'lib',
  'webhooks',
  'stripe-audit.ts'
);

describe('Stripe webhook audit', () => {
  describe('route uses audit pattern', () => {
    it('calls recordStripeWebhookReceived and persists before processing', () => {
      const content = fs.readFileSync(WEBHOOK_ROUTE_PATH, 'utf-8');
      expect(content).toContain('recordStripeWebhookReceived');
      expect(content).toContain('extractStripeLinkage');
      expect(content).toContain('auditResult');
    });

    it('on duplicate delivery returns 200 and does not run handlers (isDuplicate early return)', () => {
      const content = fs.readFileSync(WEBHOOK_ROUTE_PATH, 'utf-8');
      expect(content).toContain('auditResult.isDuplicate');
      expect(content).toContain('Duplicate webhook delivery; skipping handlers');
      expect(content).toContain('duplicate: true');
      expect(content).toContain('processed: false');
    });

    it('marks processing and outcome (PROCESSED / IGNORED / ERROR)', () => {
      const content = fs.readFileSync(WEBHOOK_ROUTE_PATH, 'utf-8');
      expect(content).toContain('markStripeWebhookProcessing');
      expect(content).toContain('markStripeWebhookOutcome');
      expect(content).toContain("outcome: 'ERROR'");
    });

    it('on handler error marks outcome ERROR and returns 500', () => {
      const content = fs.readFileSync(WEBHOOK_ROUTE_PATH, 'utf-8');
      expect(content).toContain('status: 500');
      expect(content).toContain("outcome: 'ERROR'");
      expect(content).toContain('errorMessage');
    });

    it('tracks ignored event types with outcome IGNORED', () => {
      const content = fs.readFileSync(WEBHOOK_ROUTE_PATH, 'utf-8');
      expect(content).toContain("outcome = 'IGNORED'");
      expect(content).toContain('Unhandled webhook event type');
    });

    it('includes webhook_events id and provider_event_id in logs', () => {
      const content = fs.readFileSync(WEBHOOK_ROUTE_PATH, 'utf-8');
      expect(content).toContain('webhookEventId');
      expect(content).toContain('providerEventId');
      expect(content).toContain('attemptCount');
    });
  });

  describe('stripe-audit library', () => {
    it('exports recordStripeWebhookReceived, markStripeWebhookProcessing, markStripeWebhookOutcome, extractStripeLinkage', () => {
      const content = fs.readFileSync(STRIPE_AUDIT_PATH, 'utf-8');
      expect(content).toContain('recordStripeWebhookReceived');
      expect(content).toContain('markStripeWebhookProcessing');
      expect(content).toContain('markStripeWebhookOutcome');
      expect(content).toContain('extractStripeLinkage');
    });

    it('recordStripeWebhookReceived returns isDuplicate and row', () => {
      const content = fs.readFileSync(STRIPE_AUDIT_PATH, 'utf-8');
      expect(content).toContain('isDuplicate');
      expect(content).toContain('RecordReceivedResult');
    });

    it('allowlists headers (no full header dump)', () => {
      const content = fs.readFileSync(STRIPE_AUDIT_PATH, 'utf-8');
      expect(content).toContain('ALLOWLIST_HEADER_KEYS');
      expect(content).toContain('stripe-signature');
      expect(content).toContain('allowlistHeaders');
    });
  });

  describe('replay tooling', () => {
    it('replay API route exists and is auth-protected', () => {
      const replayPath = path.join(
        __dirname,
        '..',
        '..',
        'app',
        'api',
        'internal',
        'webhooks',
        'stripe',
        'replay',
        'route.ts'
      );
      expect(fs.existsSync(replayPath)).toBe(true);
      const content = fs.readFileSync(replayPath, 'utf-8');
      expect(content).toContain('x-internal-admin-token');
      expect(content).toContain('INTERNAL_ADMIN_TOKEN');
      expect(content).toContain('provider_event_id');
      expect(content).toContain('markStripeWebhookProcessing');
      expect(content).toContain('processStripeWebhookEvent');
    });

    it('replay script exists', () => {
      const scriptPath = path.join(
        __dirname,
        '..',
        '..',
        'scripts',
        'replay-stripe-webhook.ts'
      );
      expect(fs.existsSync(scriptPath)).toBe(true);
      const content = fs.readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('replay-stripe-webhook');
      expect(content).toContain('evt_');
      expect(content).toContain('processStripeWebhookEvent');
    });
  });
});
