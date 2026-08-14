/**
 * @jest-environment node
 */

const mockGetInvoices = jest.fn();
const mockCreateInvoices = jest.fn();
const mockUpdateTenants = jest.fn();
const mockGetOrCreateXeroContact = jest.fn();
const mockAssertAvailable = jest.fn();

jest.mock('@/lib/xero/client', () => ({
  getXeroClient: () => ({
    accountingApi: {
      getInvoices: mockGetInvoices,
      createInvoices: mockCreateInvoices,
    },
    updateTenants: mockUpdateTenants,
  }),
}));

jest.mock('@/lib/xero/apply-connection-token-set', () => ({
  applyConnectionToXeroClient: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/xero/connection-service', () => ({
  getActiveConnection: jest.fn().mockResolvedValue({
    id: 'conn-1',
    organizationId: 'org-1',
    tenantId: 'tenant-1',
    accessToken: 'token',
    refreshToken: 'refresh',
    expiresAt: new Date(Date.now() + 3600_000),
    connectedAt: new Date(),
  }),
}));

jest.mock('@/lib/xero/xero-contact-service', () => ({
  getOrCreateXeroContact: (...args: unknown[]) => mockGetOrCreateXeroContact(...args),
  CASH_CUSTOMER_NAME: 'Cash Customer',
}));

jest.mock('@/lib/xero/xero-invoice-number-suggestion.server', () => ({
  assertXeroInvoiceNumberAvailableForCreate: (...args: unknown[]) => mockAssertAvailable(...args),
}));

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    merchant_settings: {
      findFirst: jest.fn().mockResolvedValue({
        xero_revenue_account_id: '200',
        xero_receivable_account_id: '1200',
        default_currency: 'AUD',
      }),
    },
    payment_links: {
      findUnique: jest.fn().mockResolvedValue({
        invoice_date: new Date('2026-08-01'),
        due_date: new Date('2026-08-15'),
        amount: '100',
        base_amount: null,
        base_currency: null,
      }),
    },
  },
}));

import { createXeroInvoice } from '@/lib/xero/invoice-service';
import { XeroInvoiceNumberConflictError } from '@/lib/xero/xero-invoice-number-conflict';

describe('createXeroInvoice InvoiceNumber export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOrCreateXeroContact.mockResolvedValue({ contactID: 'contact-1' });
    mockCreateInvoices.mockResolvedValue({
      body: {
        invoices: [
          {
            invoiceID: 'xero-inv-1',
            invoiceNumber: 'INV-00484',
            status: 'AUTHORISED',
            total: 100,
          },
        ],
      },
    });
    mockAssertAvailable.mockResolvedValue(undefined);
  });

  it('checks duplicate availability and sends InvoiceNumber on create', async () => {
    const result = await createXeroInvoice({
      paymentLinkId: 'pl-1',
      organizationId: 'org-1',
      amount: '100.00',
      currency: 'AUD',
      description: 'Consulting',
      invoiceReference: 'INV-00484',
    });

    expect(mockAssertAvailable).toHaveBeenCalledWith('org-1', 'INV-00484');
    expect(mockCreateInvoices).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        invoices: [
          expect.objectContaining({
            invoiceNumber: 'INV-00484',
            reference: 'INV-00484',
          }),
        ],
      })
    );
    expect(result.invoiceNumber).toBe('INV-00484');
    expect(result.invoiceId).toBe('xero-inv-1');
  });

  it('does not assign InvoiceNumber when reference is not a parseable candidate', async () => {
    await createXeroInvoice({
      paymentLinkId: 'pl-1',
      organizationId: 'org-1',
      amount: '100.00',
      currency: 'AUD',
      description: 'Consulting',
      invoiceReference: 'CUSTOM-REF',
    });

    expect(mockAssertAvailable).not.toHaveBeenCalled();
    expect(mockCreateInvoices).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        invoices: [expect.objectContaining({ reference: 'CUSTOM-REF' })],
      })
    );
    const payload = mockCreateInvoices.mock.calls[0][1].invoices[0];
    expect(payload.invoiceNumber).toBeUndefined();
  });

  it('sends a merchant-edited invoice number through to Xero InvoiceNumber', async () => {
    const merchantEdited = 'INV-00999';
    const result = await createXeroInvoice({
      paymentLinkId: 'pl-1',
      organizationId: 'org-1',
      amount: '100.00',
      currency: 'AUD',
      description: 'Consulting',
      invoiceReference: merchantEdited,
    });

    expect(mockAssertAvailable).toHaveBeenCalledWith('org-1', merchantEdited);
    expect(mockCreateInvoices).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        invoices: [expect.objectContaining({ invoiceNumber: merchantEdited })],
      })
    );
    expect(result.invoiceNumber).toBe('INV-00484');
  });

  it('surfaces duplicate-number conflicts before calling createInvoices', async () => {
    mockAssertAvailable.mockRejectedValue(new XeroInvoiceNumberConflictError('INV-00484'));

    await expect(
      createXeroInvoice({
        paymentLinkId: 'pl-1',
        organizationId: 'org-1',
        amount: '100.00',
        currency: 'AUD',
        description: 'Consulting',
        invoiceReference: 'INV-00484',
      })
    ).rejects.toThrow(/already used in Xero/i);

    expect(mockCreateInvoices).not.toHaveBeenCalled();
  });
});
