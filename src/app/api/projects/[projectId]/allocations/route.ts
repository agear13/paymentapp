import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { applyRateLimit } from '@/lib/rate-limit';
import { CreateProjectAllocationSchema } from '@/lib/validations/schemas';
import {
  assertProjectOwnedByUser,
  createProjectAllocation,
  listProjectAllocations,
} from '@/lib/projects/allocations/allocations.server';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireAuth();
    const { projectId } = await context.params;
    const owned = await assertProjectOwnedByUser(user.id, projectId);
    if (!owned) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const data = await listProjectAllocations(user.id, projectId);
    return NextResponse.json({ data });
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[projects/allocations GET]', e);
    return NextResponse.json({ error: 'Failed to load allocations' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const user = await requireAuth();
    const { projectId } = await context.params;
    const owned = await assertProjectOwnedByUser(user.id, projectId);
    if (!owned) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = CreateProjectAllocationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const created = await createProjectAllocation(user.id, projectId, {
      title: parsed.data.title,
      role: parsed.data.role,
      description: parsed.data.description,
      budgetType: parsed.data.budgetType,
      budgetValue: parsed.data.budgetValue,
      currency: parsed.data.currency,
      notes: parsed.data.notes,
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[projects/allocations POST]', e);
    return NextResponse.json({ error: 'Failed to create allocation' }, { status: 500 });
  }
}
