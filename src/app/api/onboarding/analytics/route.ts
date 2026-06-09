import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { apiError, apiResponse, validateBody } from '@/lib/api/middleware';
import { log } from '@/lib/logger';
import { ONBOARDING_ACTIVATION_EVENTS } from '@/lib/onboarding/onboarding-activation-analytics';

const schema = z.object({
  event: z.enum(ONBOARDING_ACTIVATION_EVENTS),
  properties: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional(),
  timestamp: z.string().optional(),
  path: z.string().optional(),
});

/** POST /api/onboarding/analytics — activation funnel instrumentation (non-blocking). */
export async function POST(request: NextRequest) {
  const auth = await getCurrentUserForApi(request);
  if (!auth.user) return auth.response!;
  const user = auth.user;

  const { data: body, error } = await validateBody(request, schema);
  if (error) {
    return error;
  }

  log.info('onboarding.activation', {
    userId: user.id,
    event: body.event,
    properties: body.properties,
    path: body.path,
    timestamp: body.timestamp,
  });

  return apiResponse({ ok: true });
}
