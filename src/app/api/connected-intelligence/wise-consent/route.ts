import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiResponse, validateBody } from '@/lib/api/middleware';
import { extractRequestAuditContext } from '@/lib/audit/request-context.server';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { hasOrganizationPermission } from '@/lib/auth/organization-access';
import {
  readWiseIntelligenceConsent,
  setWiseIntelligenceConsent,
} from '@/lib/connected-intelligence/consent';

const consentBodySchema = z.object({
  organizationId: z.string().uuid(),
  consented: z.boolean(),
});

export async function GET(request: NextRequest) {
  const auth = await getCurrentUserForApi(request);
  if (!auth.user) return auth.response;

  const organizationId = request.nextUrl.searchParams.get('organizationId');
  if (!organizationId) return apiError('organizationId is required', 400);

  const allowed = await hasOrganizationPermission(auth.user.id, organizationId, 'view_settings');
  if (!allowed) return apiError('Forbidden', 403);

  const state = await readWiseIntelligenceConsent(organizationId);
  return apiResponse(state);
}

export async function POST(request: NextRequest) {
  const auth = await getCurrentUserForApi(request);
  if (!auth.user) return auth.response;

  const { data: body, error } = await validateBody(request, consentBodySchema);
  if (error || !body) return error ?? apiError('Invalid request', 400);

  const allowed = await hasOrganizationPermission(
    auth.user.id,
    body.organizationId,
    'manage_settings'
  );
  if (!allowed) return apiError('Forbidden', 403);

  try {
    const context = extractRequestAuditContext(request);
    const state = await setWiseIntelligenceConsent({
      organizationId: body.organizationId,
      userId: auth.user.id,
      consented: body.consented,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return apiResponse(state);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to update consent';
    if (message === 'Merchant settings not found') return apiError(message, 404);
    return apiError(message, 500);
  }
}
