/**
 * Xero OAuth Callback Endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { exchangeCodeForTokens, getXeroTenants, storeXeroConnection } from '@/lib/xero';
import { loggers } from '@/lib/logger';
import { verifyOAuthState } from '@/lib/security/oauth-state';
import {
  buildXeroOAuthCallbackUrl,
  xeroIntegrationsRedirectUrl,
} from '@/lib/xero/oauth-redirect';
import {
  assertXeroConfigured,
  XeroConfigurationError,
} from '@/lib/xero/xero-config';

export async function GET(request: NextRequest) {
  const organizationIdHint = 'unknown';
  try {
    loggers.xero.info('xero_callback_start', { step: 'parse_callback_params' });

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      loggers.xero.error('xero_callback_oauth_error', undefined, { step: 'oauth_error', error });
      return NextResponse.redirect(
        xeroIntegrationsRedirectUrl(request, { xero_error: error })
      );
    }

    if (!code || !state) {
      loggers.xero.error('xero_callback_missing_params', undefined, {
        step: 'validate_params',
        hasCode: Boolean(code),
        hasState: Boolean(state),
      });
      return NextResponse.redirect(
        xeroIntegrationsRedirectUrl(request, { xero_error: 'missing_parameters' })
      );
    }

    loggers.xero.info('xero_callback_verify_state', { step: 'verify_oauth_state' });
    const stateData = verifyOAuthState<{ organizationId: string; userId: string }>(state);
    if (!stateData?.organizationId || !stateData?.userId) {
      loggers.xero.error('xero_callback_invalid_state', undefined, { step: 'verify_oauth_state' });
      return NextResponse.redirect(
        xeroIntegrationsRedirectUrl(request, { xero_error: 'invalid_state' })
      );
    }

    const { organizationId, userId } = stateData;

    loggers.xero.info('xero_callback_verify_session', {
      step: 'verify_user_session',
      organizationId,
      userId,
    });

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.id !== userId) {
      loggers.xero.error('xero_callback_user_mismatch', authError ?? undefined, {
        step: 'verify_user_session',
        organizationId,
        callbackUserId: user?.id,
        stateUserId: userId,
      });
      return NextResponse.redirect(
        xeroIntegrationsRedirectUrl(request, { xero_error: 'unauthorized' })
      );
    }

    loggers.xero.info('xero_callback_check_config', { step: 'check_environment', organizationId });
    assertXeroConfigured();

    const callbackUrl = buildXeroOAuthCallbackUrl(request);

    loggers.xero.info('xero_callback_exchange_tokens', {
      step: 'exchange_code_for_tokens',
      organizationId,
    });
    const tokens = await exchangeCodeForTokens(callbackUrl);

    loggers.xero.info('xero_callback_fetch_tenants', {
      step: 'retrieve_tenant_list',
      organizationId,
    });
    const tenants = await getXeroTenants(tokens.accessToken);

    if (tenants.length === 0) {
      loggers.xero.error('xero_callback_no_tenants', undefined, {
        step: 'retrieve_tenant_list',
        organizationId,
        userId,
      });
      return NextResponse.redirect(
        xeroIntegrationsRedirectUrl(request, { xero_error: 'no_tenants' })
      );
    }

    const selectedTenant = tenants[0];

    loggers.xero.info('xero_callback_store_connection', {
      step: 'persist_connection',
      organizationId,
      tenantId: selectedTenant.tenantId,
    });

    await storeXeroConnection(
      organizationId,
      selectedTenant.tenantId,
      tokens.accessToken,
      tokens.refreshToken,
      tokens.expiresAt
    );

    loggers.xero.info('xero_callback_success', {
      step: 'callback_complete',
      organizationId,
      userId,
      tenantId: selectedTenant.tenantId,
      tenantName: selectedTenant.tenantName,
      tenantCount: tenants.length,
    });

    const redirectUrl =
      tenants.length > 1
        ? xeroIntegrationsRedirectUrl(request, {
            xero_success: 'connected',
            select_tenant: 'true',
          })
        : xeroIntegrationsRedirectUrl(request, { xero_success: 'connected' });

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    loggers.xero.error('xero_callback_failed', error, {
      step: 'callback_handler',
      organizationId: organizationIdHint,
    });

    if (error instanceof XeroConfigurationError) {
      return NextResponse.redirect(
        xeroIntegrationsRedirectUrl(request, { xero_error: 'not_configured' })
      );
    }

    return NextResponse.redirect(
      xeroIntegrationsRedirectUrl(request, { xero_error: 'connection_failed' })
    );
  }
}
