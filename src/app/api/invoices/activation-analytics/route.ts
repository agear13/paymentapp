import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { apiResponse, validateBody } from '@/lib/api/middleware';
import { log } from '@/lib/logger';
import { PARTICIPANT_ACTIVATION_EVENTS } from '@/lib/invoices/participant-activation-analytics';

const schema = z.object({
  event: z.enum(PARTICIPANT_ACTIVATION_EVENTS),
  properties: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.string().optional(),
  path: z.string().optional(),
});

/**
 * POST /api/invoices/activation-analytics
 * Non-authoritative funnel logging. Does not persist or mutate conversion state.
 * User and organisation identity come from the authenticated session only.
 */
export async function POST(request: NextRequest) {
  const auth = await getCurrentUserForApi(request);
  if (!auth.user) return auth.response!;

  const { data: body, error } = await validateBody(request, schema);
  if (error) {
    return error;
  }

  const org = await getOrganizationForAuthenticatedUser(auth.user.id);

  log.info('participant.invoice_activation', {
    userId: auth.user.id,
    organizationId: org?.id ?? null,
    event: body.event,
    path: body.path,
    timestamp: body.timestamp,
  });

  return apiResponse({ ok: true });
}
