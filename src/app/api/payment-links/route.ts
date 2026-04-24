/**
 * Payment Links API - Create and List
 * POST /api/payment-links - Create new payment link
 * GET /api/payment-links - List payment links with filters
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { applyRateLimit } from '@/lib/rate-limit';
import {
  CreatePaymentLinkSchema,
  PaginationSchema,
  PaymentLinkFiltersSchema,
} from '@/lib/validations/schemas';
import { generateUniqueShortCode } from '@/lib/server/short-code';
import { generateQRCodeDataUrl } from '@/lib/qr-code';
import { getFxService, type Currency } from '@/lib/fx';
import { buildWisePaymentContext, getMerchantWiseConfig } from '@/lib/payments/wise';
import { assertPilotDealOwnedByUser } from '@/lib/deal-network-demo/pilot-deal-invoice-link.server';

/** FX summary for list view (lightweight) */
export interface FxSummary {
  hasFxCreationSnapshots: boolean;
  hasSettlementSnapshot: boolean;
  settlementRate: number | null;
  settlementToken: string | null;
}

// Helper to transform snake_case DB fields to camelCase for frontend
function transformPaymentLink(link: Record<string, unknown>) {
  const shortCode = String(link.short_code ?? '');
  const hasAttachment = Boolean((link as { attachment_storage_key?: string | null }).attachment_storage_key);
  const fxSnapshots = link.fx_snapshots as Array<{
    snapshot_type: string;
    token_type: string | null;
    rate: number | string;
  }> | undefined;

  const fxSummary: FxSummary = {
    hasFxCreationSnapshots: false,
    hasSettlementSnapshot: false,
    settlementRate: null,
    settlementToken: null,
  };

  if (fxSnapshots && fxSnapshots.length > 0) {
    fxSummary.hasFxCreationSnapshots = fxSnapshots.some(
      (s) => s.snapshot_type === 'CREATION'
    );
    const settlement = fxSnapshots.find((s) => s.snapshot_type === 'SETTLEMENT');
    if (settlement) {
      fxSummary.hasSettlementSnapshot = true;
      fxSummary.settlementRate = Number(settlement.rate);
      fxSummary.settlementToken = settlement.token_type;
    }
  }

  return {
    id: link.id,
    organizationId: link.organization_id,
    shortCode,
    status: link.status,
    paymentMethod: link.payment_method ?? null,
    amount: Number(link.amount),
    currency: link.currency,
    description: link.description,
    invoiceReference: link.invoice_reference,
    invoiceDate: link.invoice_date ?? null,
    customerEmail: link.customer_email,
    customerName: link.customer_name,
    customerPhone: link.customer_phone,
    dueDate: link.due_date,
    expiresAt: link.expires_at,
    xeroInvoiceNumber: link.xero_invoice_number,
    invoiceOnlyMode: (link as { invoice_only_mode?: boolean }).invoice_only_mode ?? false,
    hederaCheckoutMode: (link as { hedera_checkout_mode?: string | null }).hedera_checkout_mode ?? null,
    cryptoNetwork: (link as { crypto_network?: string | null }).crypto_network ?? null,
    cryptoAddress: (link as { crypto_address?: string | null }).crypto_address ?? null,
    cryptoCurrency: (link as { crypto_currency?: string | null }).crypto_currency ?? null,
    cryptoMemo: (link as { crypto_memo?: string | null }).crypto_memo ?? null,
    cryptoInstructions: (link as { crypto_instructions?: string | null }).crypto_instructions ?? null,
    manualBankRecipientName:
      (link as { manual_bank_recipient_name?: string | null }).manual_bank_recipient_name ?? null,
    manualBankCurrency:
      (link as { manual_bank_currency?: string | null }).manual_bank_currency ?? null,
    manualBankDestinationType:
      (link as { manual_bank_destination_type?: string | null }).manual_bank_destination_type ?? null,
    manualBankBankName: (link as { manual_bank_bank_name?: string | null }).manual_bank_bank_name ?? null,
    manualBankAccountNumber:
      (link as { manual_bank_account_number?: string | null }).manual_bank_account_number ?? null,
    manualBankIban: (link as { manual_bank_iban?: string | null }).manual_bank_iban ?? null,
    manualBankSwiftBic:
      (link as { manual_bank_swift_bic?: string | null }).manual_bank_swift_bic ?? null,
    manualBankRoutingSortCode:
      (link as { manual_bank_routing_sort_code?: string | null }).manual_bank_routing_sort_code ?? null,
    manualBankWiseReference:
      (link as { manual_bank_wise_reference?: string | null }).manual_bank_wise_reference ?? null,
    manualBankRevolutHandle:
      (link as { manual_bank_revolut_handle?: string | null }).manual_bank_revolut_handle ?? null,
    manualBankInstructions:
      (link as { manual_bank_instructions?: string | null }).manual_bank_instructions ?? null,
    wiseStatus: link.wise_status ?? null,
    wiseTransferId: link.wise_transfer_id ?? null,
    attachmentUrl: hasAttachment ? `/api/public/pay/${encodeURIComponent(shortCode)}/attachment` : null,
    attachmentStorageKey: (link as { attachment_storage_key?: string | null }).attachment_storage_key ?? null,
    attachmentBucket: (link as { attachment_bucket?: string | null }).attachment_bucket ?? null,
    attachmentFilename: (link as { attachment_filename?: string | null }).attachment_filename ?? null,
    attachmentMimeType: (link as { attachment_mime_type?: string | null }).attachment_mime_type ?? null,
    attachmentSizeBytes: (link as { attachment_size_bytes?: number | null }).attachment_size_bytes ?? null,
    lastSentAt: (link as { last_sent_at?: Date | string | null }).last_sent_at ?? null,
    lastSentToEmail: (link as { last_sent_to_email?: string | null }).last_sent_to_email ?? null,
    createdAt: link.created_at,
    updatedAt: link.updated_at,
    paymentEvents: link.payment_events,
    fxSummary,
    pilotDealId: (link as { pilot_deal_id?: string | null }).pilot_deal_id ?? null,
  };
}

