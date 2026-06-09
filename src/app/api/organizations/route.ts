import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { AuditEventType, logDataEvent, createAuditLog, AuditSeverity } from '@/lib/audit/audit-log';
import { extractRequestAuditContext } from '@/lib/audit/request-context.server';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { apiResponse, apiError, validateBody } from '@/lib/api/middleware';
import { log } from '@/lib/logger';

const createOrganizationSchema = z.object({
  name: z.string().min(2).max(255),
  clerkOrgId: z.string().optional(),
});

// GET /api/organizations - List user's organizations
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    // Get only organizations the user has access to via user_organizations table
    const userOrgs = await prisma.$queryRaw<Array<{
      id: string;
      clerk_org_id: string;
      name: string;
      created_at: Date;
      role: string;
    }>>`
      SELECT o.id, o.clerk_org_id, o.name, o.created_at, uo.role
      FROM organizations o
      INNER JOIN user_organizations uo ON uo.organization_id = o.id
      WHERE uo.user_id = ${user.id}
      ORDER BY uo.created_at ASC
    `;

    log.info({ userId: user.id, count: userOrgs.length }, 'Listed user organizations');

    return apiResponse(userOrgs);
  } catch (error) {
    log.error({ error }, 'Failed to list organizations');
    return apiError('Failed to fetch organizations', 500);
  }
}

// POST /api/organizations - Create new organization
export async function POST(request: NextRequest) {
  try {
    const auth = await getCurrentUserForApi(request);
    if (!auth.user) return auth.response!;
    const user = auth.user;

    const { data: body, error } = await validateBody(request, createOrganizationSchema);
    
    if (error) {
      return error;
    }

    // Generate clerk_org_id if not provided
    const clerkOrgId = body.clerkOrgId || `org_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Check if organization with this Clerk ID already exists
    const existing = await prisma.organizations.findUnique({
      where: { clerk_org_id: clerkOrgId },
    });

    if (existing) {
      return apiError('Organization already exists', 409);
    }

    const primaryOrg = await getOrganizationForAuthenticatedUser(user.id);
    if (primaryOrg) {
      const { requireEntitlement } = await import('@/lib/entitlements/gate-api.server');
      const entitlementBlock = await requireEntitlement({
        organizationId: primaryOrg.id,
        userId: user.id,
        userEmail: user.email,
        feature: 'multi_organisation',
      });
      if (entitlementBlock) return entitlementBlock;
    }

    // Create organization and link to user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the organization
      const organization = await tx.organizations.create({
        data: {
          name: body.name,
          clerk_org_id: clerkOrgId,
        },
      });

      // Link the user to the organization as OWNER
      await tx.user_organizations.create({
        data: {
          user_id: user.id,
          organization_id: organization.id,
          role: 'OWNER',
        },
      });

      return organization;
    });

    log.info({ organizationId: result.id, userId: user.id }, 'Created organization and linked user');

    const auditCtx = extractRequestAuditContext(request);
    void logDataEvent({
      eventType: AuditEventType.ORG_CREATED,
      userId: user.id,
      organizationId: result.id,
      resource: 'organization',
      resourceId: result.id,
      action: 'create',
      newValue: { name: result.name },
      ipAddress: auditCtx.ipAddress,
    });

    void createAuditLog({
      eventType: AuditEventType.ORG_MEMBERSHIP_CHANGED,
      severity: AuditSeverity.INFO,
      userId: user.id,
      organizationId: result.id,
      resource: 'user_organization',
      resourceId: result.id,
      action: 'membership_created',
      newValue: JSON.stringify({ role: 'OWNER' }),
      ipAddress: auditCtx.ipAddress,
      userAgent: auditCtx.userAgent,
      correlationId: auditCtx.correlationId,
      timestamp: new Date(),
    });

    return apiResponse(result, 201);
  } catch (error) {
    log.error({ error }, 'Failed to create organization');
    return apiError('Failed to create organization', 500);
  }
}




