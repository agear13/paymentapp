import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { applyRateLimit } from '@/lib/rate-limit';
import {
  AssignProjectAllocationSchema,
  UpdateProjectAllocationSchema,
} from '@/lib/validations/schemas';
import {
  assertProjectOwnedByUser,
  deleteProjectAllocation,
  updateProjectAllocation,
} from '@/lib/projects/allocations/allocations.server';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; allocationId: string }> }
) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const user = await requireAuth();
    const { projectId, allocationId } = await context.params;
    const owned = await assertProjectOwnedByUser(user.id, projectId);
    if (!owned) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const assignOnly = Object.keys(body).length === 1 && 'participantId' in body;
    const parsed = assignOnly
      ? AssignProjectAllocationSchema.safeParse(body)
      : UpdateProjectAllocationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await updateProjectAllocation(user.id, projectId, allocationId, {
      ...(assignOnly
        ? { participantId: parsed.data.participantId }
        : {
            title: 'title' in parsed.data ? parsed.data.title : undefined,
            role: 'role' in parsed.data ? parsed.data.role : undefined,
            description:
              'description' in parsed.data ? parsed.data.description : undefined,
            budgetType: 'budgetType' in parsed.data ? parsed.data.budgetType : undefined,
            budgetValue: 'budgetValue' in parsed.data ? parsed.data.budgetValue : undefined,
            currency: 'currency' in parsed.data ? parsed.data.currency : undefined,
            notes: 'notes' in parsed.data ? parsed.data.notes : undefined,
            participantId:
              'participantId' in parsed.data ? parsed.data.participantId : undefined,
            status: 'status' in parsed.data ? parsed.data.status : undefined,
          }),
    });

    if (!updated) {
      return NextResponse.json({ error: 'Allocation not found' }, { status: 404 });
    }

    return NextResponse.json({ data: updated });
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[projects/allocations PATCH]', e);
    return NextResponse.json({ error: 'Failed to update allocation' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; allocationId: string }> }
) {
  try {
    const user = await requireAuth();
    const { projectId, allocationId } = await context.params;
    const owned = await assertProjectOwnedByUser(user.id, projectId);
    if (!owned) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const ok = await deleteProjectAllocation(user.id, projectId, allocationId);
    if (!ok) {
      return NextResponse.json({ error: 'Allocation not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[projects/allocations DELETE]', e);
    return NextResponse.json({ error: 'Failed to delete allocation' }, { status: 500 });
  }
}
