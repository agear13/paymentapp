import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/middleware';
import {
  getPilotSnapshotForUser,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
import { persistXeroExport } from '@/lib/commercial/payment-setup.server';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { dispatchCommercialNotification } from '@/lib/commercial/dispatch-commercial-notification.server';
import {
  appendOnboardingEvent,
} from '@/lib/commercial/supplier-onboarding-domain';
import type { StoredOnboardingState } from '@/lib/commercial/supplier-onboarding-domain';
import { createSupplierBillInXero } from '@/lib/xero/supplier-bill-service';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/server/prisma';
import type { Prisma } from '@prisma/client';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';

const bodySchema = z.object({
  /** Optional operator notes to attach to the Xero bill reference. */
  notes: z.string().max(500).optional(),
}).optional();

/**
 * POST /api/deal-network-pilot/participants/[participantId]/xero-export
 *
 * Operator exports an approved supplier's invoice to Xero.
 *
 * This is an accounting integration concern — separate from the commercial
 * approval decision. Approval must have happened before this can be called.
 *
 * Actions:
 *   1. Validates operator is authenticated and participant is approved.
 *   2. Calls createSupplierBillInXero() to create ACCPAY invoice in Xero.
 *   3. Persists xeroContactId, xeroInvoiceId, xeroExportedAt.
 *   4. Appends SUPPLIER_INVOICE_GENERATED commercial event.
 *   5. Updates draft invoice status to EXPORTED_TO_XERO.
 *   6. Dispatches supplier_invoice_exported notification.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ participantId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { participantId } = await context.params;
    const _body = bodySchema?.parse(await request.json().catch(() => ({})));

    const snapshot = await getPilotSnapshotForUser(user.id);
    const existing = snapshot.participants.find((p) => p.id === participantId);
    if (!existing) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    const existingStored = existing.supplierOnboarding as StoredOnboardingState | undefined;

    // Must be approved before export
    if (!existing.payoutVerificationConfirmed && !existingStored?.approval?.approvedAt) {
      return NextResponse.json(
        { error: 'Supplier onboarding must be approved before exporting to Xero.' },
        { status: 422 }
      );
    }

    // Prevent double-export of successful exports; always allow retry after failure
    if (existing.paymentSetup?.xeroExportedAt && existing.paymentSetup?.xeroSyncStatus === 'synced') {
      return NextResponse.json(
        {
          error: 'Already exported to Xero.',
          xeroInvoiceId: existing.paymentSetup.xeroInvoiceId,
          xeroExportedAt: existing.paymentSetup.xeroExportedAt,
        },
        { status: 409 }
      );
    }

    const org = await getOrganizationForAuthenticatedUser(user.id);
    if (!org) {
      return NextResponse.json({ error: 'Organization not found.' }, { status: 422 });
    }

    // Build the invoice for Xero
    const draftInvoice = existing.paymentSetup?.draftInvoice;
    if (!draftInvoice) {
      return NextResponse.json(
        { error: 'No draft invoice found for this participant. Invoice must be generated before export.' },
        { status: 422 }
      );
    }

    let xeroResult: { xeroContactId: string; xeroInvoiceId: string; xeroInvoiceNumber: string } | null = null;
    let xeroError: string | null = null;
    let syncStatus: 'synced' | 'failed' = 'synced';

    try {
      xeroResult = await createSupplierBillInXero({
        organizationId: org.id,
        participant: {
          id: existing.id,
          name: existing.name,
          email: existing.email ?? null,
        },
        invoice: draftInvoice,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Xero export failed';
      console.error('[xero-export] createSupplierBillInXero failed:', err);
      xeroError = msg;
      syncStatus = 'failed';
    }

    // Persist regardless of success/failure (so operator can see the status)
    const persisted = await persistXeroExport(participantId, user.id, {
      xeroContactId: xeroResult?.xeroContactId ?? 'error',
      xeroInvoiceId: xeroResult?.xeroInvoiceId ?? 'error',
      xeroInvoiceNumber: xeroResult?.xeroInvoiceNumber ?? 'error',
      xeroSyncStatus: syncStatus,
      failureReason: xeroError ?? undefined,
    });

    if (!persisted) {
      return NextResponse.json({ error: 'Failed to persist export result' }, { status: 500 });
    }

    if (xeroError) {
      return NextResponse.json(
        { error: `Xero export failed: ${xeroError}` },
        { status: 502 }
      );
    }

    // Append SUPPLIER_INVOICE_GENERATED event to the event log
    const now = new Date().toISOString();
    const exportEvent = {
      id: uuidv4(),
      type: 'SUPPLIER_INVOICE_GENERATED' as const,
      participantId,
      performedBy: user.id,
      timestamp: now,
      payload: {
        invoiceAmount: draftInvoice.total,
        currency: draftInvoice.currency,
        gstStatus: draftInvoice.gstStatus,
      },
    };

    const currentStored = persisted.supplierOnboarding as StoredOnboardingState | undefined;
    const withEvent: StoredOnboardingState = {
      ...currentStored,
      events: appendOnboardingEvent(currentStored?.events ?? [], exportEvent),
    };

    const withEventUpdate: DemoParticipant = {
      ...persisted,
      supplierOnboarding: withEvent,
    };

    await prisma.deal_network_pilot_participants.update({
      where: { id: participantId },
      data: { participant_payload: withEventUpdate as unknown as Prisma.InputJsonValue },
    });

    // Sync snapshot state (direct participant update — snapshot will refresh on next load)
    // No explicit snapshot sync needed — persistXeroExport updated participant_payload directly.

    // Notify operator
    void dispatchCommercialNotification({
      organizationId: org.id,
      eventKind: 'supplier_invoice_exported',
      projectId: existing.dealId ?? '',
      participantId: existing.id,
      participantName: existing.name,
    });

    return NextResponse.json({
      success: true,
      xeroContactId: xeroResult!.xeroContactId,
      xeroInvoiceId: xeroResult!.xeroInvoiceId,
      xeroInvoiceNumber: xeroResult!.xeroInvoiceNumber,
      exportedAt: now,
    });
  } catch (e: unknown) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: e.issues }, { status: 400 });
    }
    const err = e as { statusCode?: number };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[xero-export POST]', e);
    return NextResponse.json({ error: 'Export failed. Please try again.' }, { status: 500 });
  }
}
