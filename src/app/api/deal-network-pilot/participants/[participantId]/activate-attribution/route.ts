import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { requireAuth } from '@/lib/auth/middleware';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import {
  ensureReferralIssuance,
  resolveOrganizationIdForOperator,
} from '@/lib/referrals/ensure-referral-issuance';
import { shouldIssueReferralLink } from '@/lib/referrals/referral-commerce-config';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  dealRowToRecentDeal,
  participantRowToDemo,
} from '@/lib/deal-network-demo/pilot-snapshot.server';

/**
 * Activate customer commerce for a project participant after agreement approval.
 * Does not require payout onboarding — only payout release is gated later.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ participantId: string }> }
) {
  try {
    const user = await requireAuth();
    const { participantId } = await context.params;

    const row = await prisma.deal_network_pilot_participants.findUnique({
      where: { id: participantId },
      include: { deal: true },
    });
    if (!row?.deal) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    if (row.deal.user_id !== user.id) {
      const org = await getOrganizationForAuthenticatedUser(user.id);
      const operatorOrg = await resolveOrganizationIdForOperator(row.deal.user_id);
      if (!org?.id || org.id !== operatorOrg) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const cur = row.participant_payload as unknown as DemoParticipant;
    if (row.approval_status !== 'Approved') {
      return NextResponse.json(
        { error: 'Participant must approve the agreement before customer attribution can activate' },
        { status: 400 }
      );
    }
    if (!shouldIssueReferralLink(cur.referralCommerce)) {
      return NextResponse.json(
        { error: 'Customer attribution is not enabled for this participant' },
        { status: 400 }
      );
    }

    const organizationId = await resolveOrganizationIdForOperator(row.deal.user_id);
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 });
    }

    const deal = dealRowToRecentDeal(row.deal);
    const issued = await ensureReferralIssuance({
      organizationId,
      operatorUserId: row.deal.user_id,
      participantEmail: cur.email,
      participantName: cur.name,
      sourceParticipantId: row.id,
      commissionKind: cur.commissionKind,
      commissionValue: cur.commissionValue,
      projectLabel: deal.dealName,
      referralCommerce: cur.referralCommerce ?? null,
    });

    const next: DemoParticipant = {
      ...cur,
      id: row.id,
      dealId: row.deal_id,
      inviteToken: row.invite_token,
      inviteLink: issued.referralUrl,
      customerCommerceUrl: issued.referralUrl,
      attributionStatus: 'active',
    };

    await prisma.deal_network_pilot_participants.update({
      where: { id: row.id },
      data: { participant_payload: next as unknown as Prisma.InputJsonValue },
    });

    return NextResponse.json({
      participant: participantRowToDemo({
        ...row,
        participant_payload: next as unknown as Prisma.JsonValue,
      }),
      referralIssuance: {
        code: issued.code,
        referralUrl: issued.referralUrl,
        created: issued.created,
      },
    });
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[deal-network-pilot/participants/activate-attribution POST]', e);
    return NextResponse.json({ error: 'Failed to activate attribution' }, { status: 500 });
  }
}
