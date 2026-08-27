import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enforceCsrfForRequest } from '@/lib/security/csrf';
import { isEmailVerified } from '@/lib/auth/email-verification';
import { prisma } from '@/lib/server/prisma';
import {
  evaluateParticipantAccess,
  normalizeParticipantEmail,
  type ParticipantAccessAction,
  type ParticipantAccessDecision,
} from '@/lib/participant-portal/participant-access';
import { resolveRequestParticipantTestContext } from '@/lib/participant-portal/participant-test-context.server';
import type { VerifiedParticipantTestContext } from '@/lib/participant-portal/participant-test-context';

export type ParticipantSessionUser = {
  id: string;
  email: string | null;
};

export async function getParticipantSessionUser(): Promise<ParticipantSessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  if (!isEmailVerified(user)) return null;
  return { id: user.id, email: user.email ?? null };
}

export async function requireParticipantSession(
  request: NextRequest
): Promise<{ user: ParticipantSessionUser } | { response: NextResponse }> {
  const csrfBlock = enforceCsrfForRequest(request);
  if (csrfBlock) return { response: csrfBlock };

  const user = await getParticipantSessionUser();
  if (!user) {
    return {
      response: NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHENTICATED' },
        { status: 401 }
      ),
    };
  }
  return { user };
}

export async function bindParticipantAuthenticatedUser(input: {
  participantId: string;
  userId: string;
}): Promise<void> {
  await prisma.deal_network_pilot_participants.updateMany({
    where: {
      id: input.participantId,
      OR: [{ authenticated_user_id: null }, { authenticated_user_id: input.userId }],
    },
    data: { authenticated_user_id: input.userId },
  });
}

export async function authorizeParticipantRelationship(input: {
  user: ParticipantSessionUser;
  participantId: string;
  participantEmail?: string | null;
  authenticatedUserId?: string | null;
  dealOwnerUserId: string;
  action: ParticipantAccessAction;
  portalToken?: string | null;
  testContext?: VerifiedParticipantTestContext | null;
}): Promise<ParticipantAccessDecision> {
  const testContext = await resolveRequestParticipantTestContext({
    actorUserId: input.user.id,
    participantId: input.participantId,
    dealOwnerUserId: input.dealOwnerUserId,
    authenticatedUserId: input.authenticatedUserId,
    portalToken: input.portalToken,
    testContext: input.testContext,
  });

  const decision = evaluateParticipantAccess({
    user: input.user,
    participantEmail: input.participantEmail,
    authenticatedUserId: input.authenticatedUserId,
    dealOwnerUserId: input.dealOwnerUserId,
    action: input.action,
    participantId: input.participantId,
    portalToken: input.portalToken,
    testContext,
  });

  if (
    decision.status === 'ok' &&
    decision.role === 'participant' &&
    decision.accessGrant === 'genuine' &&
    !input.authenticatedUserId?.trim()
  ) {
    await bindParticipantAuthenticatedUser({
      participantId: input.participantId,
      userId: input.user.id,
    });
  }

  return decision;
}

export function participantAuthDeniedResponse(): NextResponse {
  return NextResponse.json(
    {
      error: 'This account does not have access to this participant workspace.',
      code: 'FORBIDDEN',
      auth: { status: 'denied' },
    },
    { status: 403 }
  );
}

export { normalizeParticipantEmail };
