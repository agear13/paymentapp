import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/middleware';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { dispatchCommercialNotification } from '@/lib/commercial/dispatch-commercial-notification.server';

/**
 * POST /api/projects/[projectId]/commercial-events
 *
 * Records a commercial workflow event and dispatches the corresponding
 * operator notification.
 *
 * This is the canonical integration point between client-side workflow
 * transitions (Xero export, revenue confirmation, etc.) and the
 * notification system.
 *
 * Every event produces exactly one notification via
 * dispatchCommercialNotification() — idempotent by event key.
 */

const bodySchema = z.object({
  eventKind: z.enum([
    'agreement_negotiated',
    'agreement_approved',
    'obligation_created',
    'invoice_requested',
    'invoice_received',
    'invoice_approved',
    'invoice_exported',
    'revenue_expected',
    'revenue_confirmed',
    'funding_evidence_uploaded',
    'revenue_cleared',
    'settlement_ready',
    'payment_released',
    'settlement_completed',
    'supplier_onboarding_started',
    'supplier_details_submitted',
    'supplier_onboarding_approved',
    'supplier_invoice_generated',
    'supplier_invoice_exported',
  ]),
  participantId: z.string().optional(),
  participantName: z.string().optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { projectId } = await context.params;

    const body = bodySchema.parse(await request.json());

    const org = await getOrganizationForAuthenticatedUser(user.id);
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    await dispatchCommercialNotification({
      organizationId: org.id,
      eventKind: body.eventKind,
      projectId,
      participantId: body.participantId,
      participantName: body.participantName,
      amount: body.amount,
      currency: body.currency,
    });

    return NextResponse.json({ dispatched: true });
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid event kind' }, { status: 400 });
    }
    console.error('[commercial-events POST]', e);
    return NextResponse.json({ error: 'Failed to dispatch event' }, { status: 500 });
  }
}
