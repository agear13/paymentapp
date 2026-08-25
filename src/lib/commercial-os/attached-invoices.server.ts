import 'server-only';

import { prisma } from '@/lib/server/prisma';
import { assertPilotDealOwnedByUser } from '@/lib/deal-network-demo/pilot-deal-invoice-link.server';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import type { AttachedWorkspaceInvoice } from '@/lib/commercial-os/attached-invoices';

export type { AttachedWorkspaceInvoice } from '@/lib/commercial-os/attached-invoices';

export async function listInvoicesAttachedToWorkspace(
  userId: string,
  dealId: string
): Promise<AttachedWorkspaceInvoice[]> {
  await assertPilotDealOwnedByUser(userId, dealId);
  const rows = await prisma.payment_links.findMany({
    where: { pilot_deal_id: dealId },
    select: {
      id: true,
      invoice_reference: true,
      short_code: true,
      amount: true,
      invoice_currency: true,
      status: true,
      description: true,
    },
    orderBy: { created_at: 'desc' },
  });

  return rows.map((row) => ({
    id: row.id,
    invoiceReference: row.invoice_reference,
    shortCode: row.short_code,
    amount: Number(row.amount),
    currency: row.invoice_currency,
    status: String(row.status),
    description: row.description,
    href: COMMERCIAL_OS_ROUTES.invoiceHrefFromLink({
      id: row.id,
      invoiceReference: row.invoice_reference,
      shortCode: row.short_code,
    }),
  }));
}
