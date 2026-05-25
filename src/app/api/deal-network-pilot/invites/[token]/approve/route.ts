import { NextRequest, NextResponse } from 'next/server';
import { approveParticipantByInviteToken } from '@/lib/deal-network-demo/pilot-snapshot.server';
import { ReferralIssuanceError } from '@/lib/referrals/ensure-referral-issuance';
import { shouldIssueAttributionForParticipant } from '@/lib/operations/truth/attribution-truth';
import { log } from '@/lib/logger';
import { refreshDealNetworkPilotObligationsForUser } from '@/lib/deal-network-demo/deal-network-pilot-obligations';
import { prisma } from '@/lib/server/prisma';
import { requireAuth } from '@/lib/supabase/middleware';
import { referralTrace } from '@/lib/referrals/referral-trace';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token: raw } = await context.params;
  const token = decodeURIComponent(raw ?? '');
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  let note: string | undefined;
  try {
    const body = (await request.json()) as { note?: string };
    note = body.note;
  } catch {
    note = undefined;
  }

  try {
    const auth = await requireAuth(request as NextRequest);
    const approverUserId = auth.user?.id ?? null;

    log.info('approve participation started', { inviteToken: token, approverUserId });

    const result = await approveParticipantByInviteToken(token, note, { approverUserId });
    if (!result) {
      return NextResponse.json(
        { error: 'Invite link is inactive (participant removed)' },
        { status: 404 }
      );
    }

    const expectsIssuance = shouldIssueAttributionForParticipant(result.participant);
    if (expectsIssuance && !result.referralIssuance?.referralUrl) {
      log.warn('approve participation completed without customer commerce link', {
        inviteToken: token,
        pilotParticipantId: result.participant.id,
      });
      return NextResponse.json(
        {
          error:
            'Participation was saved but the customer payment link could not be generated. Please try again or contact the project operator.',
          issuanceFailed: true,
          participant: result.participant,
          deal: result.deal,
        },
        { status: 502 }
      );
    }
    const owner = await prisma.deal_network_pilot_deals.findUnique({
      where: { id: result.deal.id },
      select: { user_id: true },
    });
    if (owner?.user_id) {
      await refreshDealNetworkPilotObligationsForUser(owner.user_id);
    }
    referralTrace('api.approveInvite.response', {
      inviteToken: token,
      hasReferralIssuance: !!result.referralIssuance,
      referralCode: result.referralIssuance?.code ?? null,
      referralUrl: result.referralIssuance?.referralUrl ?? null,
      participantInviteLink: result.participant.inviteLink ?? null,
    });

    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ReferralIssuanceError) {
      log.error('approve participation referral issuance failed', undefined, {
        code: e.code,
        details: e.details,
      });
      const status =
        e.code === 'ORGANIZATION_NOT_FOUND' ? 422 : e.code === 'PERSISTENCE_FAILED' ? 500 : 502;
      return NextResponse.json(
        { error: e.message, code: e.code, details: e.details },
        { status }
      );
    }
    console.error('[deal-network-pilot/invites/approve POST]', e);
    return NextResponse.json({ error: 'Failed to approve' }, { status: 500 });
  }
}
