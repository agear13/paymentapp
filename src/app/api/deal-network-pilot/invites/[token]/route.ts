import { NextResponse } from 'next/server';
import {
  dealRowToRecentDeal,
  markParticipantInviteOpened,
  participantRowToDemo,
  getParticipantByInviteToken,
  getPilotParticipantsForDeal,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
import {
  ensureReferralIssuance,
  resolveOrganizationIdForOperator,
} from '@/lib/referrals/ensure-referral-issuance';
import { shouldIssueReferralLink } from '@/lib/referrals/referral-commerce-config';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token: raw } = await context.params;
  const token = decodeURIComponent(raw ?? '');
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  try {
    const row = await getParticipantByInviteToken(token);
    if (!row || !row.deal) {
      return NextResponse.json(
        { error: 'Invite link is inactive (participant removed)' },
        { status: 404 }
      );
    }

    await markParticipantInviteOpened(token);

    const deal = dealRowToRecentDeal(row.deal);
    const participant = { ...participantRowToDemo(row), inviteStatus: 'Opened' as const };
    const dealParticipants = await getPilotParticipantsForDeal(row.deal_id);

    let referralIssuance: { code: string; referralUrl: string; created: boolean } | undefined;
    if (row.approval_status === 'Approved') {
      try {
        const organizationId = await resolveOrganizationIdForOperator(row.deal.user_id);
        if (organizationId && shouldIssueReferralLink(participant.referralCommerce)) {
          const issued = await ensureReferralIssuance({
            organizationId,
            operatorUserId: row.deal.user_id,
            participantEmail: participant.email,
            participantName: participant.name,
            sourceParticipantId: row.id,
            commissionKind: participant.commissionKind,
            commissionValue: participant.commissionValue,
            projectLabel: deal.dealName,
            referralCommerce: participant.referralCommerce ?? null,
          });
          referralIssuance = {
            code: issued.code,
            referralUrl: issued.referralUrl,
            created: issued.created,
          };
        }
      } catch (err) {
        log.warn('Referral backfill on invite GET failed', {
          pilotParticipantId: row.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json({
      deal,
      participant: {
        ...participant,
        inviteLink: referralIssuance?.referralUrl ?? participant.inviteLink,
      },
      dealParticipants,
      referralIssuance,
    });
  } catch (e) {
    console.error('[deal-network-pilot/invites GET]', e);
    return NextResponse.json({ error: 'Failed to load invite' }, { status: 500 });
  }
}
