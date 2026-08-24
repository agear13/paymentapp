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
import { XERO_REAUTHORIZATION_MESSAGE } from '@/lib/xero/xero-connection-ui';

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

    if (status.connected && !status.stale && !status.reauthorizationRequired) {
      try {
        tenants = await getAvailableTenants(organizationId);
      } catch (err) {
        loggers.xero.warn('xero_status_tenant_list_failed', {
          organizationId,
          tenantId: status.tenantId,
          connectionState: status.connectionState,
          err: err instanceof Error ? err.message : String(err),
        });
        tenants = [];
      }
    }

    let operatorMessage: string | undefined;
    if (status.reauthorizationRequired || status.stale || (!status.connected && status.tenantId)) {
      operatorMessage = XERO_REAUTHORIZATION_MESSAGE;
    }

    loggers.xero.info('xero_connection_status', {
      organizationId,
      tenantId: status.tenantId,
      connectionState: status.connectionState,
      expiresAt: status.expiresAt?.toISOString(),
      reauthorizationRequired: Boolean(status.reauthorizationRequired),
      transientRefreshFailure: Boolean(status.transientRefreshFailure),
      refreshFailureCategory: status.refreshFailure?.category ?? null,
      refreshFailureStatusCode: status.refreshFailure?.statusCode ?? null,
      refreshFailureProviderError: status.refreshFailure?.providerError ?? null,
      refreshFailureMessage: status.refreshFailure?.message ?? null,
    });

    return NextResponse.json({
      ...status,
      refreshFailure: status.refreshFailure ?? null,
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
          'Could not load Xero status. Try again from Connected Systems.',
      },
      { status: 500 }
    );
  }
}
