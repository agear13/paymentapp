/**
 * Payment Link API - Individual Operations
 * GET /api/payment-links/[id] - Get payment link by ID
 * PATCH /api/payment-links/[id] - Update payment link
 * DELETE /api/payment-links/[id] - Cancel payment link
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';
import { requireAuth } from '@/lib/auth/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { getMerchantWiseConfig } from '@/lib/payments/wise';
import { assertPaymentLinksUpdateDataValid } from '@/lib/payments/payment-links-update-guard';

// Helper to transform snake_case DB fields to camelCase for frontend
function transformPaymentLink(link: any) {
  // Transform FX snapshots to camelCase
  const fxSnapshots = link.fx_snapshots?.map((snapshot: any) => ({
    id: snapshot.id,
    snapshotType: snapshot.snapshot_type,
    tokenType: snapshot.token_type,
    baseCurrency: snapshot.base_currency,
    quoteCurrency: snapshot.quote_currency,
    rate: Number(snapshot.rate),
    provider: snapshot.provider,
    capturedAt: snapshot.captured_at,
  })) || [];

  // Transform payment events to camelCase
  const paymentEvents = link.payment_events?.map((event: any) => ({
    id: event.id,
    eventType: event.event_type,
    paymentMethod: event.payment_method,
    amountReceived: event.amount_received ? Number(event.amount_received) : null,
    currencyReceived: event.currency_received,
    createdAt: event.created_at,
    metadata: event.metadata,
  })) || [];

  // Transform ledger entries to camelCase
  const ledgerEntries = link.ledger_entries?.map((entry: any) => ({
    id: entry.id,
    entryType: entry.entry_type,
    amount: Number(entry.amount),
    currency: entry.currency,
    description: entry.description,
    createdAt: entry.created_at,
    ledgerAccount: entry.ledger_accounts ? {
      code: entry.ledger_accounts.code,
      name: entry.ledger_accounts.name,
    } : null,
  })) || [];

  // Transform xero syncs to camelCase
  const xeroSyncs = link.xero_syncs?.map((sync: any) => ({
    id: sync.id,
    syncType: sync.sync_type,
    status: sync.status,
    errorMessage: sync.error_message,
    createdAt: sync.created_at,
  })) || [];

  return {
    id: link.id,
    shortCode: link.short_code,
    status: link.status,
    paymentMethod: link.payment_method ?? null,
    amount: Number(link.amount),
    currency: link.currency,
    description: link.description,
    invoiceReference: link.invoice_reference,
    customerEmail: link.customer_email,
    customerName: link.customer_name ?? null,
    customerPhone: link.customer_phone,
    dueDate: link.due_date ?? null,
    expiresAt: link.expires_at,
    xeroInvoiceNumber: link.xero_invoice_number ?? null,
    invoiceOnlyMode: link.invoice_only_mode ?? false,
    hederaCheckoutMode: link.hedera_checkout_mode ?? null,
    createdAt: link.created_at,
    updatedAt: link.updated_at,
    wiseStatus: link.wise_status ?? null,
    wiseQuoteId: link.wise_quote_id ?? null,
    wiseTransferId: link.wise_transfer_id ?? null,
    wiseReceivedAmount: link.wise_received_amount ? Number(link.wise_received_amount) : null,
    wiseReceivedCurrency: link.wise_received_currency ?? null,
    paymentEvents,
    fxSnapshots,
    ledgerEntries,
    xeroSyncs,
  };
}
import { applyRateLimit } from '@/lib/rate-limit';
import { UpdatePaymentLinkSchema } from '@/lib/validations/schemas';
import { 
  transitionPaymentLinkStatus,
  isPaymentLinkEditable,
} from '@/lib/payment-link-state-machine';

/**
 * GET /api/payment-links/[id]
 * Get payment link details with related data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Rate limiting
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Authentication
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;

    // Get payment link with relations
    const paymentLink = await prisma.payment_links.findUnique({
      where: { id },
      include: {
        payment_events: {
          orderBy: { created_at: 'desc' },
        },
        fx_snapshots: {
          orderBy: { captured_at: 'desc' },
        },
        ledger_entries: {
          include: {
            ledger_accounts: true,
          },
        },
        xero_syncs: {
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!paymentLink) {
      return NextResponse.json(
        { error: 'Payment link not found' },
        { status: 404 }
      );
    }

    // Check permission
    const canView = await checkUserPermission(
      user.id,
      paymentLink.organization_id,
      'view_payment_links'
    );
    if (!canView) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    loggers.api.debug({ paymentLinkId: id }, 'Retrieved payment link');

    return NextResponse.json({ data: transformPaymentLink(paymentLink) });
  } catch (error: any) {
    loggers.api.error(
      { error: error.message, paymentLinkId: params.id },
      'Failed to get payment link'
    );
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/payment-links/[id]
 * Update payment link fields for DRAFT or OPEN (unpaid) invoices. Short code is never changed.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Rate limiting
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Authentication
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;

    const currentLink = await prisma.payment_links.findUnique({
      where: { id },
    });

    if (!currentLink) {
      return NextResponse.json(
        { error: 'Payment link not found' },
        { status: 404 }
      );
    }

    const canEdit = await checkUserPermission(
      user.id,
      currentLink.organization_id,
      'edit_payment_links'
    );
    if (!canEdit) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    if (!isPaymentLinkEditable(currentLink.status)) {
      return NextResponse.json(
        { error: 'Payment link cannot be edited in current status' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const patch = UpdatePaymentLinkSchema.parse(body);

    const invoiceOnly =
      patch.invoiceOnlyMode !== undefined
        ? patch.invoiceOnlyMode
        : currentLink.invoice_only_mode;

    let paymentMethod = currentLink.payment_method;
    if (invoiceOnly) {
      paymentMethod = null;
    } else if (patch.paymentMethod !== undefined) {
      paymentMethod = patch.paymentMethod;
    }

    if (!invoiceOnly && !paymentMethod) {
      return NextResponse.json(
        { error: 'Payment method is required when not in invoice-only mode' },
        { status: 400 }
      );
    }

    let hederaCheckoutMode: string | null = currentLink.hedera_checkout_mode;
    if (invoiceOnly || paymentMethod !== 'HEDERA') {
      hederaCheckoutMode = null;
    } else if (patch.hederaCheckoutMode !== undefined) {
      hederaCheckoutMode = patch.hederaCheckoutMode;
    } else if (!hederaCheckoutMode) {
      hederaCheckoutMode = 'INTERACTIVE';
    }

    if (
      !invoiceOnly &&
      paymentMethod === 'HEDERA' &&
      (hederaCheckoutMode !== 'INTERACTIVE' && hederaCheckoutMode !== 'MANUAL')
    ) {
      return NextResponse.json(
        { error: 'Crypto checkout style is required for Hedera payment links' },
        { status: 400 }
      );
    }

    const mergedAmount =
      patch.amount !== undefined ? patch.amount : Number(currentLink.amount);
    const mergedCurrency = patch.currency ?? currentLink.currency;
    const mergedDescription =
      patch.description !== undefined ? patch.description : currentLink.description;
    const mergedInvoiceRef =
      patch.invoiceReference !== undefined
        ? patch.invoiceReference
        : currentLink.invoice_reference;
    const mergedCustomerEmail =
      patch.customerEmail !== undefined
        ? patch.customerEmail
        : currentLink.customer_email;
    const mergedCustomerName =
      patch.customerName !== undefined ? patch.customerName : currentLink.customer_name;
    const mergedCustomerPhone =
      patch.customerPhone !== undefined
        ? patch.customerPhone
        : currentLink.customer_phone;
    const mergedDueDate =
      patch.dueDate !== undefined
        ? patch.dueDate
          ? new Date(patch.dueDate as string | Date)
          : null
        : currentLink.due_date;
    const mergedExpiresAt =
      patch.expiresAt !== undefined
        ? patch.expiresAt
          ? new Date(patch.expiresAt as string | Date)
          : null
        : currentLink.expires_at;

    if (currentLink.wise_transfer_id) {
      const pmSame =
        (paymentMethod ?? null) === (currentLink.payment_method ?? null);
      const invoiceOnlySame = invoiceOnly === currentLink.invoice_only_mode;
      if (
        mergedAmount !== Number(currentLink.amount) ||
        mergedCurrency !== currentLink.currency ||
        !pmSame ||
        !invoiceOnlySame
      ) {
        return NextResponse.json(
          {
            error:
              'Cannot change amount, currency, invoice type, or payment method while a Wise bank transfer is in progress for this invoice.',
          },
          { status: 400 }
        );
      }
    }

    if (!invoiceOnly && paymentMethod === 'WISE') {
      try {
        await getMerchantWiseConfig(currentLink.organization_id, mergedCurrency);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Wise configuration invalid';
        return NextResponse.json({ error: message, code: 'WISE_CONFIG_ERROR' }, { status: 400 });
      }
    }

    const prismaData: Prisma.payment_linksUpdateInput = {
      amount: new Prisma.Decimal(mergedAmount.toFixed(2)),
      currency: mergedCurrency,
      description: mergedDescription,
      invoice_reference: mergedInvoiceRef,
      customer_email: mergedCustomerEmail,
      customer_name: mergedCustomerName,
      customer_phone: mergedCustomerPhone,
      due_date: mergedDueDate,
      expires_at: mergedExpiresAt,
      invoice_only_mode: invoiceOnly,
      payment_method: paymentMethod,
      hedera_checkout_mode: hederaCheckoutMode,
      updated_at: new Date(),
    };

    if (currentLink.payment_method === 'WISE' && paymentMethod !== 'WISE') {
      prismaData.wise_quote_id = null;
      prismaData.wise_transfer_id = null;
      prismaData.wise_status = null;
      prismaData.wise_received_amount = null;
      prismaData.wise_received_currency = null;
    }

    if (!invoiceOnly && paymentMethod === 'WISE' && currentLink.payment_method !== 'WISE') {
      prismaData.wise_status = 'INSTRUCTIONS_READY';
    }

    assertPaymentLinksUpdateDataValid(prismaData as Record<string, unknown>);

    const updatedLink = await prisma.$transaction(async (tx) => {
      const updated = await tx.payment_links.update({
        where: { id },
        data: prismaData,
      });

      await tx.audit_logs.create({
        data: {
          organization_id: currentLink.organization_id,
          user_id: user.id,
          entity_type: 'PaymentLink',
          entity_id: id,
          action: 'UPDATE',
          new_values: patch as object,
        },
      });

      return updated;
    });

    loggers.api.info(
      { paymentLinkId: id, patch },
      'Payment link updated'
    );

    return NextResponse.json({
      data: transformPaymentLink(updatedLink),
      message: 'Payment link updated successfully',
    });
  } catch (error: any) {
    loggers.api.error(
      { error: error.message, paymentLinkId: params.id },
      'Failed to update payment link'
    );

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/payment-links/[id]
 * Cancel payment link (soft delete via status change)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Rate limiting
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Authentication
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;

    // Get current payment link
    const currentLink = await prisma.payment_links.findUnique({
      where: { id },
      select: {
        id: true,
        organization_id: true,
        status: true,
      },
    });

    if (!currentLink) {
      return NextResponse.json(
        { error: 'Payment link not found' },
        { status: 404 }
      );
    }

    // Check permission
    const canCancel = await checkUserPermission(
      user.id,
      currentLink.organization_id,
      'cancel_payment_links'
    );
    if (!canCancel) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    // Transition to CANCELED status
    const canceledLink = await transitionPaymentLinkStatus(
      id,
      'CANCELED',
      user.id
    );

    loggers.api.info(
      { paymentLinkId: id, userId: user.id },
      'Payment link canceled'
    );

    return NextResponse.json({
      data: transformPaymentLink(canceledLink),
      message: 'Payment link canceled successfully',
    });
  } catch (error: any) {
    loggers.api.error(
      { error: error.message, paymentLinkId: params.id },
      'Failed to cancel payment link'
    );
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}




