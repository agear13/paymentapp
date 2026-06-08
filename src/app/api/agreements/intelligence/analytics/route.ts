import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { apiError, apiResponse, validateBody } from '@/lib/api/middleware';
import { log } from '@/lib/logger';
import { AGREEMENT_INTELLIGENCE_EVENTS } from '@/lib/agreements/validation/agreement-intelligence-analytics';
import { aggregateAgreementIntelligenceValidation } from '@/lib/agreements/validation/aggregate-validation-metrics';
import {
  ingestAgreementIntelligenceEvent,
  listAgreementIntelligenceEvents,
} from '@/lib/agreements/validation/agreement-intelligence-validation-store.server';

const postSchema = z.object({
  event: z.enum(AGREEMENT_INTELLIGENCE_EVENTS),
  properties: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional(),
  timestamp: z.string().optional(),
  path: z.string().optional(),
});

/** POST /api/agreements/intelligence/analytics — validation instrumentation (non-blocking). */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError('Unauthorized', 401);
  }

  const { data: body, error } = await validateBody(request, postSchema);
  if (error) {
    return error;
  }

  ingestAgreementIntelligenceEvent({
    userId: user.id,
    event: body.event,
    properties: body.properties,
    timestamp: body.timestamp,
    path: body.path,
  });

  log.info('agreement.intelligence.validation', {
    userId: user.id,
    event: body.event,
    properties: body.properties,
    path: body.path,
    timestamp: body.timestamp,
  });

  return apiResponse({ ok: true });
}

/** GET /api/agreements/intelligence/analytics — aggregated validation report for dashboard. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError('Unauthorized', 401);
  }

  const since = request.nextUrl.searchParams.get('since') ?? undefined;
  const events = listAgreementIntelligenceEvents({ since });
  const report = aggregateAgreementIntelligenceValidation(events, { since });

  return apiResponse({ data: report });
}
