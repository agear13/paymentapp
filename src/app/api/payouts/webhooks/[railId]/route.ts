import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit } from '@/lib/rate-limit';
import { ingestPayoutWebhook } from '@/lib/payouts/ingest-payout-webhook.server';
import { PayoutReleaseError } from '@/lib/payouts/payout-status-transitions';

function headerRecord(request: NextRequest): Record<string, string | undefined> {
  const headers: Record<string, string | undefined> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ railId: string }> }
) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const { railId } = await params;
    const rawBody = await request.text();
    const result = await ingestPayoutWebhook({
      railId,
      rawBody,
      headers: headerRecord(request),
    });

    if (result.acknowledgement) {
      return new NextResponse(result.acknowledgement.body, {
        status: 200,
        headers: { 'Content-Type': result.acknowledgement.contentType },
      });
    }

    return NextResponse.json({ data: result }, { status: result.ignored ? 202 : 200 });
  } catch (error: unknown) {
    if (error instanceof PayoutReleaseError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.httpStatus }
      );
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
