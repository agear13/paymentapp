import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  fetchXeroAccounts,
  fetchXeroAccountsByType,
  searchXeroAccounts,
} from '@/lib/xero/accounts-service';
import { resolveXeroConnectionForApi } from '@/lib/xero/connection-service';
import { logger } from '@/lib/logger';
import { hasOrganizationPermission } from '@/lib/auth/organization-access';
import { resolveSessionOrganizationId } from '@/lib/organization/resolve-organization-api.server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolved = await resolveSessionOrganizationId(
      user.id,
      searchParams.get('organization_id'),
      'xero/accounts'
    );
    if (resolved.response) return resolved.response;
    const organizationId = resolved.organizationId;

    const canViewSettings = await hasOrganizationPermission(
      user.id,
      organizationId,
      'view_settings'
    );
    if (!canViewSettings) {
      return NextResponse.json(
        { error: 'Forbidden - insufficient organization permissions' },
        { status: 403 }
      );
    }

    const connectionResolved = await resolveXeroConnectionForApi(organizationId);
    if (!connectionResolved.persisted) {
      return NextResponse.json(
        { error: 'No active Xero connection found. Please connect to Xero first.' },
        { status: 404 }
      );
    }
    if (connectionResolved.stale || !connectionResolved.connection) {
      return NextResponse.json(
        {
          error:
            'Xero connection needs to be refreshed. Disconnect in Integrations and connect again.',
        },
        { status: 503 }
      );
    }

    const accountType = searchParams.get('type');
    const searchTerm = searchParams.get('search');

    let result;

    if (searchTerm) {
      const accounts = await searchXeroAccounts(organizationId, searchTerm);
      result = { accounts, total: accounts.length };
    } else if (accountType) {
      const accounts = await fetchXeroAccountsByType(organizationId, accountType);
      result = { accounts, total: accounts.length };
    } else {
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
    }, 'Error fetching Xero accounts');

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
