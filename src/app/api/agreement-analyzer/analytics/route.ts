import { NextRequest } from 'next/server';
import { z } from 'zod';

import { apiResponse, validateBody } from '@/lib/api/middleware';
import {
  AGREEMENT_ANALYZER_ANALYTICS_EVENTS,
  trackAgreementAnalyzerEvent,
} from '@/lib/agreement-analyzer/analytics/agreement-analyzer-analytics.server';

const schema = z.object({
  event: z.enum(AGREEMENT_ANALYZER_ANALYTICS_EVENTS),
  properties: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional(),
  timestamp: z.string().optional(),
  path: z.string().optional(),
});

/** POST /api/agreement-analyzer/analytics — public report funnel instrumentation. */
export async function POST(request: NextRequest) {
  const { data: body, error } = await validateBody(request, schema);
  if (error) {
    return error;
  }

  trackAgreementAnalyzerEvent(body.event, {
    ...(body.properties ?? {}),
    path: body.path,
    clientTimestamp: body.timestamp,
  });

  return apiResponse({ ok: true });
}
