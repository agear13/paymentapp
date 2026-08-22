import 'server-only';

import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { prisma } from '@/lib/server/prisma';
import type { Prisma } from '@prisma/client';

/**
 * Persists participant payout completion. Production create/submit must not call
 * this — Paid is confirmed only after the payout receipt is PAID. Hackathon
 * demo release remains a shortcut that skips the payout batch.
 */
export async function markScopedPilotParticipantsPaid(
  participantIds?: string[] | null,
): Promise<void> {
  if (!participantIds?.length) return;
  const paidAt = new Date().toISOString();
  const rows = await prisma.deal_network_pilot_participants.findMany({
    where: { id: { in: participantIds } },
    select: { id: true, participant_payload: true },
  });

  await Promise.all(
    rows.map((row) => {
      const payload = row.participant_payload as unknown as DemoParticipant;
      const paidPayload: DemoParticipant = {
        ...payload,
        payoutSettlementStatus: 'Paid',
        payoutPaidAt: paidAt,
      };
      return prisma.deal_network_pilot_participants.update({
        where: { id: row.id },
        data: { participant_payload: paidPayload as unknown as Prisma.InputJsonValue },
      });
    }),
  );

  await prisma.deal_network_pilot_obligations.updateMany({
    where: { participant_id: { in: participantIds } },
    data: { status: 'PAID' },
  });
}
