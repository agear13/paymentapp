import type { XeroClient } from 'xero-node';
import { getActiveConnection } from '@/lib/xero/connection-service';
import { getXeroClient } from '@/lib/xero/client';
import { loggers } from '@/lib/logger';
import {
  inferNextXeroInvoiceNumber,
  type XeroInvoiceNumberSuggestionResult,
} from '@/lib/xero/xero-invoice-number-suggestion';
import { XeroInvoiceNumberConflictError } from '@/lib/xero/xero-invoice-number-conflict';

export type XeroInvoiceNumberSuggestionResponse =
  | {
      available: true;
      suggestedNumber: string;
      prefix: string;
    }
  | {
      available: false;
      reason: 'not_connected' | 'fetch_failed' | 'no_numbers' | 'unparseable' | 'ambiguous_prefixes';
      prefixes?: string[];
    };

const ACCREC_WHERE = 'Type=="ACCREC"';
const RECENT_PAGE_SIZE = 100;

async function withXeroClient<T>(
  organizationId: string,
  reason: string,
  run: (client: XeroClient, tenantId: string) => Promise<T>
): Promise<T | null> {
  const connection = await getActiveConnection(organizationId);
  if (!connection) return null;

  const xeroClient = getXeroClient();
  const { applyConnectionToXeroClient } = await import('./apply-connection-token-set');
  await applyConnectionToXeroClient(xeroClient, connection, reason);
  await xeroClient.updateTenants();
  return run(xeroClient, connection.tenantId);
}

export async function fetchRecentXeroAccrecInvoiceNumbers(
  organizationId: string
): Promise<string[] | null> {
  return withXeroClient(organizationId, 'invoice_number_suggestion', async (client, tenantId) => {
    const response = await client.accountingApi.getInvoices(
      tenantId,
      undefined,
      ACCREC_WHERE,
      'UpdatedDateUTC DESC',
      undefined,
      undefined,
      undefined,
      undefined,
      1,
      false,
      undefined,
      undefined,
      true,
      RECENT_PAGE_SIZE
    );

    const invoices = response.body.invoices ?? [];
    return invoices
      .map((inv) => inv.invoiceNumber?.trim())
      .filter((n): n is string => Boolean(n));
  });
}

export async function suggestNextXeroInvoiceNumberForOrg(
  organizationId: string
): Promise<XeroInvoiceNumberSuggestionResponse> {
  const numbers = await fetchRecentXeroAccrecInvoiceNumbers(organizationId);
  if (numbers === null) {
    return { available: false, reason: 'not_connected' };
  }

  try {
    const inferred: XeroInvoiceNumberSuggestionResult = inferNextXeroInvoiceNumber(numbers);
    if (!inferred.ok) {
      return {
        available: false,
        reason: inferred.reason,
        prefixes: inferred.prefixes,
      };
    }
    return {
      available: true,
      suggestedNumber: inferred.suggestedNumber,
      prefix: inferred.prefix,
    };
  } catch (error) {
    loggers.xero.warn('xero_invoice_number_suggestion_failed', {
      organizationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { available: false, reason: 'fetch_failed' };
  }
}

export async function xeroAccrecInvoiceNumberExists(
  organizationId: string,
  invoiceNumber: string
): Promise<boolean | null> {
  const trimmed = invoiceNumber.trim();
  if (!trimmed) return false;

  const result = await withXeroClient(
    organizationId,
    'invoice_number_duplicate_check',
    async (client, tenantId) => {
      const response = await client.accountingApi.getInvoices(
        tenantId,
        undefined,
        ACCREC_WHERE,
        undefined,
        undefined,
        [trimmed],
        undefined,
        undefined,
        1
      );
      const invoices = response.body.invoices ?? [];
      return invoices.some(
        (inv) => inv.type === 'ACCREC' && inv.invoiceNumber?.trim() === trimmed
      );
    }
  );

  return result;
}

/** Final guard before POST createInvoices — Xero remains source of truth for uniqueness. */
export async function assertXeroInvoiceNumberAvailableForCreate(
  organizationId: string,
  invoiceNumber: string
): Promise<void> {
  const exists = await xeroAccrecInvoiceNumberExists(organizationId, invoiceNumber);
  if (exists === null) {
    throw new Error('No active Xero connection');
  }
  if (exists) {
    throw new XeroInvoiceNumberConflictError(invoiceNumber.trim());
  }
}
