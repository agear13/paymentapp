/**
 * Xero contact resolution — reuse existing contacts, persist Cash Customer ID.
 */

import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';
import { extractXeroApiMessage } from '@/lib/xero/xero-sync-errors';
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

function normalizeForMatch(value: string): string {
  return value.trim().toLowerCase();
}

type XeroAccountingApi = {
  getContacts: (...args: unknown[]) => Promise<{ body: { contacts?: Contact[] } }>;
  getContact: (tenantId: string, contactId: string) => Promise<{ body: { contacts?: Contact[] } }>;
  createContacts: (
    tenantId: string,
    body: { contacts: Contact[] }
  ) => Promise<{ body: { contacts?: Contact[] } }>;
};

type XeroClient = { accountingApi: XeroAccountingApi };

function contactValidationMessage(contact: Contact): string | null {
  const errors = contact.validationErrors;
  if (!Array.isArray(errors) || errors.length === 0) {
    return null;
  }
  return errors
    .map((e) => (e && typeof e === 'object' && 'message' in e ? String(e.message) : ''))
    .filter(Boolean)
    .join('; ');
}

export function isDuplicateContactNameError(error: unknown): boolean {
  const msg = (extractXeroApiMessage(error) ?? (error instanceof Error ? error.message : '')).toLowerCase();
  return (
    msg.includes('already assigned to another contact') ||
    msg.includes('contact name must be unique') ||
    (msg.includes('duplicate') && msg.includes('contact'))
  );
}

function isDuplicateContactNameMessage(message: string): boolean {
  return isDuplicateContactNameError(new Error(message));
}

function pickMatchingContact(
  contacts: Contact[],
  criteria: { contactNumber?: string; email?: string; name?: string }
): Contact | null {
  const byNumber = criteria.contactNumber
    ? contacts.find(
        (c) => c.contactNumber && normalizeForMatch(c.contactNumber) === normalizeForMatch(criteria.contactNumber!)
      )
    : undefined;
  if (byNumber?.contactID) {
    return byNumber;
  }

  if (criteria.email) {
    const emailNorm = normalizeForMatch(criteria.email);
    const byEmail = contacts.find(
      (c) => c.emailAddress && normalizeForMatch(c.emailAddress) === emailNorm
    );
    if (byEmail?.contactID) {
      return byEmail;
    }
  }

  if (criteria.name) {
    const nameNorm = normalizeForMatch(criteria.name);
    const byName = contacts.find((c) => c.name && normalizeForMatch(c.name) === nameNorm);
    if (byName?.contactID) {
      return byName;
    }
  }

  return contacts.find((c) => c.contactID) ?? null;
}

