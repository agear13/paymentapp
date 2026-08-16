import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { z } from 'zod';
import { requireTreasuryOrganizationAccess } from '@/lib/treasury/api/require-treasury-access';
import {
  createManualTreasuryLink,
  ManualReconciliationError,
} from '@/lib/treasury/reconciliation/manual-link';

const bodySchema = z.object({
  sourceEventId: z.string().uuid(),
  targetEventId: z.string().uuid(),
  confirmLink: z.literal(true),
  notes: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await getCurrentUserForApi(req);
  if (!auth.user) return auth.response!;

  const access = await requireTreasuryOrganizationAccess(req);
  if (!access.ok) {
    return access.response;
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const result = await createManualTreasuryLink({
      organizationId: access.organizationId,
      sourceEventId: body.sourceEventId,
      targetEventId: body.targetEventId,
      linkedByUserId: access.userId,
      notes: body.notes,
      confirmLink: body.confirmLink,
    });

    return NextResponse.json({
      success: true,
      linkId: result.linkId,
      auditId: result.auditId,
      manualReconciliation: result.manualReconciliation,
    });
  } catch (error) {
    if (error instanceof ManualReconciliationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
