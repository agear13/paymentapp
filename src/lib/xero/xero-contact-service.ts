/**
 * Xero contact resolution — reuse existing contacts, persist Cash Customer ID.
 */

import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';
import type { Contact } from 'xero-node';

export const CASH_CUSTOMER_NAME = 'Cash Customer';
export const PROVVYPAY_CASH_CONTACT_NUMBER = 'PROVVYPAY_CASH_CUSTOMER';

/** Stable external identifier stored as Xero ContactNumber (max 50 chars). */
export function provvypayContactNumber(emailOrName: string): string {
  const trimmed = emailOrName.trim();
  if (trimmed === CASH_CUSTOMER_NAME || !trimmed.includes('@')) {
    return PROVVYPAY_CASH_CONTACT_NUMBER;
  }
  const normalized = trimmed.toLowerCase().replace(/[^a-z0-9@._+-]/g, '_');
  const key = `PROVVYPAY_${normalized}`;
  return key.length > 50 ? key.slice(0, 50) : key;
}

export function isCashCustomerContact(emailOrName: string): boolean {
  return emailOrName.trim() === CASH_CUSTOMER_NAME || !emailOrName.includes('@');
}

function escapeXeroWhereValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function searchXeroContact(
  xeroClient: { accountingApi: { getContacts: (...args: unknown[]) => Promise<{ body: { contacts?: Contact[] } }> } },
  tenantId: string,
  where: string
): Promise<Contact | null> {
  try {
    const searchResponse = await xeroClient.accountingApi.getContacts(
      tenantId,
      undefined,
      where
    );
    const contacts = searchResponse.body.contacts ?? [];
    return contacts.find((c) => c.contactID) ?? null;
  } catch {
    return null;
  }
}

export async function getOrCreateXeroContact(params: {
  organizationId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  xeroClient: any;
  tenantId: string;
  emailOrName: string;
}): Promise<Contact> {
  const { organizationId, xeroClient, tenantId, emailOrName } = params;
  const contactNumber = provvypayContactNumber(emailOrName);
  const isCashCustomer = isCashCustomerContact(emailOrName);

  if (isCashCustomer) {
    const settings = await prisma.merchant_settings.findFirst({
      where: { organization_id: organizationId },
      select: { xero_cash_customer_contact_id: true },
    });
    if (settings?.xero_cash_customer_contact_id) {
      loggers.xero.info('xero_contact_reused_from_settings', {
        organizationId,
        contactId: settings.xero_cash_customer_contact_id,
      });
      return { contactID: settings.xero_cash_customer_contact_id };
    }
  }

  const byContactNumber = await searchXeroContact(
    xeroClient,
    tenantId,
    `ContactNumber=="${escapeXeroWhereValue(contactNumber)}"`
  );
  if (byContactNumber?.contactID) {
    await persistContactId({ organizationId, emailOrName, contactId: byContactNumber.contactID });
    return byContactNumber;
  }

  if (emailOrName.includes('@')) {
    const byEmail = await searchXeroContact(
      xeroClient,
      tenantId,
      `EmailAddress=="${escapeXeroWhereValue(emailOrName)}"`
    );
    if (byEmail?.contactID) {
      await persistContactId({ organizationId, emailOrName, contactId: byEmail.contactID });
      return byEmail;
    }
  }

  const displayName = isCashCustomer ? CASH_CUSTOMER_NAME : emailOrName;
  const byName = await searchXeroContact(
    xeroClient,
    tenantId,
    `Name=="${escapeXeroWhereValue(displayName)}"`
  );
  if (byName?.contactID) {
    await persistContactId({ organizationId, emailOrName, contactId: byName.contactID });
    return byName;
  }

  const newContact: Contact = {
    name: displayName,
    emailAddress: emailOrName.includes('@') ? emailOrName : undefined,
    contactNumber,
  };

  const createResponse = await xeroClient.accountingApi.createContacts(tenantId, {
    contacts: [newContact],
  });

  if (!createResponse.body.contacts?.length) {
    throw new Error('Failed to create contact in Xero');
  }

  const created = createResponse.body.contacts[0];
  if (!created.contactID) {
    throw new Error('Xero did not return a contact ID');
  }

  await persistContactId({ organizationId, emailOrName, contactId: created.contactID });

  loggers.xero.info('xero_contact_created', {
    organizationId,
    contactId: created.contactID,
    contactNumber,
    isCashCustomer,
  });

  return created;
}

async function persistContactId(params: {
  organizationId: string;
  emailOrName: string;
  contactId: string;
}): Promise<void> {
  if (!isCashCustomerContact(params.emailOrName)) {
    return;
  }
  await prisma.merchant_settings.updateMany({
    where: { organization_id: params.organizationId },
    data: { xero_cash_customer_contact_id: params.contactId },
  });
}
