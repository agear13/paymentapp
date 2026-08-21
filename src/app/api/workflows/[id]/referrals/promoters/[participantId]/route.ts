import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiResponse } from '@/lib/api/middleware';
import { requireWorkflowOrganizationAccess } from '@/lib/workflows/require-workflow-access';
import { requireReferralManagementEntitlement } from '@/lib/entitlements/gate-referral-admin.server';
import {
  ReferralManagementError,
  runReferralManagementAction,
  updateReferralManagementPromoterServices,
} from '@/lib/workflows/referral-management/promoter.server';

const bodySchema = z.object({
  action: z.enum([
    'request_approval',
    'request_payout_details',
    'approve_payout_details',
    'flag_payout_details',
    'activate_referral',
  ]),
  missingFields: z.array(z.string().min(1).max(80)).max(20).optional(),
  requestedChanges: z.string().max(2000).optional(),
});

const patchSchema = z.object({
  serviceIds: z.array(z.string().uuid()).min(1).max(200),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; participantId: string }> }
) {
  const access = await requireWorkflowOrganizationAccess(request);
  if (!access.ok) return access.response;

  const entitlement = await requireReferralManagementEntitlement({
    organizationId: access.organizationId,
    userId: access.userId,
    userEmail: access.userEmail,
  });
  if (entitlement) return entitlement;

  const { id, participantId } = await context.params;
  try {
    const body = bodySchema.parse(await request.json().catch(() => ({})));
    const result = await runReferralManagementAction({
      organizationId: access.organizationId,
      workflowId: id,
      userId: access.userId,
      participantId,
      action: body.action,
      origin: request.nextUrl.origin,
      missingFields: body.missingFields,
      requestedChanges: body.requestedChanges,
    });
    return apiResponse(result);
  } catch (error) {
    if (error instanceof ReferralManagementError) {
      return apiError(error.message, error.status, error.code);
    }
    if (error instanceof z.ZodError) {
      return apiError('Invalid request', 400, 'INVALID_INPUT');
    }
    throw error;
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; participantId: string }> }
) {
  const access = await requireWorkflowOrganizationAccess(request);
  if (!access.ok) return access.response;

  const entitlement = await requireReferralManagementEntitlement({
    organizationId: access.organizationId,
    userId: access.userId,
    userEmail: access.userEmail,
  });
  if (entitlement) return entitlement;

  const { id, participantId } = await context.params;
  try {
    const body = patchSchema.parse(await request.json().catch(() => ({})));
    const result = await updateReferralManagementPromoterServices({
      organizationId: access.organizationId,
      workflowId: id,
      userId: access.userId,
      participantId,
      serviceIds: body.serviceIds,
    });
    return apiResponse(result);
  } catch (error) {
    if (error instanceof ReferralManagementError) {
      return apiError(error.message, error.status, error.code);
    }
    if (error instanceof z.ZodError) {
      return apiError('Invalid request', 400, 'INVALID_INPUT');
    }
    throw error;
  }
}
