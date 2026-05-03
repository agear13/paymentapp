import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { applyRateLimit } from '@/lib/rate-limit';
import { PatchRecurringTemplateSchema } from '@/lib/validations/schemas';
import { apiIntervalToPrisma, apiStatusToPrisma } from '@/lib/recurring-templates/api-mappers';
import { serializeRecurringTemplate } from '@/lib/recurring-templates/serialize-template';

/**
 * PATCH /api/recurring-templates/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const auth = await requireAuth(request);
    if (!auth.user) return auth.response!;
    const { user } = auth;

    const { id } = params;
    const existing = await prisma.recurring_templates.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const canEdit = await checkUserPermission(
      user.id,
      existing.organization_id,
      'edit_payment_links'
    );
    if (!canEdit) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = PatchRecurringTemplateSchema.parse(await request.json());

    const data: Prisma.recurring_templatesUpdateInput = {};
    if (body.status != null) data.status = apiStatusToPrisma(body.status);
    if (body.nextRunAt != null) data.next_run_at = body.nextRunAt;
    if (body.description != null) data.description = body.description;
    if (body.interval != null) data.recurrence_interval = apiIntervalToPrisma(body.interval);
    if (body.intervalCount != null) data.interval_count = body.intervalCount;
    if (body.endDate !== undefined) {
      data.end_date =
        body.endDate === null ? null : new Date(`${body.endDate}T00:00:00.000Z`);
    }
    if (body.dueDaysAfterInvoice !== undefined) {
      data.due_days_after_invoice = body.dueDaysAfterInvoice;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const row = await prisma.recurring_templates.update({
      where: { id },
      data,
    });

    return NextResponse.json({ data: serializeRecurringTemplate(row) });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.flatten() },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
