import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiResponse, validateBody } from '@/lib/api/middleware';
import { applyRateLimit } from '@/lib/rate-limit';
import { requireWorkflowOrganizationAccess } from '@/lib/workflows/require-workflow-access';
import {
  getCommitmentById,
  markCommitmentSubmitted,
  writeCommitmentAudit,
} from '@/lib/xlayer/store.server';
import { parseSubmitInput } from '@/lib/xlayer/validation';

const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/;

const submitSchema = z.object({
  transactionHash: z.string().regex(TX_HASH_RE),
  walletAddress: z.string().min(1),
  chainId: z.number().int(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const rateLimitResult = await applyRateLimit(request, 'api');
  if (!rateLimitResult.success) return apiError('Rate limit exceeded', 429);

  const access = await requireWorkflowOrganizationAccess(request);
  if (!access.ok) return access.response;

  const { id } = await context.params;
  const { data: body, error } = await validateBody(request, submitSchema);
  if (error || !body) return error ?? apiError('Invalid request', 400);

  let parsed;
  try {
    parsed = parseSubmitInput(body);
  } catch (caught) {
    const status =
      caught && typeof caught === 'object' && 'status' in caught
        ? Number((caught as { status: number }).status)
        : 400;
    const code =
      caught && typeof caught === 'object' && 'code' in caught
        ? String((caught as { code: string }).code)
        : 'INVALID_SUBMIT';
    return apiError(caught instanceof Error ? caught.message : 'Invalid submit', status, code);
  }

  const existing = await getCommitmentById({
    organizationId: access.organizationId,
    id,
  });
  if (!existing) return apiError('Commitment not found', 404, 'NOT_FOUND');
  if (existing.verificationStatus !== 'prepared') {
    return apiError('Commitment is not prepared', 409, 'NOT_PREPARED');
  }

  try {
    const record = await markCommitmentSubmitted({
      organizationId: access.organizationId,
      id,
      transactionHash: parsed.transactionHash,
      walletAddress: parsed.walletAddress,
    });
    await writeCommitmentAudit({
      organizationId: access.organizationId,
      userId: access.userId,
      entityId: record.id,
      action: 'submitted',
      values: {
        transactionHash: record.transactionHash,
        walletAddress: record.walletAddress,
        chainId: parsed.chainId,
      },
    });
    return apiResponse({ enabled: true, commitment: record });
  } catch (caught) {
    const status =
      caught && typeof caught === 'object' && 'status' in caught
        ? Number((caught as { status: number }).status)
        : 500;
    const message = caught instanceof Error ? caught.message : 'Unable to submit commitment';
    const code =
      caught && typeof caught === 'object' && 'code' in caught
        ? String((caught as { code: string }).code)
        : undefined;
    return apiError(message, Number.isInteger(status) ? status : 500, code);
  }
}
