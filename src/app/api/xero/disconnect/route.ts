/**
 * Xero Disconnect Endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { AuditEventType, createAuditLog, AuditSeverity } from '@/lib/audit/audit-log';
import { extractRequestAuditContext } from '@/lib/audit/request-context.server';
import { disconnectXero } from '@/lib/xero';
import { logger } from '@/lib/logger';
import { hasOrganizationPermission } from '@/lib/auth/organization-access';
import { resolveSessionOrganizationId } from '@/lib/organization/resolve-organization-api.server';

export async function POST(request: NextRequest) {
  try {
    const auth = await getCurrentUserForApi(request);
    if (!auth.user) return auth.response!;
    const user = auth.user;

    const body = await request.json();
    const resolved = await resolveSessionOrganizationId(
      user.id,
      body.organizationId,
      'xero/disconnect'
    );
    if (resolved.response) return resolved.response;
    const organizationId = resolved.organizationId;

    const canManageSettings = await hasOrganizationPermission(
      user.id,
      organizationId,
      'manage_settings'
    );
    if (!canManageSettings) {
      return NextResponse.json(
        { error: 'Forbidden - insufficient organization permissions' },
        { status: 403 }
      );
    }

    await disconnectXero(organizationId);

    logger.info('Xero connection disconnected', {
      organizationId,
      userId: user.id,
    });

    const auditCtx = extractRequestAuditContext(request);
    void createAuditLog({
      eventType: AuditEventType.XERO_DISCONNECTED,
      severity: AuditSeverity.INFO,
      userId: user.id,
      organizationId,
      resource: 'xero_integration',
      resourceId: organizationId,
      action: 'disconnect',
      ipAddress: auditCtx.ipAddress,
      userAgent: auditCtx.userAgent,
      correlationId: auditCtx.correlationId,
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: 'Xero connection disconnected successfully',
    });
  } catch (error) {
    logger.error('Error disconnecting Xero', { error });
    return NextResponse.json(
      { error: 'Failed to disconnect Xero' },
      { status: 500 }
    );
  }
}
