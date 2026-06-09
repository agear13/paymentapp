/**
 * POST /api/agreement-analyzer/process
 * Runs agreement extraction for a pending report or batch of pending reports.
 * Secured via CRON_SECRET for operational/cron invocation.
 */

export const runtime = 'nodejs';
export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  processAgreementExtraction,
  processPendingAgreementExtractions,
} from '@/lib/agreement-analyzer/extraction/process-agreement-extraction.server';
import {
  cronAuthFailureResponse,
  verifyCronRequest,
} from '@/lib/jobs/cron-request-auth';
import { loggers } from '@/lib/logger';

const bodySchema = z.object({
  reportId: z.string().uuid().optional(),
  uploadId: z.string().uuid().optional(),
  processPending: z.boolean().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export async function POST(request: NextRequest) {
  const cronFailure = verifyCronRequest(request);
  if (cronFailure) {
    return cronAuthFailureResponse(cronFailure);
  }

  try {
    const json = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const { reportId, uploadId, processPending, limit } = parsed.data;

    if (processPending) {
      const batch = await processPendingAgreementExtractions(limit ?? 10);
      return NextResponse.json({ success: true, batch });
    }

    if (!reportId && !uploadId) {
      return NextResponse.json(
        { error: 'Provide reportId, uploadId, or processPending=true.' },
        { status: 400 }
      );
    }

    const result = await processAgreementExtraction({ reportId, uploadId });
    if (!result.success) {
      return NextResponse.json(result, { status: 422 });
    }

    return NextResponse.json(result);
  } catch (error) {
    loggers.api.error('agreement-analyzer process route failed', error);
    return NextResponse.json({ error: 'Processing failed.' }, { status: 500 });
  }
}
