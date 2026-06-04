import 'server-only';

import { prisma } from '@/lib/server/prisma';
import { pilotSlugFromParticipantId } from '@/lib/referrals/pilot-referral-slug.server';

export type AttributionEarningsItemRow = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  paymentLinkId: string;
  shortCode: string | null;
  invoiceReference: string | null;
  referralCode: string | null;
};

export type AttributionEarningsParticipantSummary = {
  participantId: string;
  participantName: string;
  dealId: string | null;
  dealName: string | null;
  outstandingAmount: number;
  paidAmount: number;
  currency: string;
  items: AttributionEarningsItemRow[];
};

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }
  return Number(value) || 0;
}

/**
 * Outstanding attribution commission = sum of obligation items not yet PAID.
 */
export async function listAttributionEarningsForOrganization(
  organizationId: string
): Promise<AttributionEarningsParticipantSummary[]> {
  const items = await prisma.commission_obligation_items.findMany({
    where: {
      commission_obligations: {
        payment_links: { organization_id: organizationId },
      },
    },
    include: {
      commission_obligations: {
        select: {
          payment_link_id: true,
          currency: true,
          created_at: true,
          referral_links: { select: { code: true, slug: true } },
          payment_links: {
            select: {
              short_code: true,
              invoice_reference: true,
              pilot_deal_id: true,
            },
          },
        },
      },
    },
    orderBy: { created_at: 'desc' },
    take: 500,
  });

  const participants = await prisma.deal_network_pilot_participants.findMany({
    where: {
      deal: {
        linked_payment_links: { some: { organization_id: organizationId } },
      },
    },
    select: {
      id: true,
      name: true,
      deal_id: true,
      deal: { select: { id: true, name: true } },
    },
  });

  const slugToParticipant = new Map<
    string,
    { id: string; name: string; dealId: string; dealName: string }
  >();
  for (const p of participants) {
    slugToParticipant.set(pilotSlugFromParticipantId(p.id), {
      id: p.id,
      name: p.name,
      dealId: p.deal_id,
      dealName: p.deal.name,
    });
  }

  const byParticipant = new Map<string, AttributionEarningsParticipantSummary>();

  for (const item of items) {
    const co = item.commission_obligations;
    const slug = co.referral_links?.slug ?? null;
    const mapped = slug ? slugToParticipant.get(slug) : null;
    const participantId = mapped?.id ?? `unmapped-${slug ?? 'unknown'}`;
    const amount = toNumber(item.amount);
    const currency = item.currency || co.currency || 'USD';
    const isPaid = item.status === 'PAID';

    let summary = byParticipant.get(participantId);
    if (!summary) {
      summary = {
        participantId,
        participantName: mapped?.name ?? co.referral_links?.code ?? 'Attribution',
        dealId: mapped?.dealId ?? co.payment_links?.pilot_deal_id ?? null,
        dealName: mapped?.dealName ?? null,
        outstandingAmount: 0,
        paidAmount: 0,
        currency,
        items: [],
      };
      byParticipant.set(participantId, summary);
    }

    if (isPaid) {
      summary.paidAmount += amount;
    } else {
      summary.outstandingAmount += amount;
    }

    summary.items.push({
      id: item.id,
      amount,
      currency,
      status: item.status,
      createdAt: item.created_at.toISOString(),
      paymentLinkId: co.payment_link_id,
      shortCode: co.payment_links?.short_code ?? null,
      invoiceReference: co.payment_links?.invoice_reference ?? null,
      referralCode: co.referral_links?.code ?? null,
    });
  }

  return [...byParticipant.values()].sort((a, b) => b.outstandingAmount - a.outstandingAmount);
}
