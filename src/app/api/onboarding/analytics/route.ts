import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
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
  const user = await getCurrentUser();
  if (!user) {
    return apiError('Unauthorized', 401);
  }

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
