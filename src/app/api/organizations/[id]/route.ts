import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { apiResponse, apiError, validateBody } from '@/lib/api/middleware';
import { log } from '@/lib/logger';

const updateOrganizationSchema = z.object({
  name: z.string().min(2).max(255),
});

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

    const organization = await prisma.organizations.findUnique({
      where: { id },
      include: {
        merchantSettings: true,
        _count: {
          select: {
            paymentLinks: true,
            ledgerAccounts: true,
          },
        },
      },
    });

    if (!organization) {
      return apiError('Organization not found', 404);
    }

    // TODO: Check if user has access to this organization

    return apiResponse(organization);
  } catch (error) {
    log.error({ error }, 'Failed to fetch organization');
    return apiError('Failed to fetch organization', 500);
  }
}

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
    const body = await validateBody(request, updateOrganizationSchema);
    
    if (body instanceof NextResponse) {
      return body;
    }

    // TODO: Check if user has permission to update this organization

    const organization = await prisma.organizations.update({
      where: { id },
      data: {
        name: body.name,
      },
    });

    log.info({ organizationId: id, userId: user.id }, 'Updated organization');

    return apiResponse(organization);
  } catch (error) {
    log.error({ error }, 'Failed to update organization');
    return apiError('Failed to update organization', 500);
  }
}

// DELETE /api/organizations/[id] - Delete organization
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const { id } = await params;

    // TODO: Check if user has permission to delete this organization
    // TODO: Add safeguards - check for active payment links, etc.

    await prisma.organizations.delete({
      where: { id },
    });

    log.info({ organizationId: id, userId: user.id }, 'Deleted organization');

    return apiResponse({ success: true });
  } catch (error) {
    log.error({ error }, 'Failed to delete organization');
    return apiError('Failed to delete organization', 500);
  }
}




