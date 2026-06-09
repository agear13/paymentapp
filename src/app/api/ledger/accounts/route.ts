/**
 * Ledger Accounts API - List and Create
 * GET /api/ledger/accounts - List all accounts for organization
 * POST /api/ledger/accounts - Create new account
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';
import { requireAuth } from '@/lib/auth/middleware';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { checkUserPermission } from '@/lib/auth/permissions';
import { applyRateLimit } from '@/lib/rate-limit';
import { LedgerAccountType } from '@prisma/client';

/**
 * Validation schema for creating a ledger account
 */
const CreateLedgerAccountSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  accountType: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
  xeroAccountId: z.string().optional(),
});

/**
 * Query parameters schema for listing accounts
 */
const ListQuerySchema = z.object({
  accountType: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']).optional(),
  search: z.string().optional(),
});

/**
 * GET /api/ledger/accounts
 * List all ledger accounts for an organization
 */
export async function GET(request: NextRequest) {
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
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = await getOrganizationForAuthenticatedUser(user.id);
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    const organizationId = org.id;

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const query = ListQuerySchema.parse({
      accountType: searchParams.get('accountType') || undefined,
      search: searchParams.get('search') || undefined,
    });

    // Check permission
    const canView = await checkUserPermission(
      user.id,
      organizationId,
      'view_payment_links' // Using existing permission
    );
    if (!canView) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    loggers.payment.info(
      { msg: 'Ledger/commission access', userId: user.id, organizationId },
      'Ledger accounts list'
    );

    // Build where clause
    const where: any = {
      organization_id: organizationId,
    };

    if (query.accountType) {
      where.account_type = query.accountType;
    }

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Get accounts
    const accounts = await prisma.ledger_accounts.findMany({
      where,
      orderBy: { code: 'asc' },
      include: {
        _count: {
          select: {
            ledger_entries: true,
          },
        },
      },
    });

    loggers.api.info(
      {
        organizationId,
        count: accounts.length,
        filters: query,
      },
      'Listed ledger accounts'
    );

    // Transform to camelCase
    const transformedAccounts = accounts.map((account) => ({
      id: account.id,
      organizationId: account.organization_id,
      code: account.code,
      name: account.name,
      accountType: account.account_type,
      xeroAccountId: account.xero_account_id,
      createdAt: account.created_at,
      entriesCount: account._count.ledger_entries,
    }));

    return NextResponse.json({
      data: transformedAccounts,
      count: transformedAccounts.length,
    });
  } catch (error: any) {
    loggers.api.error({ error: error.message }, 'Failed to list ledger accounts');

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
 * POST /api/ledger/accounts
 * Create a new ledger account
 */
export async function POST(request: NextRequest) {
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
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = await getOrganizationForAuthenticatedUser(user.id);
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    const organizationId = org.id;

    // Parse and validate body
    const body = await request.json();
    const validatedData = CreateLedgerAccountSchema.parse(body);

    // Check permission
    const canEdit = await checkUserPermission(
      user.id,
      organizationId,
      'edit_payment_links' // Using existing permission
    );
    if (!canEdit) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    loggers.payment.info(
      { msg: 'Ledger/commission access', userId: user.id, organizationId },
      'Ledger account create'
    );

    // Check if account code already exists for this organization
    const existing = await prisma.ledger_accounts.findUnique({
      where: {
        organization_id_code: {
          organization_id: organizationId,
          code: validatedData.code,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          error: 'Account code already exists',
          code: validatedData.code,
        },
        { status: 409 }
      );
    }

    // Create account
    const account = await prisma.ledger_accounts.create({
      data: {
        organization_id: organizationId,
        code: validatedData.code,
        name: validatedData.name,
        account_type: validatedData.accountType as LedgerAccountType,
        xero_account_id: validatedData.xeroAccountId || null,
      },
    });

    // Create audit log
    await prisma.audit_logs.create({
      data: {
        organization_id: organizationId,
        user_id: user.id,
        entity_type: 'LedgerAccount',
        entity_id: account.id,
        action: 'CREATE',
        new_values: {
          code: account.code,
          name: account.name,
          accountType: account.account_type,
        },
      },
    });

    loggers.api.info(
      {
        accountId: account.id,
        code: account.code,
        organizationId,
      },
      'Ledger account created'
    );

    return NextResponse.json(
      {
        data: {
          id: account.id,
          organizationId: account.organization_id,
          code: account.code,
          name: account.name,
          accountType: account.account_type,
          xeroAccountId: account.xero_account_id,
          createdAt: account.created_at,
        },
        message: 'Ledger account created successfully',
      },
      { status: 201 }
    );
  } catch (error: any) {
    loggers.api.error({ error: error.message }, 'Failed to create ledger account');

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






