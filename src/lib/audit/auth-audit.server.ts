import 'server-only';

import { NextRequest } from 'next/server';
import {
  AuditEventType,
  AuditSeverity,
  createAuditLog,
} from '@/lib/audit/audit-log';
import { extractRequestAuditContext } from '@/lib/audit/request-context.server';

export type AuthAuditEventInput = {
  eventType: AuditEventType;
  userId?: string;
  organizationId?: string;
  email?: string;
  success?: boolean;
  reason?: string;
  metadata?: Record<string, unknown>;
  request?: NextRequest;
  correlationId?: string;
};

/**
 * Record authentication/authorization audit events without blocking the caller.
 */
export function recordAuthAuditEvent(input: AuthAuditEventInput): void {
  const ctx = input.request ? extractRequestAuditContext(input.request) : undefined;

  void createAuditLog({
    eventType: input.eventType,
    severity: (input.success ?? true) ? AuditSeverity.INFO : AuditSeverity.WARNING,
    userId: input.userId,
    organizationId: input.organizationId,
    ipAddress: ctx?.ipAddress,
    userAgent: ctx?.userAgent,
    correlationId: input.correlationId ?? ctx?.correlationId,
    metadata: {
      email: input.email,
      success: input.success ?? true,
      reason: input.reason,
      ...input.metadata,
    },
    timestamp: new Date(),
  }).catch(() => undefined);

  if (
    input.eventType === AuditEventType.PERMISSION_CHANGED ||
    input.eventType === AuditEventType.ORG_ROLE_CHANGED ||
    input.eventType === AuditEventType.ORG_MEMBERSHIP_CHANGED
  ) {
    void createAuditLog({
      eventType: input.eventType,
      severity: AuditSeverity.INFO,
      userId: input.userId,
      organizationId: input.organizationId,
      resource: 'organization',
      resourceId: input.organizationId,
      correlationId: input.correlationId ?? ctx?.correlationId,
      ipAddress: ctx?.ipAddress,
      userAgent: ctx?.userAgent,
      metadata: input.metadata,
      timestamp: new Date(),
    }).catch(() => undefined);
  }
}
