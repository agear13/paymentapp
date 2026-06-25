/**
 * Xero Connection Status Endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getConnectionStatus,
  getAvailableTenants,
  isXeroConfigured,
} from '@/lib/xero';
import { loggers } from '@/lib/logger';
import { hasOrganizationPermission } from '@/lib/auth/organization-access';
import { resolveSessionOrganizationId } from '@/lib/organization/resolve-organization-api.server';

function staleConnectionMessage(): string {
  return 'Xero connection needs to be refreshed. Disconnect in Integrations and connect again.';
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const resolved = await resolveSessionOrganizationId(
      user.id,
      searchParams.get('organization_id'),
      'xero/status'
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

    if (!isXeroConfigured()) {
      return NextResponse.json({
        connected: false,
        tenants: null,
        operatorMessage:
          'Xero is not configured on this server. Contact support if invoices should sync to Xero.',
      });
    }

    const status = await getConnectionStatus(organizationId);

    let tenants: Awaited<ReturnType<typeof getAvailableTenants>> = null;
    let tenantsError: string | undefined;

    if (status.connected) {
      try {
        tenants = await getAvailableTenants(organizationId);
      } catch (err) {
        loggers.xero.warn('xero_status_tenant_list_failed', {
          organizationId,
          err: err instanceof Error ? err.message : String(err),
        });
        tenants = [];
        tenantsError = staleConnectionMessage();
      }
    }

    let operatorMessage: string | undefined;
    if (!status.connected && status.tenantId) {
      operatorMessage = staleConnectionMessage();
    }
    if (tenantsError) {
      operatorMessage = tenantsError;
    }

    return NextResponse.json({
      ...status,
      tenants,
      ...(operatorMessage ? { operatorMessage } : {}),
    });
  } catch (error) {
    loggers.xero.error(
      'xero_status_unexpected_error',
      error instanceof Error ? error : undefined,
      {}
    );
    return NextResponse.json(
      {
        error: 'Failed to fetch connection status',
        operatorMessage:
          'Could not load Xero status. Try again, or reconnect Xero from Integrations.',
      },
      { status: 500 }
    );
  }
}
