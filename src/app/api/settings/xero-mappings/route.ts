/**
 * Xero Account Mappings API Endpoint
 * Manages saving and retrieving Xero account mappings
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// GET /api/settings/xero-mappings?organization_id=xxx
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get organization from query params
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organization_id');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Missing organization_id parameter' },
        { status: 400 }
      );
    }

    // TODO: Verify user has permission to access settings for this organization

    // Fetch merchant settings with Xero mappings
    const settings = await prisma.merchant_settings.findFirst({
      where: {
        organization_id: organizationId,
      },
      select: {
        xero_revenue_account_id: true,
        xero_receivable_account_id: true,
        xero_stripe_clearing_account_id: true,
        xero_hbar_clearing_account_id: true,
        xero_usdc_clearing_account_id: true,
        xero_usdt_clearing_account_id: true,
        xero_audd_clearing_account_id: true,
        xero_fee_expense_account_id: true,
      },
    });

    return NextResponse.json({ data: settings });
  } catch (error) {
    logger.error('Error fetching Xero mappings', { error });
    return NextResponse.json(
      { error: 'Failed to fetch mappings' },
      { status: 500 }
    );
  }
}

// PUT /api/settings/xero-mappings
export async function PUT(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { organizationId, ...mappings } = body;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    // TODO: Verify user has permission to update settings for this organization

    // Validate all required mappings
    const required = [
      'xero_revenue_account_id',
      'xero_receivable_account_id',
      'xero_stripe_clearing_account_id',
      'xero_hbar_clearing_account_id',
      'xero_usdc_clearing_account_id',
      'xero_usdt_clearing_account_id',
      'xero_audd_clearing_account_id',
      'xero_fee_expense_account_id',
    ];

    for (const field of required) {
      if (!mappings[field]) {
        return NextResponse.json(
          { error: `${field} is required` },
          { status: 400 }
        );
      }
    }

    // Validate no duplicate crypto clearing accounts
    const cryptoAccounts = [
      mappings.xero_stripe_clearing_account_id,
      mappings.xero_hbar_clearing_account_id,
      mappings.xero_usdc_clearing_account_id,
      mappings.xero_usdt_clearing_account_id,
      mappings.xero_audd_clearing_account_id,
    ];

    const uniqueCryptoAccounts = new Set(cryptoAccounts);
    if (uniqueCryptoAccounts.size !== cryptoAccounts.length) {
      return NextResponse.json(
        { error: 'Each clearing account must be mapped to a different Xero account' },
        { status: 400 }
      );
    }

    // Update merchant settings
    const updated = await prisma.merchant_settings.updateMany({
      where: {
        organization_id: organizationId,
      },
      data: {
        xero_revenue_account_id: mappings.xero_revenue_account_id,
        xero_receivable_account_id: mappings.xero_receivable_account_id,
        xero_stripe_clearing_account_id: mappings.xero_stripe_clearing_account_id,
        xero_hbar_clearing_account_id: mappings.xero_hbar_clearing_account_id,
        xero_usdc_clearing_account_id: mappings.xero_usdc_clearing_account_id,
        xero_usdt_clearing_account_id: mappings.xero_usdt_clearing_account_id,
        xero_audd_clearing_account_id: mappings.xero_audd_clearing_account_id,
        xero_fee_expense_account_id: mappings.xero_fee_expense_account_id,
        updated_at: new Date(),
      },
    });

    if (updated.count === 0) {
      return NextResponse.json(
        { error: 'Merchant settings not found' },
        { status: 404 }
      );
    }

    logger.info('Updated Xero account mappings', {
      organizationId,
      mappingsCount: required.length,
    });

    return NextResponse.json({
      data: { success: true, message: 'Mappings updated successfully' },
    });
  } catch (error) {
    logger.error('Error saving Xero mappings', { error });
    return NextResponse.json(
      { error: 'Failed to save mappings' },
      { status: 500 }
    );
  }
}






