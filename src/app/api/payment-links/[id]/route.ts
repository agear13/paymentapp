/**
 * Payment Link API - Individual Operations
 * GET /api/payment-links/[id] - Get payment link by ID
 * PATCH /api/payment-links/[id] - Update payment link
 * DELETE /api/payment-links/[id] - Cancel payment link
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { loggers } from '@/lib/logger';
import { requireAuth } from '@/lib/auth/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';

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
    customerPhone: link.customer_phone,
    expiresAt: link.expires_at,
    createdAt: link.created_at,
    updatedAt: link.updated_at,
    paymentEvents: link.payment_events,
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
 * Update payment link (only allowed in DRAFT status)
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

    // Get current payment link
    const currentLink = await prisma.payment_links.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
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

    // Check if editable
    if (!isPaymentLinkEditable(currentLink.status)) {
      return NextResponse.json(
        { error: 'Payment link cannot be edited in current status' },
        { status: 400 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const validatedData = UpdatePaymentLinkSchema.parse(body);

    // Update payment link
    const updatedLink = await prisma.$transaction(async (tx) => {
      const updated = await tx.payment_links.update({
        where: { id },
        data: {
          ...validatedData,
          expires_at: validatedData.expiresAt
            ? new Date(validatedData.expiresAt as any)
            : undefined,
          updated_at: new Date(),
        },
      });

      // Create audit log
      await tx.audit_logs.create({
        data: {
          organization_id: currentLink.organization_id,
          user_id: user.id,
          entity_type: 'PaymentLink',
          entity_id: id,
          action: 'UPDATE',
          new_values: validatedData,
        },
      });

      return updated;
    });

    loggers.api.info(
      { paymentLinkId: id, updates: validatedData },
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




