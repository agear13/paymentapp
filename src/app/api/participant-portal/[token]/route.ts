import { NextRequest, NextResponse } from 'next/server';
import {
  loadParticipantPortalContext,
} from '@/lib/participant-portal/participant-portal-context.server';
import { findParticipantByPortalToken, markParticipantPortalOpened } from '@/lib/participant-portal/participant-portal.server';
import { deriveParticipantCommercialWorkspace } from '@/lib/participant-portal/participant-portal-data';
import { deriveParticipantWorkspaceOnboarding } from '@/lib/participant-portal/participant-workspace-onboarding';
import { ensurePaymentSetupTokenForPortalParticipant } from '@/lib/participant-portal/participant-portal-payout.server';
import { sanitizeParticipantForAgreementView } from '@/lib/projects/participant-entitlement';
import {
  authorizeParticipantRelationship,
  getParticipantSessionUser,
  normalizeParticipantEmail,
} from '@/lib/participant-portal/participant-session.server';

export const dynamic = 'force-dynamic';

function invitationPreview(input: {
  projectName: string;
  hostLabel: string;
  invitedEmail: string | null;
}) {
  return {
    auth: { status: 'unauthenticated' as const },
    invitation: {
      projectName: input.projectName,
      hostLabel: input.hostLabel,
      invitedEmail: input.invitedEmail,
    },
  };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token: raw } = await context.params;
  const token = decodeURIComponent(raw ?? '').trim();
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const url = new URL(request.url);
  const urlStep = url.searchParams.get('step');

  try {
    const found = await findParticipantByPortalToken(token);
    if (!found) {
      return NextResponse.json({ error: 'Portal link not found' }, { status: 404 });
    }

    const user = await getParticipantSessionUser();
    const decision = user
      ? await authorizeParticipantRelationship({
          user,
          participantId: found.participantDbId,
          participantEmail: found.participantEmail,
          authenticatedUserId: found.authenticatedUserId,
          dealOwnerUserId: found.dealUserId,
          action: 'read',
        })
      : { status: 'unauthenticated' as const, role: null };

    if (decision.status === 'unauthenticated') {
      return NextResponse.json(
        invitationPreview({
          projectName: found.deal.dealName,
          hostLabel: found.deal.partner || found.deal.dealName,
          invitedEmail: normalizeParticipantEmail(found.participantEmail) || null,
        })
      );
    }

    if (decision.status === 'denied') {
      return NextResponse.json(
        {
          error: 'This account does not have access to this participant workspace.',
          code: 'FORBIDDEN',
          auth: { status: 'denied', signedInEmail: user?.email ?? null },
        },
        { status: 403 }
      );
    }

    const loaded = await loadParticipantPortalContext(token);
    if (!loaded) {
      return NextResponse.json({ error: 'Portal link not found' }, { status: 404 });
    }

    if (decision.role === 'participant') {
      await markParticipantPortalOpened(token);
    }

    const onboarding = deriveParticipantWorkspaceOnboarding(loaded.participant, { urlStep });
    let paymentSetupToken: string | null = null;
    if (onboarding.step === 'payout_details') {
      paymentSetupToken = await ensurePaymentSetupTokenForPortalParticipant(loaded.participantDbId);
    } else if (loaded.participant.paymentSetup?.token) {
      paymentSetupToken = loaded.participant.paymentSetup.token;
    }

    const workspace =
      onboarding.step === 'complete' ||
      onboarding.step === 'payout_submitted' ||
      onboarding.onboardingComplete
        ? deriveParticipantCommercialWorkspace(
            loaded.participant,
            loaded.deal,
            loaded.portalContext
          )
        : null;

    return NextResponse.json({
      auth: {
        status: 'authorized',
        role: decision.role,
        signedInEmail: user?.email ?? null,
      },
      workspace,
      viewModel: workspace,
      commercialState: workspace?.commercialState ?? null,
      onboarding,
      paymentSetupToken,
      inviteToken: loaded.participant.inviteToken,
      participant: sanitizeParticipantForAgreementView(loaded.participant),
      deal: {
        id: loaded.deal.id,
        dealName: loaded.deal.dealName,
        partner: loaded.deal.partner,
      },
      syncedAt: loaded.portalContext.syncedAt,
    });
  } catch (e) {
    console.error('[participant-portal GET]', e);
    return NextResponse.json({ error: 'Failed to load commercial workspace' }, { status: 500 });
  }
}