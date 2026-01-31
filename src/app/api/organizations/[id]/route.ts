import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { apiResponse, apiError, validateBody } from '@/lib/api/middleware';
import { log } from '@/lib/logger';

const updateOrganizationSchema = z.object({
  name: z.string().min(2).max(255).optional(),
});

// PATCH /api/organizations/[id] - Update organization
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const { id } = await params;

    // Verify user has access to this organization
    const userOrg = await prisma.user_organizations.findFirst({
      where: {
        user_id: user.id,
        organization_id: id,
      },
    });

    if (!userOrg) {
      return apiError('Organization not found or access denied', 404);
    }

    const { data: body, error } = await validateBody(request, updateOrganizationSchema);
    
    if (error) {
      return error;
    }

    // Update organization
    const organization = await prisma.organizations.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
      },
    });

    log.info({ organizationId: id, userId: user.id }, 'Updated organization');

    return apiResponse(organization);
  } catch (error) {
    log.error({ error }, 'Failed to update organization');
    return apiError('Failed to update organization', 500);
  }
}

// GET /api/organizations/[id] - Get organization details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const { id } = await params;

    // Verify user has access to this organization
    const userOrg = await prisma.user_organizations.findFirst({
      where: {
        user_id: user.id,
        organization_id: id,
      },
      include: {
        organizations: true,
      },
    });

    if (!userOrg) {
      return apiError('Organization not found or access denied', 404);
    }

    return apiResponse({
      ...userOrg.organizations,
      role: userOrg.role,
    });
  } catch (error) {
    log.error({ error }, 'Failed to fetch organization');
    return apiError('Failed to fetch organization', 500);
  }
}
