/**
 * Xero Tenant Selection Endpoint
 * Updates selected Xero tenant for an organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateSelectedTenant } from '@/lib/xero';
import { logger } from '@/lib/logger';
import { hasOrganizationPermission } from '@/lib/auth/organization-access';

export async function POST(request: NextRequest) {
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

    // Get data from request body
    const body = await request.json();
    const { organizationId, tenantId } = body;

    if (!organizationId || !tenantId) {
      return NextResponse.json(
        { error: 'Missing organizationId or tenantId' },
        { status: 400 }
      );
    }

    const canManageSettings = await hasOrganizationPermission(
      user.id,
      organizationId,
      'manage_settings'
    );
    if (!canManageSettings) {
      return NextResponse.json(
        { error: 'Forbidden - insufficient organization permissions' },
        { status: 403 }
      );
    }

    // Update selected tenant
    await updateSelectedTenant(organizationId, tenantId);

    logger.info('Xero tenant updated', {
      organizationId,
      tenantId,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      message: 'Xero tenant updated successfully',
    });
  } catch (error) {
    logger.error('Error updating Xero tenant', { error });
    return NextResponse.json(
      { error: 'Failed to update tenant' },
      { status: 500 }
    );
  }
}






