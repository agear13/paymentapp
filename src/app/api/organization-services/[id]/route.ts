import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { applyRateLimit } from '@/lib/rate-limit';
import { UpdateOrganizationServiceSchema } from '@/lib/validations/schemas';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import {
  serviceCreatedAtIso,
  serviceUpdatedAtIso,
} from '@/lib/format/organization-service-timestamps';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const auth = await requireAuth(request);
    if (!auth.user) return auth.response!;

    const userOrg = await getOrganizationForAuthenticatedUser(auth.user.id);
    if (!userOrg) {
      return NextResponse.json({ error: 'No organization found for user' }, { status: 403 });
    }

    const { id } = await params;
    if (!id?.trim()) {
      return NextResponse.json({ error: 'Service id is required' }, { status: 400 });
    }

    const existing = await prisma.organization_services.findUnique({
      where: { id },
      select: {
        id: true,
        organization_id: true,
        name: true,
        description: true,
        price: true,
        currency: true,
        active: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    // Org is always taken from the persisted row — never from the client body.
    const canMutate = await checkUserPermission(
      auth.user.id,
      existing.organization_id,
      'create_payment_links'
    );
    if (!canMutate) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = UpdateOrganizationServiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const patch = parsed.data;
    const row = await prisma.organization_services.update({
      where: { id: existing.id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
        ...(patch.description !== undefined ? { description: patch.description.trim() } : {}),
        ...(patch.price !== undefined ? { price: patch.price } : {}),
        ...(patch.currency !== undefined ? { currency: patch.currency } : {}),
        ...(patch.active !== undefined ? { active: patch.active } : {}),
      },
    });

    const createdAt = serviceCreatedAtIso(row.created_at);
    const updatedAt = serviceUpdatedAtIso(row.created_at, row.updated_at);
    const fallbackIso = new Date(0).toISOString();

    return NextResponse.json({
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
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
