import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { requireAuth } from '@/lib/supabase/middleware';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import {
  ensureReferralIssuance,
  resolveOrganizationIdForOperator,
} from '@/lib/referrals/ensure-referral-issuance';
import {
  normalizeReferralCommerce,
  shouldIssueReferralLink,
  type ParticipantReferralCommerce,
} from '@/lib/referrals/referral-commerce-config';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { dealRowToRecentDeal, participantRowToDemo } from '@/lib/deal-network-demo/pilot-snapshot.server';

const BodySchema = z.object({
  referralCommerce: z.object({
    createReferralLink: z.boolean().optional(),
    commissionMode: z.enum(['project_revenue_share', 'referral_commerce']),
    commerceCommissionPct: z.number().min(0).max(100).optional(),
    enabledServiceIds: z.array(z.string().uuid()).optional(),
  }),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ participantId: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth.user) return auth.response!;

  const { participantId } = await context.params;
  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', details: parsed.error.issues }, { status: 400 });
  }

  const row = await prisma.deal_network_pilot_participants.findUnique({
    where: { id: participantId },
    include: { deal: true },
  });
  if (!row?.deal) {
    return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
  }

  if (row.deal.user_id !== auth.user.id) {
    const org = await getOrganizationForAuthenticatedUser(auth.user.id);
    const operatorOrg = await resolveOrganizationIdForOperator(row.deal.user_id);
    if (!org?.id || org.id !== operatorOrg) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const referralCommerce: ParticipantReferralCommerce = normalizeReferralCommerce(
    parsed.data.referralCommerce
  );
  const cur = row.participant_payload as unknown as DemoParticipant;
  const next: DemoParticipant = { ...cur, referralCommerce };
  await prisma.deal_network_pilot_participants.update({
    where: { id: row.id },
    data: { participant_payload: next as unknown as Prisma.InputJsonValue },
  });

  let referralIssuance: { code: string; referralUrl: string } | undefined;
  const organizationId = await resolveOrganizationIdForOperator(row.deal.user_id);
  if (organizationId && shouldIssueReferralLink(referralCommerce) && row.approval_status === 'Approved') {
    const deal = dealRowToRecentDeal(row.deal);
    const issued = await ensureReferralIssuance({
      organizationId,
      operatorUserId: row.deal.user_id,
      participantEmail: next.email,
      participantName: next.name,
      sourceParticipantId: row.id,
      commissionKind: next.commissionKind,
      commissionValue: next.commissionValue,
      projectLabel: deal.dealName,
      referralCommerce,
    });
    referralIssuance = { code: issued.code, referralUrl: issued.referralUrl };
    await prisma.deal_network_pilot_participants.update({
      where: { id: row.id },
      data: {
        participant_payload: {
          ...next,
          inviteLink: issued.referralUrl,
        } as unknown as Prisma.InputJsonValue,
      },
    });
  }

  return NextResponse.json({
    participant: participantRowToDemo({
      ...row,
      participant_payload: next as unknown as Prisma.JsonValue,
    }),
    referralIssuance,
  });
}
