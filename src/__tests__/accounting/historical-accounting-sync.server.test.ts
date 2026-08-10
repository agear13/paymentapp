jest.mock('@/lib/xero/queue-service', () => ({
  queueXeroSync: jest.fn(),
}));

jest.mock('@/lib/xero', () => ({
  getConnectionStatus: jest.fn(),
}));

jest.mock('@/lib/auth/organization-access', () => ({
  hasOrganizationPermission: jest.fn(),
}));

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    payment_links: {
      findMany: jest.fn(),
    },
    audit_logs: {
      create: jest.fn(),
    },
  },
}));

import { executeHistoricalAccountingSync } from '@/lib/accounting/historical-accounting-sync.server';
import { queueXeroSync } from '@/lib/xero/queue-service';
import { getConnectionStatus } from '@/lib/xero';
import { hasOrganizationPermission } from '@/lib/auth/organization-access';
import { prisma } from '@/lib/server/prisma';

const findMany = prisma.payment_links.findMany;
const auditCreate = prisma.audit_logs.create;

describe('historical accounting sync server execute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hasOrganizationPermission.mockResolvedValue(true);
    getConnectionStatus.mockResolvedValue({ connected: true });
    auditCreate.mockResolvedValue({});
  });

  it('queues selected sync types via queueXeroSync (idempotent path)', async () => {
    findMany.mockResolvedValue([
      {
        id: 'link-1',
        status: 'PAID',
        invoice_reference: 'INV-100',
        short_code: 'SC100001',
        customer_name: 'Client',
        customer_email: null,
        invoice_date: null,
        created_at: new Date('2026-01-01'),
        amount: 500,
        invoice_currency: 'AUD',
        currency: 'AUD',
        settlement_amount: 500,
        xero_syncs: [],
      },
    ]);
    queueXeroSync.mockResolvedValue('sync-id-1');

    const result = await executeHistoricalAccountingSync({
      userId: 'user-1',
      organizationId: 'org-1',
      syncAll: true,
    });

    expect(result.queued).toBe(2);
    expect(queueXeroSync).toHaveBeenCalledTimes(2);
    expect(queueXeroSync).toHaveBeenCalledWith({
      paymentLinkId: 'link-1',
      organizationId: 'org-1',
      syncType: 'INVOICE',
    });
    expect(queueXeroSync).toHaveBeenCalledWith({
      paymentLinkId: 'link-1',
      organizationId: 'org-1',
      syncType: 'PAYMENT',
    });
  });

  it('skips already synced invoices on execute', async () => {
    findMany.mockResolvedValue([
      {
        id: 'synced',
        status: 'PAID',
        invoice_reference: 'INV-200',
        short_code: 'SC200001',
        customer_name: null,
        customer_email: null,
        invoice_date: null,
        created_at: new Date('2026-01-02'),
        amount: 100,
        invoice_currency: 'AUD',
        currency: 'AUD',
        settlement_amount: 100,
        xero_syncs: [
          { sync_type: 'INVOICE', status: 'SUCCESS', xero_invoice_id: 'inv-1' },
          { sync_type: 'PAYMENT', status: 'SUCCESS', xero_payment_id: 'pay-1' },
        ],
      },
    ]);

    const result = await executeHistoricalAccountingSync({
      userId: 'user-1',
      organizationId: 'org-1',
      syncAll: true,
    });

    expect(result.queued).toBe(0);
    expect(queueXeroSync).not.toHaveBeenCalled();
  });

  it('does not duplicate queue items when called twice (relies on queueXeroSync upsert)', async () => {
    findMany.mockResolvedValue([
      {
        id: 'link-1',
        status: 'OPEN',
        invoice_reference: null,
        short_code: 'SC300001',
        customer_name: null,
        customer_email: null,
        invoice_date: null,
        created_at: new Date('2026-01-03'),
        amount: 50,
        invoice_currency: 'AUD',
        currency: 'AUD',
        settlement_amount: null,
        xero_syncs: [],
      },
    ]);
    queueXeroSync.mockResolvedValue('same-sync-id');

    await executeHistoricalAccountingSync({
      userId: 'user-1',
      organizationId: 'org-1',
      syncAll: true,
    });
    await executeHistoricalAccountingSync({
      userId: 'user-1',
      organizationId: 'org-1',
      syncAll: true,
    });

    expect(queueXeroSync).toHaveBeenCalledTimes(2);
    expect(queueXeroSync.mock.calls[0][0]).toEqual({
      paymentLinkId: 'link-1',
      organizationId: 'org-1',
      syncType: 'INVOICE',
    });
  });
});
