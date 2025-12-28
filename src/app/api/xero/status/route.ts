/**
 * Xero Connection Status Endpoint
 * Returns current connection status for an organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getConnectionStatus, getAvailableTenants } from '@/lib/xero';
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

    // TODO: Verify user has permission to view Xero status for this organization

    // Get connection status
    const status = await getConnectionStatus(organizationId);

    // If connected, get available tenants
    let tenants = null;
    if (status.connected) {
      tenants = await getAvailableTenants(organizationId);
    }

    return NextResponse.json({
      ...status,
      tenants,
    });
  } catch (error) {
    logger.error('Error fetching Xero connection status', { error });
    return NextResponse.json(
      { error: 'Failed to fetch connection status' },
      { status: 500 }
    );
  }
}






