import { NextRequest, NextResponse } from 'next/server';
import { approveParticipantByInviteToken } from '@/lib/deal-network-demo/pilot-snapshot.server';
import { ReferralIssuanceError } from '@/lib/referrals/ensure-referral-issuance';
import { shouldIssueAttributionForParticipant } from '@/lib/operations/truth/attribution-truth';
import { log } from '@/lib/logger';
import {
  orchestrateOperationalMutation,
  operationalSyncJson,
} from '@/lib/operations/orchestration/operational-mutation-orchestrator.server';
import { prisma } from '@/lib/server/prisma';
import { requireAuth } from '@/lib/supabase/middleware';
import { referralTrace } from '@/lib/referrals/referral-trace';
import { hydrateAgreementEligibleServices } from '@/lib/operations/hydration/hydrate-agreement-eligible-services.server';
import { dispatchCommercialNotification } from '@/lib/commercial/dispatch-commercial-notification.server';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { persistDraftInvoice } from '@/lib/commercial/payment-setup.server';
import { buildSupplierOnboardingInput } from '@/lib/commercial/build-supplier-onboarding-input';
import { generateDraftInvoice } from '@/lib/commercial/supplier-onboarding';
import { buildPersistedDraftInvoiceProjection } from '@/lib/commercial/supplier-invoice-projection';
import { v4 as uuidv4 } from 'uuid';
import type { PersistedDraftInvoice } from '@/lib/commercial/payment-setup-types';

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
    let operationalSync;
    if (owner?.user_id) {
      operationalSync = await orchestrateOperationalMutation({
        userId: owner.user_id,
        mutation: 'agreement_approval',
        projectId: result.deal.id,
        focusParticipant: result.participant,
      });

      // Dispatch commercial notification for agreement approval
      const org = await getOrganizationForAuthenticatedUser(owner.user_id);
      if (org) {
        void dispatchCommercialNotification({
          organizationId: org.id,
          eventKind: 'agreement_approved',
          projectId: result.deal.id,
          participantId: result.participant.id,
          participantName: result.participant.name,
        });
      }

      // Persist draft invoice only — operator sends payment request explicitly.
      void (async () => {
        try {
          const deal = result.deal;
          const dealName = deal.dealName ?? 'Your project';

          const input = buildSupplierOnboardingInput(result.participant, {
            id: deal.id,
            name: dealName,
          });
          const derived = generateDraftInvoice(input);
          const createdAt = new Date().toISOString();
          const persistedInvoice: PersistedDraftInvoice = buildPersistedDraftInvoiceProjection({
            derived,
            id: uuidv4(),
            createdAt,
            status: 'DRAFT',
            supplier: result.participant.name,
            participantId: result.participant.id,
            agreementReference: null,
            projectName: dealName,
          });
          await persistDraftInvoice(result.participant.id, persistedInvoice);

          const org = await getOrganizationForAuthenticatedUser(owner.user_id);
          if (org) {
            void dispatchCommercialNotification({
              organizationId: org.id,
              eventKind: 'supplier_invoice_generated',
              projectId: deal.id,
              participantId: result.participant.id,
              participantName: result.participant.name,
              emailDispatched: false,
            });
          }
        } catch (err) {
          log.error('post-approval draft invoice failed', undefined, {
            participantId: result.participant.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      })();
    }
    referralTrace('api.approveInvite.response', {
      inviteToken: token,
      hasReferralIssuance: !!result.referralIssuance,
      referralCode: result.referralIssuance?.code ?? null,
      referralUrl: result.referralIssuance?.referralUrl ?? null,
      participantInviteLink: result.participant.inviteLink ?? null,
    });

    return NextResponse.json({
      ...result,
      eligibleServices: owner?.user_id
        ? await hydrateAgreementEligibleServices({
            participant: result.participant,
            dealUserId: owner.user_id,
            dealId: result.deal.id,
          })
        : [],
      ...(operationalSync ? operationalSyncJson(operationalSync) : {}),
    });
  } catch (e) {
    if (e instanceof Error && e.message === 'AGREEMENT_NOT_APPROVABLE') {
      return NextResponse.json(
        {
          error:
            'This agreement cannot be approved yet. The operator must share the participation agreement first.',
        },
        { status: 409 }
      );
    }
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
