import { NextResponse } from 'next/server';
import {
  loadParticipantPortalContext,
} from '@/lib/participant-portal/participant-portal-context.server';
import { markParticipantPortalOpened } from '@/lib/participant-portal/participant-portal.server';
import { deriveParticipantCommercialWorkspace } from '@/lib/participant-portal/participant-portal-data';
import { sanitizeParticipantForAgreementView } from '@/lib/projects/participant-entitlement';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token: raw } = await context.params;
  const token = decodeURIComponent(raw ?? '').trim();
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  try {
    const loaded = await loadParticipantPortalContext(token);
    if (!loaded) {
      return NextResponse.json({ error: 'Portal link not found' }, { status: 404 });
    }

    await markParticipantPortalOpened(token);

    const workspace = deriveParticipantCommercialWorkspace(
      loaded.participant,
      loaded.deal,
      loaded.portalContext
    );

    return NextResponse.json({
      workspace,
      /** @deprecated use workspace */
      viewModel: workspace,
      commercialState: workspace.commercialState,
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
