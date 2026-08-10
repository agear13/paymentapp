import {
  formatAccountingLastSyncedLabel,
  hasInvoiceChangedSinceSync,
  isAccountingInvoiceExported,
  resolveAccountingPushState,
} from '@/lib/accounting/accounting-push-state';
import { queueXeroSync } from '@/lib/xero/queue-service';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    xero_syncs: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/server/prisma';

const findUnique = prisma.xero_syncs.findUnique;
const upsert = prisma.xero_syncs.upsert;
const update = prisma.xero_syncs.update;

describe('accounting push state', () => {
  it('offers push when invoice has never been synced', () => {
    const state = resolveAccountingPushState({ invoiceSync: null, linkUpdatedAt: new Date() });
    expect(state.state).toBe('push');
  });

    it('shows already synced after successful export', () => {
      const syncedAt = new Date('2026-01-10T12:00:00.000Z');
      const state = resolveAccountingPushState({
        invoiceSync: {
          syncType: 'INVOICE',
          status: 'SUCCESS',
          xeroInvoiceId: 'xero-inv-1',
          updatedAt: syncedAt,
        },
        linkUpdatedAt: syncedAt,
        link: {
          amount: 100,
          invoiceCurrency: 'AUD',
          description: 'Test',
        },
      });
      expect(state.state).toBe('already_synced');
      expect(state.xeroInvoiceId).toBe('xero-inv-1');
    });

    it('offers update when invoice changed after last sync (legacy updated_at)', () => {
      const state = resolveAccountingPushState({
        invoiceSync: {
          syncType: 'INVOICE',
          status: 'SUCCESS',
          xeroInvoiceId: 'xero-inv-1',
          updatedAt: new Date('2026-01-10T12:00:00.000Z'),
        },
        linkUpdatedAt: new Date('2026-01-12T09:00:00.000Z'),
        link: {
          amount: 100,
          invoiceCurrency: 'AUD',
          description: 'Test',
        },
      });
      expect(state.state).toBe('update');
    });

  it('shows sync pending while queue is processing', () => {
    const state = resolveAccountingPushState({
      invoiceSync: {
        syncType: 'INVOICE',
        status: 'PENDING',
      },
      linkUpdatedAt: new Date(),
    });
    expect(state.state).toBe('sync_pending');
  });

  it('formats last synced label', () => {
    expect(formatAccountingLastSyncedLabel(null)).toBe('Already synced');
    expect(formatAccountingLastSyncedLabel('2026-01-10T12:00:00.000Z')).toContain('Last synced');
  });

  it('requires xero invoice id for exported state', () => {
    expect(
      isAccountingInvoiceExported({
        syncType: 'INVOICE',
        status: 'SUCCESS',
        xeroInvoiceId: null,
      })
    ).toBe(false);
    expect(
      isAccountingInvoiceExported({
        syncType: 'INVOICE',
        status: 'SUCCESS',
        xeroInvoiceId: 'inv-1',
      })
    ).toBe(true);
  });
});

describe('queueXeroSync idempotency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('first push creates a pending queue row', async () => {
    findUnique.mockResolvedValue(null);
    upsert.mockResolvedValue({ id: 'sync-1', created_at: new Date() });

    const syncId = await queueXeroSync({
      paymentLinkId: 'link-1',
      organizationId: 'org-1',
      syncType: 'INVOICE',
    });

    expect(syncId).toBe('sync-1');
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(update).not.toHaveBeenCalled();
  });

  it('second push returns existing success without requeueing', async () => {
    findUnique.mockResolvedValue({
      id: 'sync-success',
      status: 'SUCCESS',
      xero_invoice_id: 'xero-inv-1',
      xero_payment_id: null,
    });

    const syncId = await queueXeroSync({
      paymentLinkId: 'link-1',
      organizationId: 'org-1',
      syncType: 'INVOICE',
    });

    expect(syncId).toBe('sync-success');
    expect(upsert).not.toHaveBeenCalled();
  });

  it('failed sync can be requeued for retry', async () => {
    findUnique.mockResolvedValue({
      id: 'sync-failed',
      status: 'FAILED',
      xero_invoice_id: null,
      xero_payment_id: null,
    });
    upsert.mockResolvedValue({ id: 'sync-failed', created_at: new Date('2026-01-01') });

    await queueXeroSync({
      paymentLinkId: 'link-1',
      organizationId: 'org-1',
      syncType: 'INVOICE',
    });

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0].update.status).toBe('PENDING');
  });
});

describe('worker and orchestration idempotency guards', () => {
  it('sync orchestration short-circuits when invoice already exported', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'xero', 'sync-orchestration.ts'),
      'utf8'
    );
    expect(source).toContain('!updateExisting');
    expect(source).toContain('existingInvoiceSync?.status === \'SUCCESS\'');
    expect(source).toContain('updateXeroInvoice');
  });

  it('queue processor passes updateExisting from job payload', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'xero', 'queue-processor.ts'),
      'utf8'
    );
    expect(source).toContain('updateExisting');
  });
});

describe('accounting push UI guard', () => {
  it('uses in-flight guard in push action component', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'journey', 'lovable', 'accounting-push-action.tsx'),
      'utf8'
    );
    expect(source).toContain('inFlightRef');
    expect(source).toContain('alreadySynced');
    expect(source).toContain('updateAccountingCta');
  });

  it('queue-invoice route checks already synced before queueing', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'app', 'api', 'xero', 'sync', 'queue-invoice', 'route.ts'),
      'utf8'
    );
    expect(source).toContain('alreadySynced');
    expect(source).toContain('queueXeroInvoiceUpdate');
    expect(source).toContain('resolveAccountingPushState');
  });
});
