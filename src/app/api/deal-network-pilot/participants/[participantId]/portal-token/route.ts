import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/middleware';
import {
  ensureParticipantPortalToken,
  regenerateParticipantPortalToken,
} from '@/lib/participant-portal/participant-portal.server';
import { buildParticipantPortalUrl } from '@/lib/participant-portal/participant-portal-url';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  regenerate: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ participantId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { participantId } = await context.params;
    const result = await ensureParticipantPortalToken(participantId, user.id);
    const origin = request.nextUrl.origin;
    return NextResponse.json({
      token: result.token,
      portalUrl: buildParticipantPortalUrl(result.token, origin),
      participant: result.participant,
      created: result.created,
    });
  } catch (e: unknown) {
    const err = e as { statusCode?: number; message?: string };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (err.message === 'PARTICIPANT_NOT_FOUND') {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }
    if (err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[participant portal-token GET]', e);
    return NextResponse.json({ error: 'Failed to resolve portal link' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ participantId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { participantId } = await context.params;
    const body = bodySchema.parse(await request.json().catch(() => ({})));

    const origin = request.nextUrl.origin;
    if (body.regenerate) {
      const result = await regenerateParticipantPortalToken(participantId, user.id);
      return NextResponse.json({
        token: result.token,
        portalUrl: buildParticipantPortalUrl(result.token, origin),
        participant: result.participant,
        regenerated: true,
      });
    }

    const result = await ensureParticipantPortalToken(participantId, user.id);
    return NextResponse.json({
      token: result.token,
      portalUrl: buildParticipantPortalUrl(result.token, origin),
      participant: result.participant,
      created: result.created,
    });
  } catch (e: unknown) {
    const err = e as { statusCode?: number; message?: string };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (err.message === 'PARTICIPANT_NOT_FOUND') {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }
    if (err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    console.error('[participant portal-token POST]', e);
    return NextResponse.json({ error: 'Failed to update portal link' }, { status: 500 });
  }
}
