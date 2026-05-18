import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { resolveOrganizationIdForOperator } from '@/lib/referrals/ensure-referral-issuance';
import { shouldIssueReferralLink } from '@/lib/referrals/referral-commerce-config';
import {
  dealRowToRecentDeal,
  issueAndPersistParticipantAttribution,
  participantRowToDemo,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
import { prisma } from '@/lib/server/prisma';

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

    const cur = participantRowToDemo(row);
    if (row.approval_status !== 'Approved') {
      return NextResponse.json(
        {
          error:
            'Participant must approve the agreement before customer attribution can activate',
        },
        { status: 400 }
      );
    }
    if (!shouldIssueReferralLink(cur.referralCommerce)) {
      return NextResponse.json(
        { error: 'Customer attribution is not enabled for this participant' },
        { status: 400 }
      );
    }

    const activated = await issueAndPersistParticipantAttribution({
      row,
      participant: cur,
      approverUserId: user.id,
    });

    if (!activated.referralIssuance) {
      return NextResponse.json(
        { error: 'Could not issue customer commerce link — check organization setup' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      participant: activated.participant,
      referralIssuance: activated.referralIssuance,
      deal: dealRowToRecentDeal(row.deal),
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
