import 'server-only';

import { AuditEventType, AuditSeverity, createAuditLog } from '@/lib/audit/audit-log';
import { prisma } from '@/lib/server/prisma';

export type RecordAdvisorActivityInput = {
  userId: string;
  organizationId?: string | null;
  action?: 'viewed_advisor' | 'engaged_prompt' | 'workflow_recommendation_click';
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
};

/**
 * Records a server-side activity signal when a user meaningfully visits
 * or interacts with the AI Advisor.
 */
export async function recordAdvisorActivity(
  input: RecordAdvisorActivityInput
): Promise<void> {
  const now = new Date();
  await createAuditLog({
    eventType: AuditEventType.WORKSPACE_ADVISOR_ACTIVITY,
    severity: AuditSeverity.INFO,
    userId: input.userId,
    organizationId: input.organizationId || undefined,
    resource: 'workspace_advisor',
    action: input.action || 'viewed_advisor',
    metadata: input.metadata,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    timestamp: now,
  });
}

/**
 * Checks whether the user or workspace has already meaningfully used
 * the AI Advisor. Used to suppress introductory AI Advisor emails.
 */
export async function hasMeaningfulAdvisorUsage(input: {
  userId?: string | null;
  organizationId?: string | null;
}): Promise<boolean> {
  if (!input.userId && !input.organizationId) return false;

  const conditions: { user_id?: string; organization_id?: string }[] = [];
  if (input.userId) conditions.push({ user_id: input.userId });
  if (input.organizationId) conditions.push({ organization_id: input.organizationId });

  const record = await prisma.audit_logs.findFirst({
    where: {
      event_type: AuditEventType.WORKSPACE_ADVISOR_ACTIVITY,
      OR: conditions,
    },
    select: { id: true },
  });

  return Boolean(record);
}
