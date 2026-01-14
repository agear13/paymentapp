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

// Helper to transform snake_case DB fields to camelCase for frontend
function transformPaymentLink(link: any) {
  return {
    id: link.id,
    shortCode: link.short_code,
    status: link.status,
    amount: Number(link.amount),
    currency: link.currency,
    description: link.description,
    invoiceReference: link.invoice_reference,
    customerEmail: link.customer_email,
    customerName: link.customer_name,
    customerPhone: link.customer_phone,
    dueDate: link.due_date,
    expiresAt: link.expires_at,
    xeroInvoiceNumber: link.xero_invoice_number,
    createdAt: link.created_at,
    updatedAt: link.updated_at,
    paymentEvents: link.payment_events,
  };
}

/**
 * Clerk Org ID (org_...) -> DB Org UUID mapping
 * Ensures organizations row exists and returns organizations.id (UUID)
 */
async function getOrCreateDbOrgId(params: {
  clerkOrgId: string;
  orgName?: string | null;
}) {
  const { clerkOrgId, orgName } = params;

  const org = await prisma.organizations.upsert({
    where: { clerk_org_id: clerkOrgId },
    update: orgName ? { name: orgName } : {},
    create: {
      id: randomUUID(),
      clerk_org_id: clerkOrgId,
      name: orgName ?? 'Unnamed organization',
    },
    select: { id: true },
  });

  return org.id;
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
    const clerkOrgId = searchParams.get('organizationId');

    if (!clerkOrgId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    // Check permission (assumes permission system is keyed on Clerk org id)
    const canView = await checkUserPermission(user.id, clerkOrgId, 'view_payment_links');
    if (!canView) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    // Map Clerk org id -> DB UUID (and ensure org exists)
    const dbOrgId = await getOrCreateDbOrgId({ clerkOrgId });

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

    // Get paginated results
    const paymentLinks = await prisma.payment_links.findMany({
      where,
      include: {
        payment_events: {
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
      orderBy: { created_at: 'desc' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });

    loggers.api.info(
      {
        clerkOrgId,
        dbOrgId,
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

    const clerkOrgId = validatedData.organizationId;

    // Check permission (assumes permission system is keyed on Clerk org id)
    const canCreate = await checkUserPermission(
      user.id,
      clerkOrgId,
      'create_payment_links'
    );
    if (!canCreate) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    // Map Clerk org id -> DB UUID (and ensure org exists)
    const dbOrgId = await getOrCreateDbOrgId({ clerkOrgId });

    // Generate unique short code
    const shortCode = await generateUniqueShortCode();

    // Create payment link with initial event
    const now = new Date();
    const paymentLink = await prisma.$transaction(async (tx) => {
      const linkId = randomUUID();

      const link = await tx.payment_links.create({
        data: {
          id: linkId,
          organization_id: dbOrgId,
          short_code: shortCode,
          status: 'OPEN',
          amount: validatedData.amount,
          currency: validatedData.currency,
          description: validatedData.description,
          invoice_reference: validatedData.invoiceReference || null,
          customer_email: validatedData.customerEmail || null,
          customer_name: validatedData.customerName || null,
          customer_phone: validatedData.customerPhone || null,
          due_date: validatedData.dueDate ? new Date(validatedData.dueDate as any) : null,
          expires_at: validatedData.expiresAt ? new Date(validatedData.expiresAt as any) : null,
          created_at: now,
          updated_at: now,
        },
      });

      // Create initial payment event
      await tx.payment_events.create({
        data: {
          id: randomUUID(),
          payment_link_id: link.id,
          event_type: 'CREATED',
          metadata: {
            createdBy: user.id,
          },
          created_at: now,
        },
      });

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
        clerkOrgId,
        dbOrgId,
        amount: validatedData.amount,
        currency: validatedData.currency,
      },
      'Payment link created'
    );

    // Generate QR code (async, don't wait)
    generateQRCodeDataUrl(shortCode).catch((error) => {
      loggers.payment.error(
        { paymentLinkId: paymentLink.id, error },
        'Failed to generate QR code'
      );
    });

    return NextResponse.json(
      {
        data: paymentLink,
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
