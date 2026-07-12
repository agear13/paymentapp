/**
 * Loads live commercial context for the Participant Portal from existing project state.
 */
import 'server-only';
import { prisma } from '@/lib/server/prisma';
import { findParticipantByPortalToken } from '@/lib/participant-portal/participant-portal.server';
import { resolveOrganizationIdForPilotDeal } from '@/lib/referrals/ensure-referral-issuance';
import type {
  ParticipantPortalContext,
  PortalAttributionActivity,
  PortalObligationSnapshot,
} from '@/lib/participant-portal/participant-portal-types';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';

function toNumber(value: unknown): number {
  if (value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function loadObligations(participantDbId: string): Promise<PortalObligationSnapshot[]> {
  const rows = await prisma.deal_network_pilot_obligations.findMany({
    where: { participant_id: participantDbId },
    orderBy: { created_at: 'asc' },
  });

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    amountOwed: toNumber(row.amount_owed),
    currency: row.currency,
    dueDate: row.due_date?.toISOString() ?? null,
    explanation: row.calculation_explanation,
  }));
}

async function loadAttributionActivity(
  participant: DemoParticipant,
  dealUserId: string,
  dealId: string
): Promise<PortalAttributionActivity | null> {
  const code = participant.referralCode?.trim();
  if (!code) return null;

  const organizationId = await resolveOrganizationIdForPilotDeal(dealUserId, dealId);
  if (!organizationId) return null;

  return loadAttributionForOrg(organizationId, code);
}

async function loadAttributionForOrg(
  organizationId: string,
  code: string
): Promise<PortalAttributionActivity | null> {
  const paidStatuses = ['PAID', 'PARTIALLY_REFUNDED'] as const;
  const links = await prisma.payment_links.findMany({
    where: {
      organization_id: organizationId,
      attribution_referral_code: code,
      status: { in: [...paidStatuses] },
    },
    select: {
      amount: true,
      invoice_currency: true,
      commission_attribution_snapshot: true,
    },
  });

  if (links.length === 0) return null;

  let attributedSales = 0;
  let commissionEarned = 0;
  let currency = links[0]?.invoice_currency ?? 'AUD';

  for (const link of links) {
    const amount = toNumber(link.amount);
    attributedSales += amount;
    currency = link.invoice_currency ?? currency;

    const snapshot = link.commission_attribution_snapshot as Record<string, unknown> | null;
    const snapshotCommission = toNumber(snapshot?.commission_amount ?? snapshot?.commissionAmount);
    if (snapshotCommission > 0) {
      commissionEarned += snapshotCommission;
    }
  }

  return {
    attributedSales,
    orders: links.length,
    commissionEarned,
    currency,
  };
}

export async function loadParticipantPortalContext(
  token: string
): Promise<
  | (Awaited<ReturnType<typeof findParticipantByPortalToken>> & {
      portalContext: ParticipantPortalContext;
    })
  | null
> {
  const found = await findParticipantByPortalToken(token);
  if (!found) return null;

  const obligations = await loadObligations(found.participantDbId);
  const attributionActivity = await loadAttributionActivity(
    found.participant,
    found.dealUserId,
    found.dealId
  );

  const portalContext: ParticipantPortalContext = {
    obligations,
    attributionActivity,
    syncedAt: new Date().toISOString(),
  };

  return { ...found, portalContext };
}
