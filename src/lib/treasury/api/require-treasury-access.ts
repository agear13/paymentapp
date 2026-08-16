import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { hasOrganizationAccess } from '@/lib/auth/organization-access';
import { prisma } from '@/lib/server/prisma';

export function getTreasuryOrganizationId(req: NextRequest): string | null {
  const { searchParams } = new URL(req.url);
  return (
    searchParams.get('organizationId') ||
    searchParams.get('orgId') ||
    req.headers.get('x-organization-id')
  );
}

export async function requireTreasuryOrganizationAccess(req: NextRequest): Promise<
  | { ok: true; organizationId: string; userId: string }
  | { ok: false; response: NextResponse }
> {
  const auth = await getCurrentUserForApi(req);
  if (!auth.user) {
    return { ok: false, response: auth.response! };
  }

  const organizationId = getTreasuryOrganizationId(req);
  if (!organizationId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'organizationId is required' }, { status: 400 }),
    };
  }

  const organization = await prisma.organizations.findUnique({
    where: { id: organizationId },
    select: { id: true },
  });

  if (!organization) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Organization not found' }, { status: 404 }),
    };
  }

  const isMember = await hasOrganizationAccess(auth.user.id, organization.id);
  if (!isMember) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { ok: true, organizationId: organization.id, userId: auth.user.id };
}
