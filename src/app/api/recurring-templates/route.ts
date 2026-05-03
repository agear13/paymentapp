import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { applyRateLimit } from '@/lib/rate-limit';
import { CreateRecurringTemplateSchema } from '@/lib/validations/schemas';
import { apiIntervalToPrisma } from '@/lib/recurring-templates/api-mappers';
import { serializeRecurringTemplate } from '@/lib/recurring-templates/serialize-template';

/**
 * GET /api/recurring-templates?organizationId=
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const auth = await requireAuth(request);
    if (!auth.user) return auth.response!;
    const { user } = auth;

    const organizationId = request.nextUrl.searchParams.get('organizationId');
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    const canView = await checkUserPermission(user.id, organizationId, 'view_payment_links');
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 });
    }

    const rows = await prisma.recurring_templates.findMany({
      where: { organization_id: organizationId },
      orderBy: [{ next_run_at: 'asc' }, { id: 'asc' }],
    });

    return NextResponse.json({ data: rows.map(serializeRecurringTemplate) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/recurring-templates
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const auth = await requireAuth(request);
    if (!auth.user) return auth.response!;
    const { user } = auth;

    const body = CreateRecurringTemplateSchema.parse(await request.json());

    const canCreate = await checkUserPermission(
      user.id,
      body.organizationId,
      'create_payment_links'
    );
    if (!canCreate) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    const org = await prisma.organizations.findUnique({
      where: { id: body.organizationId },
      select: { id: true },
    });
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const row = await prisma.recurring_templates.create({
      data: {
        organization_id: body.organizationId,
        amount: body.amount,
        currency: body.currency,
        description: body.description,
        customer_email: body.customerEmail ?? null,
        recurrence_interval: apiIntervalToPrisma(body.interval),
        interval_count: body.intervalCount,
        next_run_at: body.nextRunAt,
        end_date: body.endDate ? new Date(`${body.endDate}T00:00:00.000Z`) : null,
        due_days_after_invoice: body.dueDaysAfterInvoice ?? null,
        status: 'ACTIVE',
      },
    });

    return NextResponse.json({ data: serializeRecurringTemplate(row) }, { status: 201 });
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
