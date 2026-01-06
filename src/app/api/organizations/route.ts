import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { apiResponse, apiError, validateBody } from '@/lib/api/middleware';
import { log } from '@/lib/logger';

const createOrganizationSchema = z.object({
  name: z.string().min(2).max(255),
  clerkOrgId: z.string(),
});

// GET /api/organizations - List user's organizations
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    // TODO: Implement proper user-organization relationship
    // For now, return all organizations (will be filtered by Clerk org membership)
    const organizations = await prisma.organizations.findMany({
      select: {
        id: true,
        clerk_org_id: true,
        name: true,
        created_at: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    log.info({ userId: user.id, count: organizations.length }, 'Listed organizations');

    return apiResponse(organizations);
  } catch (error) {
    log.error({ error }, 'Failed to list organizations');
    return apiError('Failed to fetch organizations', 500);
  }
}

// POST /api/organizations - Create new organization
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const body = await validateBody(request, createOrganizationSchema);
    
    if (body instanceof NextResponse) {
      return body;
    }

    // Check if organization with this Clerk ID already exists
    const existing = await prisma.organizations.findUnique({
      where: { clerk_org_id: body.clerkOrgId },
    });

    if (existing) {
      return apiError('Organization already exists', 409);
    }

    const organization = await prisma.organizations.create({
      data: {
        name: body.name,
        clerk_org_id: body.clerkOrgId,
      },
    });

    log.info({ organizationId: organization.id, userId: user.id }, 'Created organization');

    return apiResponse(organization, 201);
  } catch (error) {
    log.error({ error }, 'Failed to create organization');
    return apiError('Failed to create organization', 500);
  }
}




