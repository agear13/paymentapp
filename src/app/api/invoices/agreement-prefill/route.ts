import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { apiError, apiResponse } from '@/lib/api/middleware';
import { loadAuthorizedAgreementInvoicePrefill } from '@/lib/invoices/agreement-invoice-prefill.server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/invoices/agreement-prefill?sourceParticipantId=
 * Authenticated participant agreement facts for Create Invoice prefill.
 * Amount and timing are never taken from the query string.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError('Unauthorized', 401);
  }

  const hint =
    request.nextUrl.searchParams.get('sourceParticipantId') ??
    request.nextUrl.searchParams.get('participantId');

  const result = await loadAuthorizedAgreementInvoicePrefill({
    user: { id: user.id, email: user.email },
    sourceParticipantId: hint,
  });

  if (result.kind !== 'ok') {
    return apiError('Not found', 404);
  }

  return apiResponse({ prefill: result.prefill });
}
