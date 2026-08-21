import { NextRequest, NextResponse } from 'next/server';
import { listAuthorisedParticipantWorkspacesForUser } from '@/lib/participant-portal/participant-portal.server';
import { getParticipantSessionUser } from '@/lib/participant-portal/participant-session.server';

export const dynamic = 'force-dynamic';

/**
 * Lists participant workspaces for the verified session only.
 * Query parameters, emails, and tokens in the request are ignored.
 */
export async function GET(_request: NextRequest) {
  const user = await getParticipantSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required', code: 'UNAUTHENTICATED' },
      { status: 401 }
    );
  }

  const workspaces = await listAuthorisedParticipantWorkspacesForUser(user);

  return NextResponse.json({
    signedInEmail: user.email,
    workspaces,
  });
}
