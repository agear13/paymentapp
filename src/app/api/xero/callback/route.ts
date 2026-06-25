/**
 * Xero OAuth Callback Endpoint
 * Handles callback from Xero after user authorizes connection
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { exchangeCodeForTokens, getXeroTenants, storeXeroConnection } from '@/lib/xero';
import { logger } from '@/lib/logger';
import { verifyOAuthState } from '@/lib/security/oauth-state';
import {
  buildXeroOAuthCallbackUrl,
  xeroIntegrationsRedirectUrl,
} from '@/lib/xero/oauth-redirect';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      logger.error('Xero OAuth error', { error });
      return NextResponse.redirect(
        xeroIntegrationsRedirectUrl(request, { xero_error: error })
      );
    }

    if (!code || !state) {
      logger.error('Missing code or state in Xero callback');
      return NextResponse.redirect(
        xeroIntegrationsRedirectUrl(request, { xero_error: 'missing_parameters' })
      );
    }

    const stateData = verifyOAuthState<{ organizationId: string; userId: string }>(state);
    if (!stateData?.organizationId || !stateData?.userId) {
      logger.error('Invalid state parameter in Xero callback');
      return NextResponse.redirect(
        xeroIntegrationsRedirectUrl(request, { xero_error: 'invalid_state' })
      );
    }

    const { organizationId, userId } = stateData;

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.id !== userId) {
      logger.error('Xero callback user mismatch', { callbackUserId: user?.id, stateUserId: userId });
      return NextResponse.redirect(
        xeroIntegrationsRedirectUrl(request, { xero_error: 'unauthorized' })
      );
    }

    const callbackUrl = buildXeroOAuthCallbackUrl(request);
    const tokens = await exchangeCodeForTokens(callbackUrl);

    const tenants = await getXeroTenants(tokens.accessToken);

    if (tenants.length === 0) {
      logger.error('No Xero tenants available for user', { userId });
      return NextResponse.redirect(
        xeroIntegrationsRedirectUrl(request, { xero_error: 'no_tenants' })
      );
    }

    const selectedTenant = tenants[0];

    await storeXeroConnection(
      organizationId,
      selectedTenant.tenantId,
      tokens.accessToken,
      tokens.refreshToken,
      tokens.expiresAt
    );

    logger.info('Xero connection established', {
      organizationId,
      userId,
      tenantId: selectedTenant.tenantId,
      tenantName: selectedTenant.tenantName,
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
    logger.error('Error processing Xero OAuth callback', { error });
    return NextResponse.redirect(
      xeroIntegrationsRedirectUrl(request, { xero_error: 'connection_failed' })
    );
  }
}
