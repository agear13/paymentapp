/**
 * Payout Methods API
 * GET /api/payout-methods - List payout methods for user
 * POST /api/payout-methods - Create or update payout method
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { applyRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const PayoutMethodTypeEnum = z.enum(['PAYPAL', 'WISE', 'BANK_TRANSFER', 'CRYPTO', 'MANUAL_NOTE']);

const CreatePayoutMethodSchema = z.object({
  organizationId: z.string().uuid(),
  userId: z.string().min(1).optional(),
  methodType: PayoutMethodTypeEnum,
  handle: z.string().max(255).optional().nullable(),
  notes: z.string().optional().nullable(),
  isDefault: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const auth = await requireAuth(request);
    if (!auth.user) return auth.response!;
    const { user } = auth;

    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    const userIdParam = searchParams.get('userId');

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    const canView = await checkUserPermission(user.id, organizationId, 'view_payment_links');
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const canManage = await checkUserPermission(user.id, organizationId, 'manage_ledger');
    const where: { organization_id: string; user_id?: string; status: string } = {
      organization_id: organizationId,
      status: 'ACTIVE',
    };
    if (userIdParam) {
      where.user_id = userIdParam;
    } else if (!canManage) {
      where.user_id = user.id;
    }
    // If canManage and no userIdParam: list all methods for org

    const methods = await prisma.payout_methods.findMany({
      where,
      orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
    });

    return NextResponse.json({
      data: methods.map((m) => ({
        id: m.id,
        userId: m.user_id,
        methodType: m.method_type,
        handle: m.handle,
        notes: m.notes,
        isDefault: m.is_default,
        status: m.status,
        createdAt: m.created_at,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const auth = await requireAuth(request);
    if (!auth.user) return auth.response!;
    const { user } = auth;

    const body = await request.json();
    const parsed = CreatePayoutMethodSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { organizationId, methodType, handle, notes, isDefault } = parsed.data;
    const userId = parsed.data.userId ?? user.id;

    const canManage = await checkUserPermission(user.id, organizationId, 'manage_ledger');
    const isOwnMethod = userId === user.id;
    const canView = await checkUserPermission(user.id, organizationId, 'view_payment_links');
    if (isOwnMethod && !canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!isOwnMethod && !canManage) {
      return NextResponse.json(
        { error: 'Forbidden: can only add payout methods for others with manage_ledger' },
        { status: 403 }
      );
    }

    if (isDefault) {
      await prisma.payout_methods.updateMany({
        where: { organization_id: organizationId, user_id: userId },
        data: { is_default: false },
      });
    }

    const method = await prisma.payout_methods.create({
      data: {
        organization_id: organizationId,
        user_id: userId,
        method_type: methodType,
        handle: handle ?? undefined,
        notes: notes ?? undefined,
        is_default: isDefault ?? false,
      },
    });

    return NextResponse.json(
      {
        data: {
          id: method.id,
          methodType: method.method_type,
          handle: method.handle,
          notes: method.notes,
          isDefault: method.is_default,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
