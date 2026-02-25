/**
 * Create Payout Batch API
 * POST /api/payout-batches/create
 * Groups unpaid obligation lines by payee, filters by threshold, creates batch + payouts
 * 
 * NOTE: This API is restricted to beta admins during BETA_LOCKDOWN_MODE
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { isBetaAdminEmail } from '@/lib/auth/admin-shared';
import { applyRateLimit } from '@/lib/rate-limit';
import { log } from '@/lib/logger';
import { z } from 'zod';

function checkBetaLockdown(userEmail?: string | null): NextResponse | null {
  const betaLockdownEnabled = process.env.BETA_LOCKDOWN_MODE !== 'false';
  if (betaLockdownEnabled && !isBetaAdminEmail(userEmail)) {
    return NextResponse.json(
      { error: 'Forbidden: This feature is restricted during beta' },
      { status: 403 }
    );
  }
  return null;
}

const CreateBatchSchema = z.object({
  organizationId: z.string().uuid(),
  currency: z.string().length(3),
  minThreshold: z.number().min(0).optional(),
  roleFilter: z.enum(['CONSULTANT', 'BD_PARTNER']).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const auth = await requireAuth(request);
    if (!auth.user) return auth.response!;
    const { user } = auth;

    const lockdownResponse = checkBetaLockdown(user.email);
    if (lockdownResponse) return lockdownResponse;

    const body = await request.json();
    const parsed = CreateBatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { organizationId, currency, minThreshold = 50, roleFilter } = parsed.data;

    const canManage = await checkUserPermission(user.id, organizationId, 'manage_ledger');
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const currencyUpper = currency.toUpperCase();

    const lines = await prisma.commission_obligation_lines.findMany({
      where: {
        status: 'POSTED',
        payout_id: null,
        currency: currencyUpper,
        payee_user_id: { not: 'PENDING_BENEFICIARY' },
        ...(roleFilter && { role: roleFilter }),
        commission_obligations: {
          payment_links: { organization_id: organizationId },
        },
      },
      include: {
        commission_obligations: true,
      },
    });

    const grouped = new Map<
      string,
      { amount: number; lines: (typeof lines)[0][]; role: string }
    >();

    for (const line of lines) {
      const key = line.payee_user_id;
      const amount = Number(line.amount);
      if (!grouped.has(key)) {
        grouped.set(key, { amount: 0, lines: [], role: line.role });
      }
      const g = grouped.get(key)!;
      g.amount += amount;
      g.lines.push(line);
    }

    const payeesAboveThreshold: { userId: string; amount: number; lines: typeof lines; role: string }[] = [];
    for (const [userId, g] of grouped) {
      if (g.amount >= minThreshold) {
        payeesAboveThreshold.push({
          userId,
          amount: g.amount,
          lines: g.lines,
          role: g.role,
        });
      }
    }

    if (payeesAboveThreshold.length === 0) {
      return NextResponse.json(
        {
          error: 'No payees above threshold',
          message: `No unpaid obligations >= ${minThreshold} ${currencyUpper}. Try lowering minThreshold or check for posted commissions.`,
        },
        { status: 400 }
      );
    }

    const totalAmount = payeesAboveThreshold.reduce((s, p) => s + p.amount, 0);
    const correlationId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const [batch] = await prisma.$transaction(async (tx) => {
      const batch = await tx.payout_batches.create({
        data: {
          organization_id: organizationId,
          currency: currencyUpper,
          status: 'DRAFT',
          payout_count: payeesAboveThreshold.length,
          total_amount: totalAmount,
          created_by: user.id,
        },
      });

      for (const payee of payeesAboveThreshold) {
        const defaultMethod = await tx.payout_methods.findFirst({
          where: {
            organization_id: organizationId,
            user_id: payee.userId,
            is_default: true,
            status: 'ACTIVE',
          },
        });
        const payout = await tx.payouts.create({
          data: {
            organization_id: organizationId,
            batch_id: batch.id,
            user_id: payee.userId,
            payout_method_id: defaultMethod?.id ?? undefined,
            currency: currencyUpper,
            gross_amount: payee.amount,
            fee_amount: 0,
            net_amount: payee.amount,
            status: 'DRAFT',
          },
        });

        await tx.commission_obligation_lines.updateMany({
          where: { id: { in: payee.lines.map((l) => l.id) } },
          data: { payout_id: payout.id },
        });

        // Option B: link commission_obligation_items to this payout (payee = split.beneficiary_id)
        const obligationIds = [...new Set(payee.lines.map((l) => l.obligation_id))];
        const payeeSplitIds = await tx.referral_link_splits
          .findMany({
            where: { beneficiary_id: payee.userId },
            select: { id: true },
          })
          .then((s) => s.map((x) => x.id));
        if (payeeSplitIds.length > 0 && obligationIds.length > 0) {
          await tx.commission_obligation_items.updateMany({
            where: {
              split_id: { in: payeeSplitIds },
              commission_obligation_id: { in: obligationIds },
              payout_id: null,
              status: 'POSTED',
              currency: currencyUpper,
            },
            data: { payout_id: payout.id },
          });
        }
      }

      return [batch];
    });

    log.info(
      {
        correlationId,
        organizationId,
        batchId: batch.id,
        payoutCount: payeesAboveThreshold.length,
        totalAmount,
        currency: currencyUpper,
      },
      'Payout batch created'
    );

    return NextResponse.json(
      {
        data: {
          id: batch.id,
          currency: batch.currency,
          status: batch.status,
          payoutCount: batch.payout_count,
          totalAmount: Number(batch.total_amount),
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    log.error({ error: message }, 'Payout batch creation failed');
    try {
      const body = await request.clone().json().catch(() => ({}));
      const orgId = (body as { organizationId?: string }).organizationId;
      if (orgId) {
        await prisma.notifications.create({
          data: {
            organization_id: orgId,
            type: 'SYSTEM_ALERT',
            title: 'Payout batch creation failed',
            message: `Error: ${message}`,
            data: { error: message },
          },
        });
      }
    } catch {
      // ignore
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
