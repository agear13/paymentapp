/**
 * Operator manual invoice settlement — converges through confirmPayment() (R1).
 */
import 'server-only';

import { prisma } from '@/lib/server/prisma';
import {
  confirmPayment,
  type ConfirmPaymentResult,
} from '@/lib/services/payment-confirmation';

export function manualSettlementProviderRef(paymentLinkId: string): string {
  return `manual-settlement:${paymentLinkId}`;
}

/**
 * Mark an OPEN invoice as paid via canonical settlement (PAYMENT_CONFIRMED + ledger + downstream).
 */
export async function executeOperatorManualInvoiceSettlement(params: {
  paymentLinkId: string;
  actorUserId: string;
}): Promise<ConfirmPaymentResult> {
  const link = await prisma.payment_links.findUnique({
    where: { id: params.paymentLinkId },
    select: {
      id: true,
      status: true,
      amount: true,
      currency: true,
      invoice_currency: true,
      pilot_deal_id: true,
    },
  });

  if (!link) {
    return { success: false, error: 'Payment link not found' };
  }

  if (link.status !== 'OPEN') {
    return { success: false, error: 'Only open invoices can be marked paid manually' };
  }

  const amountReceived = Number(link.amount);
  if (!Number.isFinite(amountReceived) || amountReceived <= 0) {
    return { success: false, error: 'Invoice amount must be a positive number' };
  }

  const currencyReceived = String(link.invoice_currency ?? link.currency).toUpperCase();
  const providerRef = manualSettlementProviderRef(link.id);

  return confirmPayment({
    paymentLinkId: link.id,
    provider: 'manual',
    providerRef,
    amountReceived,
    currencyReceived,
    metadata: {
      actorUserId: params.actorUserId,
      source: 'manual-settlement-api',
      reason: 'operator_mark_paid',
      settlementPath: 'operator_manual_invoice',
      ...(link.pilot_deal_id ? { pilot_deal_id: link.pilot_deal_id } : {}),
    },
  });
}