/**
 * GET /api/payment-links
 * List payment links with pagination and filters
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // Authentication (Supabase)
    const auth = await requireAuth(request);
    if (!auth.user) return auth.response!;
    const { user } = auth;

    // Get query params
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    // Verify the organization exists and user has access
    const org = await prisma.organizations.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check permission
    const canView = await checkUserPermission(user.id, organizationId, 'view_payment_links');
    if (!canView) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    const dbOrgId = organizationId;

    // Parse pagination
    const pagination = PaginationSchema.parse({
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
    });

    // Parse filters
    const filters = PaymentLinkFiltersSchema.parse({
      status: searchParams.get('status') || undefined,
      currency: searchParams.get('currency') || undefined,
      paymentMethod: searchParams.get('paymentMethod') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      search: searchParams.get('search') || undefined,
    });

    // Build where clause (using snake_case for database fields)
    const where: any = {
      organization_id: dbOrgId,
    };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.currency) {
      where.currency = filters.currency;
    }

    if (filters.startDate || filters.endDate) {
      where.created_at = {};
      if (filters.startDate) {
        where.created_at.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.created_at.lte = filters.endDate;
      }
    }

    if (filters.search) {
      where.OR = [
        { description: { contains: filters.search, mode: 'insensitive' } },
        { invoice_reference: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Get total count
    const total = await prisma.payment_links.count({ where });

    // Get paginated results (include fx_snapshots for fxSummary)
    const paymentLinks = await prisma.payment_links.findMany({
      where,
      include: {
        payment_events: {
          orderBy: { created_at: 'desc' },
          take: 1,
        },
        fx_snapshots: {
          select: {
            snapshot_type: true,
            token_type: true,
            rate: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });

    loggers.api.info(
      {
        organizationId: dbOrgId,
        count: paymentLinks.length,
        total,
        filters,
      },
      'Listed payment links'
    );

    // Transform results to camelCase
    const transformedLinks = paymentLinks.map(transformPaymentLink);

    return NextResponse.json({
      data: transformedLinks,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    });
  } catch (error: any) {
    loggers.api.error({ error: error.message }, 'Failed to list payment links');
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/payment-links
 * Create new payment link
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // Authentication (Supabase)
    const auth = await requireAuth(request);
    if (!auth.user) return auth.response!;
    const { user } = auth;

    // Parse and validate body
    const body = await request.json();
    const validatedData = CreatePaymentLinkSchema.parse(body);

    const organizationId = validatedData.organizationId;

    // Verify the organization exists
    const org = await prisma.organizations.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check permission
    const canCreate = await checkUserPermission(
      user.id,
      organizationId,
      'create_payment_links'
    );
    if (!canCreate) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    let pilotDealIdToStore: string | null = null;
    if (validatedData.pilotDealId) {
      try {
        await assertPilotDealOwnedByUser(user.id, validatedData.pilotDealId);
        pilotDealIdToStore = validatedData.pilotDealId;
      } catch {
        return NextResponse.json(
          { error: 'Invalid pilot project for invoice link' },
          { status: 403 }
        );
      }
    }

    const dbOrgId = organizationId;

    // Generate unique short code
    const shortCode = await generateUniqueShortCode();
    const invoiceOnly = validatedData.invoiceOnlyMode === true;
    const resolvedPaymentMethod = invoiceOnly ? null : validatedData.paymentMethod ?? null;
    const isWisePayment = !invoiceOnly && validatedData.paymentMethod === 'WISE';
    let wiseContext: Awaited<ReturnType<typeof buildWisePaymentContext>> | null = null;

    if (isWisePayment) {
      try {
        // Validate merchant-level Wise config before creating invoice
        await getMerchantWiseConfig(dbOrgId, validatedData.currency);
        wiseContext = await buildWisePaymentContext({
          shortCode,
          amount: validatedData.amount.toString(),
          organizationId: dbOrgId,
          fallbackCurrency: validatedData.currency,
        });
      } catch (wiseError: unknown) {
        const message = wiseError instanceof Error ? wiseError.message : 'Failed to prepare Wise payment context';
        return NextResponse.json({ error: message, code: 'WISE_CONFIG_ERROR' }, { status: 400 });
      }
    }

    // Create payment link with initial event
    const now = new Date();
    const paymentLink = await prisma.$transaction(async (tx) => {
      const linkId = randomUUID();

      const hederaCheckoutMode =
        !invoiceOnly && resolvedPaymentMethod === 'HEDERA'
          ? validatedData.hederaCheckoutMode ?? 'INTERACTIVE'
          : null;

      const isCrypto = !invoiceOnly && resolvedPaymentMethod === 'CRYPTO';
      const isManualBank = !invoiceOnly && resolvedPaymentMethod === 'MANUAL_BANK';

      const linkCreateData: Record<string, unknown> = {
          id: linkId,
          organization_id: dbOrgId,
          short_code: shortCode,
          status: 'OPEN',
          payment_method: resolvedPaymentMethod,
          amount: validatedData.amount,
          currency: validatedData.currency,
          description: validatedData.description,
          invoice_reference: validatedData.invoiceReference || null,
          invoice_date: validatedData.invoiceDate
            ? new Date(validatedData.invoiceDate as string)
            : now,
          customer_email: validatedData.customerEmail || null,
          customer_name: validatedData.customerName || null,
          customer_phone: validatedData.customerPhone || null,
          due_date: validatedData.dueDate ? new Date(validatedData.dueDate as string) : null,
          expires_at: validatedData.expiresAt ? new Date(validatedData.expiresAt as string) : null,
          invoice_only_mode: invoiceOnly,
          hedera_checkout_mode: hederaCheckoutMode,
          crypto_network: isCrypto ? (validatedData.cryptoNetwork?.trim() ?? null) : null,
          crypto_address: isCrypto ? (validatedData.cryptoAddress?.trim() ?? null) : null,
          crypto_currency: isCrypto ? (validatedData.cryptoCurrency?.trim() ?? null) : null,
          crypto_memo: isCrypto ? (validatedData.cryptoMemo?.trim() || null) : null,
          crypto_instructions: isCrypto ? (validatedData.cryptoInstructions?.trim() || null) : null,
          manual_bank_recipient_name: isManualBank
            ? validatedData.manualBankRecipientName?.trim() ?? null
            : null,
          manual_bank_currency: isManualBank
            ? validatedData.manualBankCurrency?.trim() ?? null
            : null,
          manual_bank_destination_type: isManualBank
            ? validatedData.manualBankDestinationType?.trim() ?? null
            : null,
          manual_bank_bank_name: isManualBank ? validatedData.manualBankBankName?.trim() || null : null,
          manual_bank_account_number: isManualBank
            ? validatedData.manualBankAccountNumber?.trim() || null
            : null,
          manual_bank_iban: isManualBank ? validatedData.manualBankIban?.trim() || null : null,
          manual_bank_swift_bic: isManualBank ? validatedData.manualBankSwiftBic?.trim() || null : null,
          manual_bank_routing_sort_code: isManualBank
            ? validatedData.manualBankRoutingSortCode?.trim() || null
            : null,
          manual_bank_wise_reference: isManualBank
            ? validatedData.manualBankWiseReference?.trim() || null
            : null,
          manual_bank_revolut_handle: isManualBank
            ? validatedData.manualBankRevolutHandle?.trim() || null
            : null,
          manual_bank_instructions: isManualBank
            ? validatedData.manualBankInstructions?.trim() || null
            : null,
          attachment_storage_key: validatedData.attachment?.storageKey ?? null,
          attachment_bucket: validatedData.attachment?.bucket ?? null,
          attachment_filename: validatedData.attachment?.filename ?? null,
          attachment_mime_type: validatedData.attachment?.mimeType ?? null,
          attachment_size_bytes: validatedData.attachment?.sizeBytes ?? null,
          created_at: now,
          updated_at: now,
          wise_status: wiseContext ? 'INSTRUCTIONS_READY' : null,
          pilot_deal_id: pilotDealIdToStore,
      };

      const link = await tx.payment_links.create({
        data: linkCreateData as any,
      });

      // Create initial payment event
      await tx.payment_events.create({
        data: {
          id: randomUUID(),
          payment_link_id: link.id,
          event_type: 'CREATED',
          pilot_deal_id: pilotDealIdToStore,
          metadata: {
            createdBy: user.id,
          },
          created_at: now,
        },
      });

      if (wiseContext) {
        await tx.payment_events.create({
          data: {
            id: randomUUID(),
            payment_link_id: link.id,
            event_type: 'PAYMENT_INITIATED',
            payment_method: 'WISE',
            pilot_deal_id: pilotDealIdToStore,
            metadata: wiseContext.metadata as object,
            created_at: now,
          },
        });
      }

      // Create audit log
      await tx.audit_logs.create({
        data: {
          id: randomUUID(),
          organization_id: dbOrgId,
          user_id: user.id,
          entity_type: 'PaymentLink',
          entity_id: link.id,
          action: 'CREATE',
          new_values: {
            shortCode,
            amount: validatedData.amount.toString(),
            currency: validatedData.currency,
          },
          created_at: now,
        },
      });

      return link;
    });

    loggers.payment.info(
      {
        paymentLinkId: paymentLink.id,
        shortCode: paymentLink.short_code,
        organizationId: dbOrgId,
        amount: validatedData.amount,
        currency: validatedData.currency,
        wiseContextPrepared: !!wiseContext,
      },
      'Payment link created'
    );

    // Capture FX creation snapshots for all supported tokens (fail-open)
    const paymentLinkId = paymentLink.id;
    const invoiceCurrency = validatedData.currency;
    loggers.payment.info(
      { paymentLinkId, invoiceCurrency },
      'FX_CREATION_START'
    );
    try {
      const fxService = getFxService();
      const snapshots = await fxService.captureAllCreationSnapshots(
        paymentLinkId,
        invoiceCurrency as Currency
      );
      const tokenList = snapshots?.map((s) => (s as { token_type?: string | null }).token_type ?? (s as { tokenType?: string }).tokenType) ?? [];
      loggers.payment.info(
        {
          paymentLinkId,
          snapshotCount: snapshots?.length ?? 0,
          tokens: tokenList,
        },
        'FX_CREATION_SUCCESS'
      );
    } catch (fxError: unknown) {
      const err = fxError instanceof Error ? fxError : new Error(String(fxError));
      loggers.payment.error(
        {
          paymentLinkId,
          invoiceCurrency,
          errName: err.name,
          errMessage: err.message,
          stack: err.stack,
          cause: err.cause != null ? String(err.cause) : undefined,
        },
        'FX_CREATION_FAIL'
      );
    }

    // Generate QR code (async, don't wait)
    generateQRCodeDataUrl(shortCode).catch((error) => {
      loggers.payment.error(
        { paymentLinkId: paymentLink.id, error },
        'Failed to generate QR code'
      );
    });

    // Same camelCase shape as GET /api/payment-links so clients always get `shortCode` for /pay/{shortCode}
    const createdPayload = transformPaymentLink(paymentLink as unknown as Record<string, unknown>);

    return NextResponse.json(
      {
        data: createdPayload,
        message: 'Payment link created successfully',
      },
      { status: 201 }
    );
  } catch (error: any) {
    loggers.api.error({ error: error.message }, 'Failed to create payment link');

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
