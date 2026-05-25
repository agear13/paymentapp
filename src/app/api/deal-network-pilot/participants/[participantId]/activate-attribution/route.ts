import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import {
  ReferralIssuanceError,
  resolveOrganizationIdForPilotDeal,
} from '@/lib/referrals/ensure-referral-issuance';
import { shouldIssueReferralLink } from '@/lib/referrals/referral-commerce-config';
import {
  dealRowToRecentDeal,
  issueAndPersistParticipantAttribution,
  participantRowToDemo,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
import { log } from '@/lib/logger';
import {
  orchestrateOperationalMutation,
  operationalSyncJson,
} from '@/lib/operations/orchestration/operational-mutation-orchestrator.server';
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
      return NextResponse.json({ error: 'Participant not found', code: 'PARTICIPANT_NOT_FOUND' }, { status: 404 });
    }

    if (row.deal.user_id !== user.id) {
      const org = await getOrganizationForAuthenticatedUser(user.id);
      const operatorOrg = await resolveOrganizationIdForPilotDeal(row.deal.user_id, row.deal_id);
      if (!org?.id || org.id !== operatorOrg) {
        return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
      }
    }

    const cur = participantRowToDemo(row);
    if (row.approval_status !== 'Approved') {
      return NextResponse.json(
        {
          error:
            'Participant must approve the agreement before customer attribution can activate',
          code: 'APPROVAL_REQUIRED',
        },
        { status: 400 }
      );
    }
    if (!shouldIssueReferralLink(cur.referralCommerce)) {
      return NextResponse.json(
        {
          error: 'Customer attribution is not enabled for this participant',
          code: 'ATTRIBUTION_DISABLED',
        },
        { status: 400 }
      );
    }

    const organizationId = await resolveOrganizationIdForPilotDeal(row.deal.user_id, row.deal_id);
    if (!organizationId) {
      return NextResponse.json(
        {
          error: 'Merchant organization not found for this project',
          code: 'ORGANIZATION_NOT_FOUND',
        },
        { status: 422 }
      );
    }

    log.info('activate attribution started', {
      participantId,
      dealId: row.deal_id,
      organizationId,
    });

    const activated = await issueAndPersistParticipantAttribution({
      row,
      participant: cur,
    });

    if (!activated.referralIssuance?.referralUrl) {
      return NextResponse.json(
        {
          error: 'Referral generation did not produce a customer commerce URL',
          code: 'REFERRAL_GENERATION_FAILED',
        },
        { status: 502 }
      );
    }

    const operationalSync = await orchestrateOperationalMutation({
      userId: row.deal.user_id,
      mutation: 'attribution_update',
      projectId: row.deal_id,
      focusParticipant: activated.participant,
    });

    return NextResponse.json({
      participant: activated.participant,
      referralIssuance: activated.referralIssuance,
      deal: dealRowToRecentDeal(row.deal),
      ...operationalSyncJson(operationalSync),
    });
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }
    if (e instanceof ReferralIssuanceError) {
      log.error('activate attribution failed', undefined, {
        code: e.code,
        details: e.details,
      });
      const status =
        e.code === 'ORGANIZATION_NOT_FOUND'
          ? 422
          : e.code === 'PERSISTENCE_FAILED'
            ? 500
            : 502;
      return NextResponse.json({ error: e.message, code: e.code, details: e.details }, { status });
    }
    console.error('[deal-network-pilot/participants/activate-attribution POST]', e);
    return NextResponse.json(
      { error: 'Failed to activate attribution', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
