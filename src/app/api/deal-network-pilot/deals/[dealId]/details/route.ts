import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/middleware';
import {
  PROJECT_DETAILS_DESCRIPTION_MAX,
  PROJECT_DETAILS_NAME_MAX,
  PROJECT_DETAILS_PARTNER_MAX,
} from '@/lib/projects/update-project-details';
import {
  ProjectDetailsError,
  updateProjectDetailsForUser,
} from '@/lib/projects/update-project-details.server';

const bodySchema = z.object({
  dealName: z.string().trim().min(1).max(PROJECT_DETAILS_NAME_MAX),
  projectDescription: z.string().max(PROJECT_DETAILS_DESCRIPTION_MAX).optional().nullable(),
  partner: z.string().max(PROJECT_DETAILS_PARTNER_MAX).optional().nullable(),
  value: z.number().nonnegative(),
  projectValueCurrency: z.enum(['AUD', 'USD']).optional().nullable(),
  paymentLink: z.string().max(2000).optional().nullable(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ dealId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { dealId } = await context.params;
    const body = bodySchema.parse(await request.json());
    const deal = await updateProjectDetailsForUser({
      userId: user.id,
      dealId,
      patch: body,
    });
    return NextResponse.json({ deal });
  } catch (error) {
    const err = error as { statusCode?: number };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof ProjectDetailsError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    console.error('[deal details PATCH]', error);
    return NextResponse.json({ error: 'Failed to update project details' }, { status: 500 });
  }
}
