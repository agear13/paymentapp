/**
 * Archive and void flows for accounting-linked commercial invoices.
 */
import 'server-only';

import { prisma } from '@/lib/server/prisma';
import { checkUserPermission } from '@/lib/auth/permissions';
import { transitionPaymentLinkState } from '@/lib/payments/state-machine';
import { queueXeroInvoiceVoid } from '@/lib/xero/queue-service';
import {
  isAccountingInvoiceExported,
  type AccountingInvoiceSyncRow,
} from '@/lib/accounting/accounting-push-state';
import {
  isInvoiceVoidedInAccounting,
  resolveInvoiceRemovalOptions,
} from '@/lib/accounting/accounting-invoice-deletion-policy';

export type InvoiceRemovalAuthResult =
  | { ok: true; userId: string; organizationId: string }
  | { ok: false; status: 401 | 403 | 404 | 400 | 409; error: string; code?: string };

async function loadLinkForRemoval(paymentLinkId: string) {
  return prisma.payment_links.findUnique({
    where: { id: paymentLinkId },
    select: {
      id: true,
      status: true,
      organization_id: true,
      short_code: true,
      wise_transfer_id: true,
      wise_received_amount: true,
      xero_syncs: {
        where: { sync_type: 'INVOICE' },
        select: {
          id: true,
          sync_type: true,
          status: true,
          xero_invoice_id: true,
          response_payload: true,
          updated_at: true,
          created_at: true,
        },
        take: 1,
      },
      payment_events: {
        select: {
          event_type: true,
          amount_received: true,
          stripe_payment_intent_id: true,
          hedera_transaction_id: true,
          wise_transfer_id: true,
          source_reference: true,
          source_type: true,
        },
        take: 5,
        orderBy: { created_at: 'desc' },
      },
    },
  });
}

export async function authorizeInvoiceRemoval(params: {
  userId: string;
  paymentLinkId: string;
}): Promise<
  | { ok: true; userId: string; link: NonNullable<Awaited<ReturnType<typeof loadLinkForRemoval>>> }
  | InvoiceRemovalAuthResult
> {
  const link = await loadLinkForRemoval(params.paymentLinkId);
  if (!link) {
    return { ok: false, status: 404, error: 'Payment link not found', code: 'INVOICE_NOT_FOUND' };
  }

  const [canDelete, canEdit] = await Promise.all([
    checkUserPermission(params.userId, link.organization_id, 'delete_payment_links'),
    checkUserPermission(params.userId, link.organization_id, 'edit_payment_links'),
  ]);
  if (!canDelete && !canEdit) {
    return {
      ok: false,
      status: 403,
      error: 'You do not have permission to remove invoices in this organization.',
      code: 'REMOVAL_PERMISSION_DENIED',
    };
  }

  return { ok: true, userId: params.userId, link };
}

function invoiceSyncRow(
  sync: NonNullable<Awaited<ReturnType<typeof loadLinkForRemoval>>>['xero_syncs'][number] | undefined
): AccountingInvoiceSyncRow | null {
  if (!sync) return null;
  return {
    syncType: sync.sync_type,
    status: sync.status,
    xeroInvoiceId: sync.xero_invoice_id,
    responsePayload: sync.response_payload,
    updatedAt: sync.updated_at,
    createdAt: sync.created_at,
  };
}

export async function archiveAccountingLinkedInvoice(params: {
  userId: string;
  paymentLinkId: string;
}): Promise<{ success: true; status: string; message: string }> {
  const auth = await authorizeInvoiceRemoval(params);
  if (!auth.ok) {
    throw Object.assign(new Error(auth.error), { status: auth.status, code: auth.code });
  }

  const sync = invoiceSyncRow(auth.link.xero_syncs[0]);
  const options = resolveInvoiceRemovalOptions({
    status: auth.link.status,
    invoiceSync: sync,
    hasPaymentEvidence: false,
  });

  if (!options.canArchive) {
    throw Object.assign(
      new Error(options.blockReason ?? 'This invoice cannot be archived.'),
      { status: 400, code: 'ARCHIVE_NOT_ALLOWED' }
    );
  }

  if (auth.link.status === 'CANCELED') {
    return {
      success: true,
      status: 'CANCELED',
      message: 'Invoice is already archived locally. Accounting records were left unchanged.',
    };
  }

  await prisma.$transaction(async (tx) => {
    await transitionPaymentLinkState({
      tx,
      paymentLinkId: auth.link.id,
      targetState: 'CANCELED',
      source: 'invoice-archive',
      reason: 'archive_accounting_linked_invoice',
      metadata: { actorUserId: params.userId, accountingUntouched: true },
    });

    await tx.audit_logs.create({
      data: {
        organization_id: auth.link.organization_id,
        user_id: params.userId,
        entity_type: 'PaymentLink',
        entity_id: auth.link.id,
        action: 'ARCHIVE',
        new_values: {
          status: 'CANCELED',
          accountingUntouched: isAccountingInvoiceExported(sync),
        },
      },
    });
  });

  return {
    success: true,
    status: 'CANCELED',
    message:
      'Invoice archived in Provvy. Your accounting software was not changed — void there separately if needed.',
  };
}

export async function voidAccountingLinkedInvoice(params: {
  userId: string;
  paymentLinkId: string;
}): Promise<{ success: true; queued: boolean; syncId?: string; message: string }> {
  const auth = await authorizeInvoiceRemoval(params);
  if (!auth.ok) {
    throw Object.assign(new Error(auth.error), { status: auth.status, code: auth.code });
  }

  const sync = invoiceSyncRow(auth.link.xero_syncs[0]);
  const options = resolveInvoiceRemovalOptions({
    status: auth.link.status,
    invoiceSync: sync,
  });

  if (!options.canVoid) {
    throw Object.assign(
      new Error(
        options.blockReason ??
          'This invoice cannot be voided. Use Archive to remove it locally without changing accounting.'
      ),
      { status: 400, code: 'VOID_NOT_ALLOWED' }
    );
  }

  if (isInvoiceVoidedInAccounting(sync?.responsePayload)) {
    return {
      success: true,
      queued: false,
      message: 'This invoice is already voided in accounting.',
    };
  }

  if (auth.link.status !== 'CANCELED') {
    await prisma.$transaction(async (tx) => {
      await transitionPaymentLinkState({
        tx,
        paymentLinkId: auth.link.id,
        targetState: 'CANCELED',
        source: 'invoice-void',
        reason: 'void_accounting_linked_invoice',
        metadata: { actorUserId: params.userId },
      });

      await tx.audit_logs.create({
        data: {
          organization_id: auth.link.organization_id,
          user_id: params.userId,
          entity_type: 'PaymentLink',
          entity_id: auth.link.id,
          action: 'VOID_REQUESTED',
          new_values: { status: 'CANCELED', voidAccounting: true },
        },
      });
    });
  }

  const syncId = await queueXeroInvoiceVoid({
    paymentLinkId: auth.link.id,
    organizationId: auth.link.organization_id,
  });

  return {
    success: true,
    queued: true,
    syncId,
    message: 'Invoice canceled in Provvy. Void queued for your accounting software.',
  };
}
