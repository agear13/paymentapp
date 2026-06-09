import 'server-only';

import { NextResponse } from 'next/server';
import { hasOrganizationAccess } from '@/lib/auth/organization-access';

/**
 * Returns a 403 response when the user is not a member of the organization.
 */
export async function requireOrganizationAccessOrForbidden(
  userId: string,
  organizationId: string
): Promise<NextResponse | null> {
  const allowed = await hasOrganizationAccess(userId, organizationId);
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}
