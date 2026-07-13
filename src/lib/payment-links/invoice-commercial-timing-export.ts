/**
 * Resolve commercial timing for customer invoice accounting export.
 * Single entry point — never duplicate timing logic elsewhere.
 */

import type { PrismaClient } from '@prisma/client';
import { dealRowToRecentDeal } from '@/lib/deal-network-demo/pilot-snapshot.server';
import { commercialTimingFromDeal } from '@/lib/commercial-timing/commercial-timing-payload';
import {
  buildAccountingExportTimingContext,
  commercialTimingFromPaymentLink,
  resolveInvoiceCommercialTiming,
  type ResolvedCommercialTiming,
} from '@/lib/commercial-timing';

export type InvoiceCommercialTimingExportContext = {
  resolved: ResolvedCommercialTiming;
  exportContext: ReturnType<typeof buildAccountingExportTimingContext>;
};

export type PaymentLinkTimingRow = {
  commercial_timing?: unknown;
  pilot_deal_id?: string | null;
  invoice_date?: Date | null;
  due_date?: Date | null;
};

/**
 * Resolve commercial timing for a payment link, loading agreement defaults from pilot deal when linked.
 */
export async function resolvePaymentLinkCommercialTimingForExport(
  prismaClient: Pick<PrismaClient, 'deal_network_pilot_deals'>,
  link: PaymentLinkTimingRow
): Promise<InvoiceCommercialTimingExportContext> {
  let agreementDefaults = null;
  if (link.pilot_deal_id) {
    const dealRow = await prismaClient.deal_network_pilot_deals.findUnique({
      where: { id: link.pilot_deal_id },
    });
    if (dealRow) {
      agreementDefaults = commercialTimingFromDeal(dealRowToRecentDeal(dealRow));
    }
  }

  const documentTiming = commercialTimingFromPaymentLink({
    commercial_timing: link.commercial_timing as never,
  });

  const resolved = resolveInvoiceCommercialTiming(agreementDefaults, documentTiming);
  return {
    resolved,
    exportContext: buildAccountingExportTimingContext(resolved),
  };
}

/** Format ISO date as YYYY-MM-DD for Xero date fields. */
export function toXeroDateString(iso: string | Date | null | undefined): string | undefined {
  if (!iso) return undefined;
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().split('T')[0];
}

/**
 * Resolve Xero invoice date and due date from payment link + commercial timing.
 * Invoice date: invoice_date → servicePeriodStart → today.
 * Due date: due_date → expectedPaymentDate → invoice date.
 */
export function resolveXeroInvoiceDates(input: {
  invoiceDate?: Date | null;
  dueDate?: Date | null;
  commercialTiming: ResolvedCommercialTiming;
}): { date: string; dueDate: string } {
  const today = new Date().toISOString().split('T')[0];
  const date =
    toXeroDateString(input.invoiceDate) ??
    toXeroDateString(input.commercialTiming.servicePeriodStart) ??
    today;

  const dueDate =
    toXeroDateString(input.dueDate) ??
    toXeroDateString(input.commercialTiming.expectedPaymentDate) ??
    date;

  return { date, dueDate };
}
