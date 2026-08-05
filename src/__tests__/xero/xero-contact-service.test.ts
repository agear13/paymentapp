import {
  CASH_CUSTOMER_NAME,
  getOrCreateXeroContact,
  isDuplicateContactNameError,
  PROVVYPAY_CASH_CONTACT_NUMBER,
} from '@/lib/xero/xero-contact-service';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    merchant_settings: {
      findFirst: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  },
}));

jest.mock('@/lib/logger', () => ({
  loggers: {
    xero: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';

const findFirst = prisma.merchant_settings.findFirst as jest.Mock;
const updateMany = prisma.merchant_settings.updateMany as jest.Mock;

describe('isDuplicateContactNameError', () => {
  it('detects Xero duplicate contact name validation', () => {
    expect(
      isDuplicateContactNameError(
        new Error('Cash Customer is already assigned to another contact.')
      )
    ).toBe(true);
    expect(isDuplicateContactNameError(new Error('Contact name must be unique'))).toBe(true);
    expect(isDuplicateContactNameError(new Error('Network timeout'))).toBe(false);
  });
});

describe('getOrCreateXeroContact', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findFirst.mockResolvedValue(null);
  });

  function mockXeroClient(handlers: {
    getContacts?: jest.Mock;
    getContact?: jest.Mock;
    createContacts?: jest.Mock;
  }) {
    return {
      accountingApi: {
        getContacts: handlers.getContacts ?? jest.fn().mockResolvedValue({ body: { contacts: [] } }),
        getContact: handlers.getContact ?? jest.fn(),
        createContacts:
          handlers.createContacts ??
          jest.fn().mockRejectedValue(new Error('Cash Customer is already assigned to another contact.')),
      },
    };
  }

  it('reuses contact found by name before create', async () => {
    const existingContact = {
      contactID: 'existing-contact-id',
      name: CASH_CUSTOMER_NAME,
    };
    const getContacts = jest
      .fn()
      .mockResolvedValueOnce({ body: { contacts: [] } })
      .mockResolvedValueOnce({ body: { contacts: [] } })
      .mockResolvedValueOnce({ body: { contacts: [existingContact] } });

    const contact = await getOrCreateXeroContact({
      organizationId: 'org-1',
      xeroClient: mockXeroClient({ getContacts }),
      tenantId: 'tenant-1',
      emailOrName: CASH_CUSTOMER_NAME,
    });

    expect(contact.contactID).toBe('existing-contact-id');
    expect(getContacts).toHaveBeenCalledWith(
      'tenant-1',
      undefined,
      `Name=="${CASH_CUSTOMER_NAME}"`,
      undefined,
      undefined,
      undefined,
      true,
      undefined,
      undefined
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: { organization_id: 'org-1' },
      data: { xero_cash_customer_contact_id: 'existing-contact-id' },
    });
  });

  it('recovers from duplicate create error by re-searching and reusing existing contact', async () => {
    const existingContact = {
      contactID: 'recovered-contact-id',
      name: CASH_CUSTOMER_NAME,
    };
    const getContacts = jest
      .fn()
      .mockResolvedValueOnce({ body: { contacts: [] } })
      .mockResolvedValueOnce({ body: { contacts: [] } })
      .mockResolvedValueOnce({ body: { contacts: [] } })
      .mockResolvedValueOnce({ body: { contacts: [existingContact] } });

    const createContacts = jest
      .fn()
      .mockRejectedValue(new Error('Cash Customer is already assigned to another contact.'));

    const contact = await getOrCreateXeroContact({
      organizationId: 'org-1',
      xeroClient: mockXeroClient({ getContacts, createContacts }),
      tenantId: 'tenant-1',
      emailOrName: CASH_CUSTOMER_NAME,
    });

    expect(contact.contactID).toBe('recovered-contact-id');
    expect(createContacts).toHaveBeenCalledTimes(1);
    expect(loggers.xero.info).toHaveBeenCalledWith(
      'xero_contact_reused_after_duplicate',
      expect.objectContaining({
        organizationId: 'org-1',
        contactId: 'recovered-contact-id',
        recoveryReason: 'create_api_duplicate_name',
      })
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: { organization_id: 'org-1' },
      data: { xero_cash_customer_contact_id: 'recovered-contact-id' },
    });
  });

  it('validates cached cash customer contact id before reuse', async () => {
    findFirst.mockResolvedValue({ xero_cash_customer_contact_id: 'cached-id' });
    const getContact = jest.fn().mockResolvedValue({
      body: { contacts: [{ contactID: 'cached-id', name: CASH_CUSTOMER_NAME }] },
    });

    const getContacts = jest.fn();
    const createContacts = jest.fn();

    const contact = await getOrCreateXeroContact({
      organizationId: 'org-1',
      xeroClient: mockXeroClient({ getContacts, getContact, createContacts }),
      tenantId: 'tenant-1',
      emailOrName: CASH_CUSTOMER_NAME,
    });

    expect(contact.contactID).toBe('cached-id');
    expect(getContact).toHaveBeenCalledWith('tenant-1', 'cached-id');
    expect(getContacts).not.toHaveBeenCalled();
    expect(createContacts).not.toHaveBeenCalled();
  });

  it('falls through when cached contact id is invalid and resolves via search', async () => {
    findFirst.mockResolvedValue({ xero_cash_customer_contact_id: 'stale-id' });
    const getContact = jest.fn().mockRejectedValue(new Error('Not found'));
    const existingContact = {
      contactID: 'live-contact-id',
      name: CASH_CUSTOMER_NAME,
      contactNumber: PROVVYPAY_CASH_CONTACT_NUMBER,
    };
    const getContacts = jest
      .fn()
      .mockResolvedValueOnce({ body: { contacts: [existingContact] } });

    const contact = await getOrCreateXeroContact({
      organizationId: 'org-1',
      xeroClient: mockXeroClient({ getContacts, getContact }),
      tenantId: 'tenant-1',
      emailOrName: CASH_CUSTOMER_NAME,
    });

    expect(contact.contactID).toBe('live-contact-id');
    expect(loggers.xero.warn).toHaveBeenCalledWith(
      'xero_cached_contact_invalid',
      expect.objectContaining({ contactId: 'stale-id' })
    );
  });

  it('uses searchTerm fallback with includeArchived when name lookup misses', async () => {
    const existingContact = {
      contactID: 'search-term-id',
      name: CASH_CUSTOMER_NAME,
    };
    const getContacts = jest
      .fn()
      .mockResolvedValueOnce({ body: { contacts: [] } })
      .mockResolvedValueOnce({ body: { contacts: [] } })
      .mockResolvedValueOnce({ body: { contacts: [] } })
      .mockResolvedValueOnce({ body: { contacts: [existingContact] } });

    const contact = await getOrCreateXeroContact({
      organizationId: 'org-1',
      xeroClient: mockXeroClient({ getContacts }),
      tenantId: 'tenant-1',
      emailOrName: CASH_CUSTOMER_NAME,
    });

    expect(contact.contactID).toBe('search-term-id');
    expect(getContacts).toHaveBeenCalledWith(
      'tenant-1',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      true,
      undefined,
      CASH_CUSTOMER_NAME
    );
  });
});
