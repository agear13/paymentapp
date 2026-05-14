import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { applyRateLimit } from '@/lib/rate-limit';
import {
  serviceCreatedAtIso,
  serviceUpdatedAtIso,
} from '@/lib/format/organization-service-timestamps';

const CreateSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z
    .string()
    .max(8000)
    .optional()
    .transform((s) => (s == null ? '' : s.trim())),
  price: z.number().positive().multipleOf(0.01),
  currency: z.string().length(3).transform((c) => c.toUpperCase()),
});

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const auth = await requireAuth(request);
    if (!auth.user) return auth.response!;

    const organizationId = request.nextUrl.searchParams.get('organizationId');
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    const canView = await checkUserPermission(auth.user.id, organizationId, 'view_payment_links');
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const statusFilter = request.nextUrl.searchParams.get('status');
    const activeWhere =
      statusFilter === 'active' ? { active: true } : statusFilter === 'archived' ? { active: false } : {};

    const rows = await prisma.organization_services.findMany({
      where: { organization_id: organizationId, ...activeWhere },
      orderBy: { created_at: 'desc' },
      take: 200,
      include: {
        _count: { select: { payment_links: true } },
      },
    });

    return NextResponse.json({
      data: rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        price: Number(r.price),
        currency: r.currency,
        active: r.active,
        createdAt: r.created_at.toISOString(),
        updatedAt: r.updated_at.toISOString(),
        linkedInvoiceCount: r._count.payment_links,
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

    const body = await request.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { organizationId, name, description, price, currency } = parsed.data;
    const canCreate = await checkUserPermission(auth.user.id, organizationId, 'create_payment_links');
    if (!canCreate) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const row = await prisma.organization_services.create({
      data: {
        id: randomUUID(),
        organization_id: organizationId,
        name: name.trim(),
        description: description.trim() || '',
        price,
        currency,
        active: true,
      },
    });

    const createdAt = serviceCreatedAtIso(row.created_at);
    const updatedAt = serviceUpdatedAtIso(row.created_at, row.updated_at);
    const fallbackIso = new Date(0).toISOString();

    return NextResponse.json(
      {
        data: {
          id: row.id,
          name: row.name,
          description: row.description,
          price: Number(row.price),
          currency: row.currency,
          active: row.active,
          createdAt: createdAt ?? fallbackIso,
          updatedAt: updatedAt ?? createdAt ?? fallbackIso,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
