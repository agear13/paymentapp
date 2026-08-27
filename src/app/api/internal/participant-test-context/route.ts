import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { getCurrentUser } from '@/lib/auth/session';
import { log } from '@/lib/logger';
import {
  isParticipantTestContextEnabled,
  PARTICIPANT_TEST_CONTEXT_COOKIE,
  participantTestContextCookieOptions,
} from '@/lib/participant-portal/participant-test-context';
import {
  listParticipantTestFixturesForActor,
  mintParticipantTestContextForActor,
} from '@/lib/participant-portal/participant-test-context.server';

export const dynamic = 'force-dynamic';

function featureDisabledResponse() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function GET() {
  if (!isParticipantTestContextEnabled()) return featureDisabledResponse();
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const fixtures = await listParticipantTestFixturesForActor(user.id);
  return NextResponse.json({ fixtures, enabled: true });
}

export async function POST(request: NextRequest) {
  if (!isParticipantTestContextEnabled()) return featureDisabledResponse();
  const auth = await getCurrentUserForApi(request);
  if (!auth.user) return auth.response!;

  const body = (await request.json().catch(() => null)) as { participantId?: unknown } | null;
  const participantId = typeof body?.participantId === 'string' ? body.participantId.trim() : '';
  if (!participantId) {
    return NextResponse.json({ error: 'participantId is required' }, { status: 400 });
  }

  const minted = await mintParticipantTestContextForActor({
    actorUserId: auth.user.id,
    participantId,
  });
  if (!minted.ok) {
    return NextResponse.json({ error: minted.error }, { status: minted.status });
  }

  const response = NextResponse.json({
    ok: true,
    portalPath: minted.portalPath,
    participantId: minted.participantId,
  });
  response.cookies.set(
    PARTICIPANT_TEST_CONTEXT_COOKIE,
    minted.cookieValue,
    participantTestContextCookieOptions()
  );
  return response;
}

export async function DELETE(request: NextRequest) {
  if (!isParticipantTestContextEnabled()) return featureDisabledResponse();
  const auth = await getCurrentUserForApi(request);
  if (!auth.user) return auth.response!;

  log.info('participant.test_context_cleared', { actorUserId: auth.user.id });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    PARTICIPANT_TEST_CONTEXT_COOKIE,
    '',
    participantTestContextCookieOptions(true)
  );
  return response;
}
