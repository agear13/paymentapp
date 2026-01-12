/**
 * Xero Accounts API Endpoint
 * Fetches Chart of Accounts from Xero
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { 
  fetchXeroAccounts, 
  fetchXeroAccountsByType,
  searchXeroAccounts 
} from '@/lib/xero/accounts-service';
import { logger } from '@/lib/logger';

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

    // TODO: Verify user has permission to access Xero accounts for this organization

    // Optional query parameters for filtering
    const accountType = searchParams.get('type');
    const searchTerm = searchParams.get('search');

    let result;

    if (searchTerm) {
      // Search accounts by name or code
      const accounts = await searchXeroAccounts(organizationId, searchTerm);
      result = { accounts, total: accounts.length };
    } else if (accountType) {
      // Filter by account type
      const accounts = await fetchXeroAccountsByType(organizationId, accountType);
      result = { accounts, total: accounts.length };
    } else {
      // Fetch all accounts
      result = await fetchXeroAccounts(organizationId);
    }

    logger.info('Fetched Xero accounts', {
      organizationId,
      total: result.total,
      accountType,
      searchTerm,
    });

    return NextResponse.json({ data: result.accounts });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error({ 
      error: errorMessage,
      stack: errorStack,
      organizationId,
    }, 'Error fetching Xero accounts');
    
    // Handle specific Xero errors
    if (errorMessage.includes('No active Xero connection')) {
      return NextResponse.json(
        { error: 'No active Xero connection found. Please connect to Xero first.' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch accounts from Xero', details: errorMessage },
      { status: 500 }
    );
  }
}






