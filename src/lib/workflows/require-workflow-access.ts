import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { hasOrganizationAccess } from '@/lib/auth/organization-access';

export async function requireWorkflowOrganizationAccess(
  request?: NextRequest | Request
): Promise<
  | { ok: true; organizationId: string; userId: string; userEmail: string | null }
  | { ok: false; response: NextResponse }
> {
  const auth = await getCurrentUserForApi(request as NextRequest | undefined);
  if (!auth.user) {
    return { ok: false, response: auth.response! };
  }

  const org = await getOrganizationForAuthenticatedUser(auth.user.id);
  if (!org) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Organization required' }, { status: 403 }),
    };
  }

  const isMember = await hasOrganizationAccess(auth.user.id, org.id);
  if (!isMember) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return {
    ok: true,
    organizationId: org.id,
    userId: auth.user.id,
    userEmail: auth.user.email ?? null,
  };
}
