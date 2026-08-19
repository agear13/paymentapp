/**
 * Xero Disconnect Endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuditEventType, createAuditLog, AuditSeverity } from '@/lib/audit/audit-log';
import { extractRequestAuditContext } from '@/lib/audit/request-context.server';
import { disconnectXero } from '@/lib/xero';
import { logger } from '@/lib/logger';
import { requirePaymentConfigurationAccess } from '@/lib/auth/step-up.server';
import { notifyAccountSecurityEvent } from '@/lib/auth/sensitive-action-notify.server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const access = await requirePaymentConfigurationAccess(request, body.organizationId);
    if (!access.ok) return access.response;
    const user = access.user;
    const organizationId = access.organizationId;

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

    void notifyAccountSecurityEvent({
      to: user.email,
      subject: 'Xero was disconnected',
      text: 'The Xero connection for your Provvypay workspace was disconnected. If you did not do this, contact support immediately and reset your password.',
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
