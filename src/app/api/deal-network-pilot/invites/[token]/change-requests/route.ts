import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getParticipantByInviteToken,
  participantRowToDemo,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
import {
  AgreementChangeRequestError,
  submitParticipantAgreementChange,
} from '@/lib/agreements/agreement-change-request.server';
import { AGREEMENT_CHANGE_FIELD_KEYS } from '@/lib/agreements/agreement-change-request';
import {
  authorizeParticipantRelationship,
  participantAuthDeniedResponse,
  requireParticipantSession,
} from '@/lib/participant-portal/participant-session.server';
import { resolveCanonicalPublicOrigin } from '@/lib/runtime/customer-facing-url';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  fieldKey: z.enum(AGREEMENT_CHANGE_FIELD_KEYS),
  suggestedValue: z.string().trim().min(1).max(500),
  reason: z.string().trim().min(1).max(2000),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token: raw } = await context.params;
  const token = decodeURIComponent(raw ?? '');
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const auth = await requireParticipantSession(request);
  if ('response' in auth) return auth.response;

  const existing = await getParticipantByInviteToken(token);
  if (!existing?.deal) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
  }

  const participant = participantRowToDemo(existing);
  const access = await authorizeParticipantRelationship({
    user: auth.user,
    participantId: existing.id,
    participantEmail: existing.email?.trim() || participant.email,
    authenticatedUserId: existing.authenticated_user_id,
    dealOwnerUserId: existing.deal.user_id,
    action: 'mutate',
  });
  if (access.status !== 'ok' || access.role !== 'participant') {
    return participantAuthDeniedResponse();
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid suggestion' }, { status: 400 });
  }

  try {
    const result = await submitParticipantAgreementChange({
      participant,
      origin: resolveCanonicalPublicOrigin(request),
      suggestion: body,
    });
    return NextResponse.json({
      request: result.request,
      duplicate: result.duplicate,
      participant: result.participant,
    });
  } catch (error) {
    if (error instanceof AgreementChangeRequestError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    throw error;
  }
}
