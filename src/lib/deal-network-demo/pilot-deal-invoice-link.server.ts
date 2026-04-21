/**
 * Validates Deal Network pilot deal ownership for invoice ↔ project linking (coordination only).
 */
import 'server-only';

import { prisma } from '@/lib/server/prisma';

export async function assertPilotDealOwnedByUser(
  userId: string,
  dealId: string
): Promise<void> {
  const row = await prisma.deal_network_pilot_deals.findFirst({
    where: { id: dealId, user_id: userId },
    select: { id: true },
  });
  if (!row) {
    throw new Error('Pilot project not found or access denied');
  }
}

export async function pilotDealOwnedByUser(
  userId: string,
  dealId: string
): Promise<boolean> {
  const row = await prisma.deal_network_pilot_deals.findFirst({
    where: { id: dealId, user_id: userId },
    select: { id: true },
  });
  return Boolean(row);
}

/** Resolve payment link by UUID or short code string. */
export async function findPaymentLinkForAttach(
  paymentLinkIdOrShortCode: string
): Promise<{ id: string; organization_id: string; pilot_deal_id: string | null } | null> {
  const raw = paymentLinkIdOrShortCode.trim();
  if (!raw) return null;
  const byId = await prisma.payment_links.findFirst({
    where: { id: raw },
    select: { id: true, organization_id: true, pilot_deal_id: true },
  });
  if (byId) return byId;
  const byShort = await prisma.payment_links.findFirst({
    where: { short_code: raw },
    select: { id: true, organization_id: true, pilot_deal_id: true },
  });
  return byShort;
}
