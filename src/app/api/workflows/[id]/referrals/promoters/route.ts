import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiResponse } from '@/lib/api/middleware';
import { requireWorkflowOrganizationAccess } from '@/lib/workflows/require-workflow-access';
import { requireReferralManagementEntitlement } from '@/lib/entitlements/gate-referral-admin.server';
import {
  addReferralManagementPromoter,
  lookupReferralPromoterByEmail,
  ReferralManagementError,
} from '@/lib/workflows/referral-management/promoter.server';

const compensationSchema = z
  .discriminatedUnion('kind', [
    z.object({
      kind: z.literal('revenue_share'),
      percentage: z.number().gt(0).lte(100),
      serviceId: z.string().uuid().optional(),
      serviceIds: z.array(z.string().uuid()).min(1).optional(),
    }),
    z.object({
      kind: z.literal('fixed'),
      amount: z.number().positive(),
      currency: z.string().length(3),
      serviceId: z.string().uuid().optional(),
      serviceIds: z.array(z.string().uuid()).min(1).optional(),
    }),
  ])
  .refine((value) => Boolean(value.serviceId) || (value.serviceIds?.length ?? 0) > 0, {
    message: 'Select at least one service',
  });

const bodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  phone: z.string().trim().max(40).optional(),
  role: z.enum(['Promoter', 'Affiliate', 'Partner', 'Other']),
  compensation: compensationSchema,
  reuseExisting: z.boolean().optional(),
});

async function requirePromoterAccess(request: NextRequest) {
  const access = await requireWorkflowOrganizationAccess(request);
  if (!access.ok) return { ok: false as const, response: access.response };
  const entitlement = await requireReferralManagementEntitlement({
    organizationId: access.organizationId,
    userId: access.userId,
    userEmail: access.userEmail,
  });
  if (entitlement) return { ok: false as const, response: entitlement };
  return { ok: true as const, access };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const scoped = await requirePromoterAccess(request);
  if (!scoped.ok) return scoped.response;

  const email = request.nextUrl.searchParams.get('email') ?? '';
  const parsed = z.string().trim().email().safeParse(email);
  if (!parsed.success) {
    return apiResponse({ existing: null });
  }

  const { id } = await context.params;
  try {
    const result = await lookupReferralPromoterByEmail({
      organizationId: scoped.access.organizationId,
      workflowId: id,
      userId: scoped.access.userId,
      email: parsed.data,
    });
    return apiResponse(result);
  } catch (error) {
    if (error instanceof ReferralManagementError) {
      return apiError(error.message, error.status, error.code, error.details);
    }
    throw error;
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const scoped = await requirePromoterAccess(request);
  if (!scoped.ok) return scoped.response;

  const { id } = await context.params;
  try {
    const body = bodySchema.parse(await request.json());
    const result = await addReferralManagementPromoter({
      organizationId: scoped.access.organizationId,
      workflowId: id,
      userId: scoped.access.userId,
      ...body,
    });
    return apiResponse(result);
  } catch (error) {
    if (error instanceof ReferralManagementError) {
      return apiError(error.message, error.status, error.code, error.details);
    }
    if (error instanceof z.ZodError) {
      return apiError('Invalid request', 400, 'INVALID_INPUT');
    }
    throw error;
  }
}
