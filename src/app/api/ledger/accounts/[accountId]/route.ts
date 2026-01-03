/**
 * Ledger Account API - Single Account Operations
 * GET /api/ledger/accounts/[accountId] - Get single account
 * PUT /api/ledger/accounts/[accountId] - Update account
 * DELETE /api/ledger/accounts/[accountId] - Delete account
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';
import { requireAuth } from '@/lib/auth/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { applyRateLimit } from '@/lib/rate-limit';

/**
 * Validation schema for updating a ledger account
 */
const UpdateLedgerAccountSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  xeroAccountId: z.string().optional().nullable(),
  // Note: code and accountType are immutable after creation
});

/**
 * GET /api/ledger/accounts/[accountId]
 * Get a single ledger account with details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { accountId: string } }
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { accountId } = params;

    // Get account
    const account = await prisma.ledger_accounts.findUnique({
      where: { id: accountId },
      include: {
        _count: {
          select: {
            ledger_entries: true,
          },
        },
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Ledger account not found' },
        { status: 404 }
      );
    }

    // Check permission
    const canView = await checkUserPermission(
      user.id,
      account.organization_id,
      'view_payment_links'
    );
    if (!canView) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    loggers.api.info({ accountId }, 'Retrieved ledger account');

    // Transform to camelCase
    return NextResponse.json({
      data: {
        id: account.id,
        organizationId: account.organization_id,
        code: account.code,
        name: account.name,
        accountType: account.account_type,
        xeroAccountId: account.xero_account_id,
        createdAt: account.created_at,
        entriesCount: account._count.ledger_entries,
      },
    });
  } catch (error: any) {
    loggers.api.error(
      { error: error.message, accountId: params.accountId },
      'Failed to get ledger account'
    );

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/ledger/accounts/[accountId]
 * Update a ledger account
 * Note: Code and account type are immutable
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { accountId: string } }
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { accountId } = params;

    // Get existing account
    const existingAccount = await prisma.ledger_accounts.findUnique({
      where: { id: accountId },
    });

    if (!existingAccount) {
      return NextResponse.json(
        { error: 'Ledger account not found' },
        { status: 404 }
      );
    }

    // Check permission
    const canEdit = await checkUserPermission(
      user.id,
      existingAccount.organization_id,
      'edit_payment_links'
    );
    if (!canEdit) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const validatedData = UpdateLedgerAccountSchema.parse(body);

    // Build update data
    const updateData: any = {};
    if (validatedData.name !== undefined) {
      updateData.name = validatedData.name;
    }
    if (validatedData.xeroAccountId !== undefined) {
      updateData.xero_account_id = validatedData.xeroAccountId;
    }

    // Update account
    const updatedAccount = await prisma.ledger_accounts.update({
      where: { id: accountId },
      data: updateData,
    });

    // Create audit log
    await prisma.audit_logs.create({
      data: {
        organization_id: existingAccount.organization_id,
        user_id: user.id,
        entity_type: 'LedgerAccount',
        entity_id: accountId,
        action: 'UPDATE',
        old_values: {
          name: existingAccount.name,
          xeroAccountId: existingAccount.xero_account_id,
        },
        new_values: {
          name: updatedAccount.name,
          xeroAccountId: updatedAccount.xero_account_id,
        },
      },
    });

    loggers.api.info({ accountId, updates: updateData }, 'Updated ledger account');

    return NextResponse.json({
      data: {
        id: updatedAccount.id,
        organizationId: updatedAccount.organization_id,
        code: updatedAccount.code,
        name: updatedAccount.name,
        accountType: updatedAccount.account_type,
        xeroAccountId: updatedAccount.xero_account_id,
        createdAt: updatedAccount.created_at,
      },
      message: 'Ledger account updated successfully',
    });
  } catch (error: any) {
    loggers.api.error(
      { error: error.message, accountId: params.accountId },
      'Failed to update ledger account'
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
 * DELETE /api/ledger/accounts/[accountId]
 * Delete a ledger account
 * Only allowed if no entries exist
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { accountId: string } }
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { accountId } = params;

    // Get existing account
    const existingAccount = await prisma.ledger_accounts.findUnique({
      where: { id: accountId },
      include: {
        _count: {
          select: {
            ledger_entries: true,
          },
        },
      },
    });

    if (!existingAccount) {
      return NextResponse.json(
        { error: 'Ledger account not found' },
        { status: 404 }
      );
    }

    // Check permission
    const canEdit = await checkUserPermission(
      user.id,
      existingAccount.organization_id,
      'edit_payment_links'
    );
    if (!canEdit) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    // Check if account has entries
    if (existingAccount._count.ledger_entries > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete account with existing entries',
          entriesCount: existingAccount._count.ledger_entries,
        },
        { status: 400 }
      );
    }

    // Delete account
    await prisma.ledger_accounts.delete({
      where: { id: accountId },
    });

    // Create audit log
    await prisma.audit_logs.create({
      data: {
        organization_id: existingAccount.organization_id,
        user_id: user.id,
        entity_type: 'LedgerAccount',
        entity_id: accountId,
        action: 'DELETE',
        old_values: {
          code: existingAccount.code,
          name: existingAccount.name,
          accountType: existingAccount.account_type,
        },
      },
    });

    loggers.api.info({ accountId }, 'Deleted ledger account');

    return NextResponse.json({
      message: 'Ledger account deleted successfully',
    });
  } catch (error: any) {
    loggers.api.error(
      { error: error.message, accountId: params.accountId },
      'Failed to delete ledger account'
    );

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}






