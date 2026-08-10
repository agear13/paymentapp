/**
 * Commercial invoice workflows must not depend on accounting integration.
 * Accounting readiness gates sync only (Push to Accounting), not CRUD.
 */

import fs from 'fs';
import path from 'path';
import { computeXeroReadiness } from '@/lib/commercial-os/xero-readiness';

const SRC_ROOT = path.join(__dirname, '..', '..');

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relativePath), 'utf8');
}

describe('commercial invoice accounting independence', () => {
  describe('create-invoice gate (UI)', () => {
    it('does not block or redirect based on accounting readiness', () => {
      const gateSource = readSrc('components/journey/lovable/commercial-os-create-invoice-gate.tsx');
      expect(gateSource).not.toMatch(/canCreateInvoice|canSyncToAccounting|connectedXero/);
      expect(gateSource).not.toMatch(/CommercialOsCreateInvoiceBlocked/);
      expect(gateSource).toContain('Pass-through wrapper');
      expect(gateSource).toContain('COMMERCIAL_OS_ROUTES.createInvoice');
    });

    it('create-invoice screen does not wrap the form in a blocking gate', () => {
      const screenSource = readSrc('components/journey/lovable/workspace-create-invoice-screen.tsx');
      expect(screenSource).not.toMatch(/CommercialOsCreateInvoiceGate/);
      expect(screenSource).toContain('AccountingIntegrationNotice');
    });

    it('workspace start screen routes create-invoice directly', () => {
      const startSource = readSrc('components/journey/lovable/workspace-start-screen.tsx');
      expect(startSource).not.toMatch(/canCreateInvoice|connectedXero/);
      expect(startSource).toContain("router.push(card.to)");
    });
  });

  describe('invoice API routes (server)', () => {
    const commercialApiPaths = [
      'app/api/payment-links/route.ts',
      'app/api/payment-links/[id]/route.ts',
      'app/api/payment-links/[id]/send/route.ts',
      'app/api/payment-links/[id]/resend/route.ts',
    ];

    it.each(commercialApiPaths)('%s does not require Xero connection for invoice CRUD', (apiPath) => {
      const source = readSrc(apiPath);
      expect(source).not.toMatch(/getConnectionStatus|canCreateInvoice|Connect Xero/);
    });

    it('queue-invoice is the dedicated push endpoint with connection check', () => {
      const source = readSrc('app/api/xero/sync/queue-invoice/route.ts');
      expect(source).toContain('getConnectionStatus');
      expect(source).toContain('queueXeroSync');
    });
  });

  describe('readiness flags gate sync only', () => {
    it('canSyncToAccounting is false when accounting is not connected', () => {
      const result = computeXeroReadiness({
        status: { connected: false },
        mappings: null,
        chartAccountCodes: null,
        chartLoaded: false,
        queue: { pendingCount: 0, hasRecentFailures: false },
        merchantRails: {
          stripeEnabled: false,
          wiseEnabled: false,
          stablecoinSettlementsEnabled: false,
          manualBankEnabled: false,
        },
      });
      expect(result.canSyncToAccounting).toBe(false);
      expect(result.canCreateInvoice).toBe(false);
    });

    it('canSyncToAccounting is true when mappings are complete (sync-ready)', () => {
      const result = computeXeroReadiness({
        status: { connected: true, tenantId: 'tenant-1' },
        mappings: {
          xero_revenue_account_id: '200',
          xero_receivable_account_id: '610',
          xero_stripe_clearing_account_id: '105',
        },
        chartAccountCodes: new Set(['200', '610', '105']),
        chartLoaded: true,
        queue: { pendingCount: 0, hasRecentFailures: false },
        merchantRails: {
          stripeEnabled: true,
          wiseEnabled: false,
          stablecoinSettlementsEnabled: false,
          manualBankEnabled: false,
        },
      });
      expect(result.canSyncToAccounting).toBe(true);
    });
  });

  describe('push action uses readiness for sync only', () => {
    it('AccountingPushAction checks canSyncToAccounting not invoice creation', () => {
      const source = readSrc('components/journey/lovable/accounting-push-action.tsx');
      expect(source).toContain('canSyncToAccounting');
      expect(source).toContain('queue-invoice');
      expect(source).not.toMatch(/createInvoice|CommercialOsCreateInvoiceGate/);
    });
  });

  describe('post-create sync is async and non-blocking', () => {
    it('queues Xero sync after invoice creation without connection guard', () => {
      const source = readSrc('lib/payment-links/payment-link-post-create.ts');
      expect(source).toContain('queueXeroSync');
      expect(source).not.toMatch(/getConnectionStatus/);
      expect(source).toMatch(/Failed to queue initial Xero invoice sync/);
    });
  });
});
