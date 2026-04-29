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
import { derivePaidAtFromEvents } from '@/lib/payments/paid-at';

// Helper to transform snake_case DB fields to camelCase for frontend
function transformPaymentLink(link: any) {
  const hasAttachment = Boolean(link.attachment_storage_key);
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
  const paidAt = derivePaidAtFromEvents(
    link.payment_events?.map((event: any) => ({
      event_type: event.event_type,
      created_at: event.created_at,
      received_at: event.received_at ?? null,
    })) || []
  );

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
    xeroInvoiceId: sync.xero_invoice_id ?? null,
    xeroPaymentId: sync.xero_payment_id ?? null,
    errorMessage: sync.error_message,
    createdAt: sync.created_at,
    updatedAt: sync.updated_at,
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
    invoiceDate: link.invoice_date ?? null,
    customerEmail: link.customer_email,
    customerName: link.customer_name ?? null,
    customerPhone: link.customer_phone,
    dueDate: link.due_date ?? null,
    expiresAt: link.expires_at,
    xeroInvoiceNumber: link.xero_invoice_number ?? null,
    invoiceOnlyMode: link.invoice_only_mode ?? false,
    hederaCheckoutMode: link.hedera_checkout_mode ?? null,
    cryptoNetwork: link.crypto_network ?? null,
    cryptoAddress: link.crypto_address ?? null,
    cryptoCurrency: link.crypto_currency ?? null,
    cryptoMemo: link.crypto_memo ?? null,
    cryptoInstructions: link.crypto_instructions ?? null,
    manualBankRecipientName: link.manual_bank_recipient_name ?? null,
    manualBankCurrency: link.manual_bank_currency ?? null,
    manualBankDestinationType: link.manual_bank_destination_type ?? null,
    manualBankBankName: link.manual_bank_bank_name ?? null,
    manualBankAccountNumber: link.manual_bank_account_number ?? null,
    manualBankIban: link.manual_bank_iban ?? null,
    manualBankSwiftBic: link.manual_bank_swift_bic ?? null,
    manualBankRoutingSortCode: link.manual_bank_routing_sort_code ?? null,
    manualBankWiseReference: link.manual_bank_wise_reference ?? null,
    manualBankRevolutHandle: link.manual_bank_revolut_handle ?? null,
    manualBankInstructions: link.manual_bank_instructions ?? null,
    createdAt: link.created_at,
    updatedAt: link.updated_at,
    paidAt,
    wiseStatus: link.wise_status ?? null,
    wiseQuoteId: link.wise_quote_id ?? null,
    wiseTransferId: link.wise_transfer_id ?? null,
    wiseReceivedAmount: link.wise_received_amount ? Number(link.wise_received_amount) : null,
    wiseReceivedCurrency: link.wise_received_currency ?? null,
    attachmentUrl: hasAttachment ? `/api/public/pay/${encodeURIComponent(link.short_code)}/attachment` : null,
    attachmentStorageKey: link.attachment_storage_key ?? null,
    attachmentBucket: link.attachment_bucket ?? null,
    attachmentFilename: link.attachment_filename ?? null,
    attachmentMimeType: link.attachment_mime_type ?? null,
    attachmentSizeBytes: link.attachment_size_bytes ?? null,
    lastSentAt: link.last_sent_at ?? null,
    lastSentToEmail: link.last_sent_to_email ?? null,
    pilotDealId: link.pilot_deal_id ?? null,
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
  isPaymentLinkCancelable,
} from '@/lib/payment-link-state-machine';
import { tryDeletePaymentLinkAttachmentFile } from '@/lib/payment-links/payment-link-attachment';
import { revalidatePath } from 'next/cache';
import { assertPilotDealOwnedByUser } from '@/lib/deal-network-demo/pilot-deal-invoice-link.server';

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
        {
          error:
            'You do not have permission to view this invoice, or it belongs to another organization.',
        },
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
        {
          error:
            'You do not have permission to edit invoices. Ask an organization owner or admin.',
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const patch = UpdatePaymentLinkSchema.parse(body);

    const patchKeys = Object.keys(patch) as string[];
    const onlyPilotDealLink =
      patch.pilotDealId !== undefined && patchKeys.length === 1;

    if (onlyPilotDealLink) {
      try {
        if (typeof patch.pilotDealId === 'string') {
          await assertPilotDealOwnedByUser(user.id, patch.pilotDealId);
        }
      } catch {
        return NextResponse.json(
          { error: 'Invalid pilot project for invoice link' },
          { status: 403 }
        );
      }

      const updatedLink = await prisma.$transaction(async (tx) => {
        const updated = await tx.payment_links.update({
          where: { id },
          data: {
            pilot_deal_id: patch.pilotDealId ?? null,
            updated_at: new Date(),
          } as any,
        });

        await tx.audit_logs.create({
          data: {
            organization_id: currentLink.organization_id,
            user_id: user.id,
            entity_type: 'PaymentLink',
            entity_id: id,
            action: 'UPDATE',
            new_values: { pilotDealId: patch.pilotDealId } as object,
          },
        });

        return updated;
      });

      revalidatePath(`/pay/${updatedLink.short_code}`);
      revalidatePath('/dashboard/payment-links');

      return NextResponse.json({
        data: transformPaymentLink(updatedLink),
        message: 'Invoice project link updated',
      });
    }

    if (!isPaymentLinkEditable(currentLink.status)) {
      return NextResponse.json(
        { error: 'Payment link cannot be edited in current status' },
        { status: 400 }
      );
    }

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

    if (mergedInvoiceRef && mergedInvoiceRef !== currentLink.invoice_reference) {
      const duplicateInvoiceReference = await prisma.payment_links.findFirst({
        where: {
          organization_id: currentLink.organization_id,
          invoice_reference: mergedInvoiceRef,
          NOT: { id },
        },
        select: { id: true },
      });
      if (duplicateInvoiceReference) {
        return NextResponse.json(
          { error: `Invoice reference "${mergedInvoiceRef}" already exists for this organization.` },
          { status: 409 }
        );
      }
    }
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
    const mergedInvoiceDate =
      patch.invoiceDate !== undefined
        ? patch.invoiceDate
          ? new Date(patch.invoiceDate as string | Date)
          : null
        : currentLink.invoice_date;
    const mergedExpiresAt =
      patch.expiresAt !== undefined
        ? patch.expiresAt
          ? new Date(patch.expiresAt as string | Date)
          : null
        : currentLink.expires_at;

    const trimOrNull = (v: string | null | undefined): string | null => {
      if (v == null) return null;
      const t = v.trim();
      return t.length ? t : null;
    };

    let mergedCryptoNetwork = currentLink.crypto_network;
    let mergedCryptoAddress = currentLink.crypto_address;
    let mergedCryptoCurrency = currentLink.crypto_currency;
    let mergedCryptoMemo = currentLink.crypto_memo;
    let mergedCryptoInstructions = currentLink.crypto_instructions;
    let mergedManualBankRecipientName = currentLink.manual_bank_recipient_name;
    let mergedManualBankCurrency = currentLink.manual_bank_currency;
    let mergedManualBankDestinationType = currentLink.manual_bank_destination_type;
    let mergedManualBankBankName = currentLink.manual_bank_bank_name;
    let mergedManualBankAccountNumber = currentLink.manual_bank_account_number;
    let mergedManualBankIban = currentLink.manual_bank_iban;
    let mergedManualBankSwiftBic = currentLink.manual_bank_swift_bic;
    let mergedManualBankRoutingSortCode = currentLink.manual_bank_routing_sort_code;
    let mergedManualBankWiseReference = currentLink.manual_bank_wise_reference;
    let mergedManualBankRevolutHandle = currentLink.manual_bank_revolut_handle;
    let mergedManualBankInstructions = currentLink.manual_bank_instructions;

    if (invoiceOnly || paymentMethod !== 'CRYPTO') {
      mergedCryptoNetwork = null;
      mergedCryptoAddress = null;
      mergedCryptoCurrency = null;
      mergedCryptoMemo = null;
      mergedCryptoInstructions = null;
    } else {
      mergedCryptoNetwork =
        patch.cryptoNetwork !== undefined
          ? trimOrNull(patch.cryptoNetwork as string | null)
          : mergedCryptoNetwork;
      mergedCryptoAddress =
        patch.cryptoAddress !== undefined
          ? trimOrNull(patch.cryptoAddress as string | null)
          : mergedCryptoAddress;
      mergedCryptoCurrency =
        patch.cryptoCurrency !== undefined
          ? trimOrNull(patch.cryptoCurrency as string | null)
          : mergedCryptoCurrency;
      mergedCryptoMemo =
        patch.cryptoMemo !== undefined
          ? patch.cryptoMemo === null
            ? null
            : trimOrNull(patch.cryptoMemo as string)
          : mergedCryptoMemo;
      mergedCryptoInstructions =
        patch.cryptoInstructions !== undefined
          ? patch.cryptoInstructions === null
            ? null
            : trimOrNull(patch.cryptoInstructions as string)
          : mergedCryptoInstructions;
    }

    if (!invoiceOnly && paymentMethod === 'CRYPTO') {
      if (!mergedCryptoNetwork || !mergedCryptoAddress || !mergedCryptoCurrency) {
        return NextResponse.json(
          {
            error: 'Network, wallet address, and currency are required for crypto payments',
          },
          { status: 400 }
        );
      }
    }

    if (invoiceOnly || paymentMethod !== 'MANUAL_BANK') {
      mergedManualBankRecipientName = null;
      mergedManualBankCurrency = null;
      mergedManualBankDestinationType = null;
      mergedManualBankBankName = null;
      mergedManualBankAccountNumber = null;
      mergedManualBankIban = null;
      mergedManualBankSwiftBic = null;
      mergedManualBankRoutingSortCode = null;
      mergedManualBankWiseReference = null;
      mergedManualBankRevolutHandle = null;
      mergedManualBankInstructions = null;
    } else {
      mergedManualBankRecipientName =
        patch.manualBankRecipientName !== undefined
          ? trimOrNull(patch.manualBankRecipientName as string | null)
          : mergedManualBankRecipientName;
      mergedManualBankCurrency =
        patch.manualBankCurrency !== undefined
          ? trimOrNull(patch.manualBankCurrency as string | null)
          : mergedManualBankCurrency;
      mergedManualBankDestinationType =
        patch.manualBankDestinationType !== undefined
          ? trimOrNull(patch.manualBankDestinationType as string | null)
          : mergedManualBankDestinationType;
      mergedManualBankBankName =
        patch.manualBankBankName !== undefined
          ? trimOrNull(patch.manualBankBankName as string | null)
          : mergedManualBankBankName;
      mergedManualBankAccountNumber =
        patch.manualBankAccountNumber !== undefined
          ? trimOrNull(patch.manualBankAccountNumber as string | null)
          : mergedManualBankAccountNumber;
      mergedManualBankIban =
        patch.manualBankIban !== undefined
          ? trimOrNull(patch.manualBankIban as string | null)
          : mergedManualBankIban;
      mergedManualBankSwiftBic =
        patch.manualBankSwiftBic !== undefined
          ? trimOrNull(patch.manualBankSwiftBic as string | null)
          : mergedManualBankSwiftBic;
      mergedManualBankRoutingSortCode =
        patch.manualBankRoutingSortCode !== undefined
          ? trimOrNull(patch.manualBankRoutingSortCode as string | null)
          : mergedManualBankRoutingSortCode;
      mergedManualBankWiseReference =
        patch.manualBankWiseReference !== undefined
          ? trimOrNull(patch.manualBankWiseReference as string | null)
          : mergedManualBankWiseReference;
      mergedManualBankRevolutHandle =
        patch.manualBankRevolutHandle !== undefined
          ? trimOrNull(patch.manualBankRevolutHandle as string | null)
          : mergedManualBankRevolutHandle;
      mergedManualBankInstructions =
        patch.manualBankInstructions !== undefined
          ? trimOrNull(patch.manualBankInstructions as string | null)
          : mergedManualBankInstructions;
    }

    if (!invoiceOnly && paymentMethod === 'MANUAL_BANK') {
      if (!mergedManualBankRecipientName || !mergedManualBankCurrency || !mergedManualBankDestinationType) {
        return NextResponse.json(
          {
            error:
              'Recipient name, destination type, and payment currency are required for manual bank transfer',
          },
          { status: 400 }
        );
      }
    }

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

    const prismaData: Record<string, unknown> = {
      amount: new Prisma.Decimal(mergedAmount.toFixed(2)),
      currency: mergedCurrency,
      description: mergedDescription,
      invoice_reference: mergedInvoiceRef,
      customer_email: mergedCustomerEmail,
      customer_name: mergedCustomerName,
      customer_phone: mergedCustomerPhone,
      invoice_date: mergedInvoiceDate,
      due_date: mergedDueDate,
      expires_at: mergedExpiresAt,
      invoice_only_mode: invoiceOnly,
      payment_method: paymentMethod,
      hedera_checkout_mode: hederaCheckoutMode,
      crypto_network: mergedCryptoNetwork,
      crypto_address: mergedCryptoAddress,
      crypto_currency: mergedCryptoCurrency,
      crypto_memo: mergedCryptoMemo,
      crypto_instructions: mergedCryptoInstructions,
      manual_bank_recipient_name: mergedManualBankRecipientName,
      manual_bank_currency: mergedManualBankCurrency,
      manual_bank_destination_type: mergedManualBankDestinationType,
      manual_bank_bank_name: mergedManualBankBankName,
      manual_bank_account_number: mergedManualBankAccountNumber,
      manual_bank_iban: mergedManualBankIban,
      manual_bank_swift_bic: mergedManualBankSwiftBic,
      manual_bank_routing_sort_code: mergedManualBankRoutingSortCode,
      manual_bank_wise_reference: mergedManualBankWiseReference,
      manual_bank_revolut_handle: mergedManualBankRevolutHandle,
      manual_bank_instructions: mergedManualBankInstructions,
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

    const previousAttachmentStorageKey = currentLink.attachment_storage_key;
    const previousAttachmentBucket = currentLink.attachment_bucket;
    if (patch.attachment !== undefined) {
      if (patch.attachment === null) {
        prismaData.attachment_storage_key = null;
        prismaData.attachment_bucket = null;
        prismaData.attachment_filename = null;
        prismaData.attachment_mime_type = null;
        prismaData.attachment_size_bytes = null;
      } else {
        prismaData.attachment_storage_key = patch.attachment.storageKey;
        prismaData.attachment_bucket = patch.attachment.bucket;
        prismaData.attachment_filename = patch.attachment.filename;
        prismaData.attachment_mime_type = patch.attachment.mimeType;
        prismaData.attachment_size_bytes = patch.attachment.sizeBytes;
      }
    }

    if (patch.pilotDealId !== undefined) {
      try {
        if (typeof patch.pilotDealId === 'string') {
          await assertPilotDealOwnedByUser(user.id, patch.pilotDealId);
        }
      } catch {
        return NextResponse.json(
          { error: 'Invalid pilot project for invoice link' },
          { status: 403 }
        );
      }
      prismaData.pilot_deal_id = patch.pilotDealId;
    }

    assertPaymentLinksUpdateDataValid(prismaData);

    const updatedLink = await prisma.$transaction(async (tx) => {
      const updated = await tx.payment_links.update({
        where: { id },
        data: prismaData as any,
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

    if (patch.attachment !== undefined) {
      const nextStorageKey = patch.attachment === null ? null : patch.attachment.storageKey;
      if (previousAttachmentStorageKey && previousAttachmentStorageKey !== nextStorageKey) {
        await tryDeletePaymentLinkAttachmentFile(previousAttachmentStorageKey, previousAttachmentBucket);
      }
    }

    loggers.api.info(
      { paymentLinkId: id, patch },
      'Payment link updated'
    );

    revalidatePath(`/pay/${updatedLink.short_code}`);
    revalidatePath('/dashboard/payment-links');

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
        short_code: true,
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
        {
          error:
            'You do not have permission to cancel invoices. Ask an organization owner or admin.',
        },
        { status: 403 }
      );
    }

    if (!isPaymentLinkCancelable(currentLink.status)) {
      return NextResponse.json(
        {
          error:
            currentLink.status === 'PAID'
              ? 'Paid invoices cannot be canceled. Reopen only if this was marked paid by mistake and no external settlement exists.'
              : `Only draft or open invoices can be canceled (current status: ${currentLink.status}).`,
        },
        { status: 400 }
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

    revalidatePath(`/pay/${currentLink.short_code}`);
    revalidatePath('/dashboard/payment-links');

    return NextResponse.json({
      data: transformPaymentLink(canceledLink),
      message: 'Payment link canceled successfully',
    });
  } catch (error: any) {
    const message = error?.message || 'Internal server error';
    const isTransitionError = typeof message === 'string' && message.includes('Invalid state transition');
    loggers.api.error(
      { error: message, paymentLinkId: params.id },
      'Failed to cancel payment link'
    );
    return NextResponse.json(
      {
        error: isTransitionError
          ? 'Cancel is only available for draft/open invoices that have not reached a terminal settlement state.'
          : message,
      },
      { status: isTransitionError ? 400 : 500 }
    );
  }
}