async function searchXeroContacts(
  xeroClient: XeroClient,
  tenantId: string,
  options: { where?: string; searchTerm?: string; organizationId: string; reason: string }
): Promise<Contact[]> {
  try {
    const searchResponse = await xeroClient.accountingApi.getContacts(
      tenantId,
      undefined,
      options.where,
      undefined,
      undefined,
      undefined,
      true,
      undefined,
      options.searchTerm
    );
    return searchResponse.body.contacts ?? [];
  } catch (error) {
    loggers.xero.warn('xero_contact_search_failed', {
      organizationId: options.organizationId,
      tenantId,
      reason: options.reason,
      where: options.where,
      searchTerm: options.searchTerm,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

async function validateCachedContactId(params: {
  xeroClient: XeroClient;
  tenantId: string;
  organizationId: string;
  contactId: string;
}): Promise<Contact | null> {
  const { xeroClient, tenantId, organizationId, contactId } = params;
  try {
    const response = await xeroClient.accountingApi.getContact(tenantId, contactId);
    const contact = response.body.contacts?.[0];
    if (contact?.contactID) {
      return contact;
    }
  } catch (error) {
    loggers.xero.warn('xero_cached_contact_invalid', {
      organizationId,
      tenantId,
      contactId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return null;
}

async function resolveExistingXeroContact(params: {
  organizationId: string;
  xeroClient: XeroClient;
  tenantId: string;
  emailOrName: string;
  contactNumber: string;
  displayName: string;
  reason: string;
}): Promise<Contact | null> {
  const { organizationId, xeroClient, tenantId, emailOrName, contactNumber, displayName, reason } =
    params;

  const byContactNumber = await searchXeroContacts(xeroClient, tenantId, {
    organizationId,
    reason: `${reason}:contact_number`,
    where: `ContactNumber=="${escapeXeroWhereValue(contactNumber)}"`,
  });
  const fromNumber = pickMatchingContact(byContactNumber, { contactNumber });
  if (fromNumber?.contactID) {
    return fromNumber;
  }

  if (emailOrName.includes('@')) {
    const byEmail = await searchXeroContacts(xeroClient, tenantId, {
      organizationId,
      reason: `${reason}:email`,
      where: `EmailAddress=="${escapeXeroWhereValue(emailOrName)}"`,
    });
    const fromEmail = pickMatchingContact(byEmail, { email: emailOrName });
    if (fromEmail?.contactID) {
      return fromEmail;
    }
  }

  const byName = await searchXeroContacts(xeroClient, tenantId, {
    organizationId,
    reason: `${reason}:name`,
    where: `Name=="${escapeXeroWhereValue(displayName)}"`,
  });
  const fromName = pickMatchingContact(byName, { name: displayName });
  if (fromName?.contactID) {
    return fromName;
  }

  const bySearchTerm = await searchXeroContacts(xeroClient, tenantId, {
    organizationId,
    reason: `${reason}:search_term`,
    searchTerm: displayName,
  });
  return pickMatchingContact(bySearchTerm, { name: displayName, contactNumber, email: emailOrName });
}

async function reuseResolvedContact(params: {
  organizationId: string;
  emailOrName: string;
  contact: Contact;
  recoveryReason: string;
}): Promise<Contact> {
  const { organizationId, emailOrName, contact, recoveryReason } = params;
  if (!contact.contactID) {
    throw new Error('Resolved Xero contact is missing contactID');
  }

  await persistContactId({ organizationId, emailOrName, contactId: contact.contactID });

  loggers.xero.info('xero_contact_reused_after_duplicate', {
    organizationId,
    contactId: contact.contactID,
    recoveryReason,
    emailOrName,
  });

  return contact;
}

export async function getOrCreateXeroContact(params: {
  organizationId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  xeroClient: any;
  tenantId: string;
  emailOrName: string;
}): Promise<Contact> {
  const { organizationId, xeroClient, tenantId, emailOrName } = params;
  const client = xeroClient as XeroClient;
  const contactNumber = provvypayContactNumber(emailOrName);
  const isCashCustomer = isCashCustomerContact(emailOrName);
  const displayName = isCashCustomer ? CASH_CUSTOMER_NAME : emailOrName;

  if (isCashCustomer) {
    const settings = await prisma.merchant_settings.findFirst({
      where: { organization_id: organizationId },
      select: { xero_cash_customer_contact_id: true },
    });
    if (settings?.xero_cash_customer_contact_id) {
      const cached = await validateCachedContactId({
        xeroClient: client,
        tenantId,
        organizationId,
        contactId: settings.xero_cash_customer_contact_id,
      });
      if (cached?.contactID) {
        loggers.xero.info('xero_contact_reused_from_settings', {
          organizationId,
          contactId: cached.contactID,
        });
        return cached;
      }
    }
  }

  const existing = await resolveExistingXeroContact({
    organizationId,
    xeroClient: client,
    tenantId,
    emailOrName,
    contactNumber,
    displayName,
    reason: 'lookup',
  });
  if (existing?.contactID) {
    await persistContactId({ organizationId, emailOrName, contactId: existing.contactID });
    loggers.xero.info('xero_contact_reused', {
      organizationId,
      contactId: existing.contactID,
      contactNumber,
      isCashCustomer,
    });
    return existing;
  }

  const newContact: Contact = {
    name: displayName,
    emailAddress: emailOrName.includes('@') ? emailOrName : undefined,
    contactNumber,
  };

  try {
    const createResponse = await client.accountingApi.createContacts(tenantId, {
      contacts: [newContact],
    });

    const created = createResponse.body.contacts?.[0];
    if (created?.contactID) {
      const validationMsg = contactValidationMessage(created);
      if (validationMsg && isDuplicateContactNameMessage(validationMsg)) {
        const recovered = await resolveExistingXeroContact({
          organizationId,
          xeroClient: client,
          tenantId,
          emailOrName,
          contactNumber,
          displayName,
          reason: 'duplicate_validation_recovery',
        });
        if (recovered?.contactID) {
          return reuseResolvedContact({
            organizationId,
            emailOrName,
            contact: recovered,
            recoveryReason: 'create_validation_duplicate_name',
          });
        }
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

    throw new Error('Failed to create contact in Xero');
  } catch (error) {
    if (isDuplicateContactNameError(error)) {
      const recovered = await resolveExistingXeroContact({
        organizationId,
        xeroClient: client,
        tenantId,
        emailOrName,
        contactNumber,
        displayName,
        reason: 'duplicate_create_recovery',
      });
      if (recovered?.contactID) {
        return reuseResolvedContact({
          organizationId,
          emailOrName,
          contact: recovered,
          recoveryReason: 'create_api_duplicate_name',
        });
      }
    }
    throw error;
  }
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
