import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiResponse, validateBody } from '@/lib/api/middleware';
import { extractRequestAuditContext } from '@/lib/audit/request-context.server';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { recordAdvisorActivity } from '@/lib/email/lifecycle/server-advisor-signal';

const schema = z.object({
  organizationId: z.string().uuid().optional(),
  action: z.enum(['viewed_advisor', 'engaged_prompt', 'workflow_recommendation_click']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  const auth = await getCurrentUserForApi(request);
  if (!auth.user) return auth.response;

  const { data: body, error } = await validateBody(request, schema);
  if (error) return error;

  try {
    const context = extractRequestAuditContext(request);
    await recordAdvisorActivity({
      userId: auth.user.id,
      organizationId: body?.organizationId,
      action: body?.action || 'viewed_advisor',
      metadata: body?.metadata,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return apiResponse({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to record advisor activity';
    return apiError(message, 500);
  }
}
