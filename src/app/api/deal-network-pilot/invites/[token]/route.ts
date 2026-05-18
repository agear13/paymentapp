import { NextResponse } from 'next/server';
import {
  dealRowToRecentDeal,
  markParticipantInviteOpened,
  participantRowToDemo,
  getParticipantByInviteToken,
  getPilotParticipantsForDeal,
  issueAndPersistParticipantAttribution,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
import { shouldIssueReferralLink } from '@/lib/referrals/referral-commerce-config';
import {
  isProjectWorkspaceParticipant,
  sanitizeParticipantForAgreementView,
} from '@/lib/projects/participant-entitlement';
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

    if (row.approval_status !== 'Approved') {
      await markParticipantInviteOpened(token);
    }

    const refreshed = await getParticipantByInviteToken(token);
    if (!refreshed || !refreshed.deal) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    const deal = dealRowToRecentDeal(refreshed.deal);
    let participant = participantRowToDemo(refreshed);
    const dealParticipants = await getPilotParticipantsForDeal(refreshed.deal_id);

    let referralIssuance: { code: string; referralUrl: string; created: boolean } | undefined;

    if (
      refreshed.approval_status === 'Approved' &&
      shouldIssueReferralLink(participant.referralCommerce)
    ) {
      try {
        const activated = await issueAndPersistParticipantAttribution({
          row: refreshed,
          participant,
        });
        participant = activated.participant;
        if (activated.referralIssuance) {
          referralIssuance = activated.referralIssuance;
        }
      } catch (err) {
        log.warn('Referral backfill on invite GET failed', {
          pilotParticipantId: refreshed.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const isProject = isProjectWorkspaceParticipant(participant);

    return NextResponse.json({
      deal,
      participant: sanitizeParticipantForAgreementView(participant),
      dealParticipants,
      referralIssuance: isProject && refreshed.approval_status !== 'Approved' ? undefined : referralIssuance,
      workspaceSource: isProject ? 'project' : 'pilot',
    });
  } catch (e) {
    console.error('[deal-network-pilot/invites GET]', e);
    return NextResponse.json({ error: 'Failed to load invite' }, { status: 500 });
  }
}
