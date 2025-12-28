/**
 * Xero OAuth Callback Endpoint
 * Handles callback from Xero after user authorizes connection
 */

import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, getXeroTenants, storeXeroConnection } from '@/lib/xero';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Check for authorization errors
    if (error) {
      logger.error('Xero OAuth error', { error });
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings?xero_error=${encodeURIComponent(error)}`
      );
    }

    // Validate required parameters
    if (!code || !state) {
      logger.error('Missing code or state in Xero callback');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings?xero_error=missing_parameters`
      );
    }

    // Decode state parameter
    let stateData: { organizationId: string; userId: string };
    try {
      stateData = JSON.parse(
        Buffer.from(state, 'base64').toString('utf8')
      );
    } catch {
      logger.error('Invalid state parameter in Xero callback');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings?xero_error=invalid_state`
      );
    }

    const { organizationId, userId } = stateData;

    // Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Get available Xero tenants
    const tenants = await getXeroTenants(tokens.accessToken);

    if (tenants.length === 0) {
      logger.error('No Xero tenants available for user', { userId });
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings?xero_error=no_tenants`
      );
    }

    // Use first tenant by default (or let user select later)
    const selectedTenant = tenants[0];

    // Store connection in database
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

    // Redirect to settings page with success message
    const redirectUrl = tenants.length > 1
      ? `${process.env.NEXT_PUBLIC_APP_URL}/settings?xero_success=connected&select_tenant=true`
      : `${process.env.NEXT_PUBLIC_APP_URL}/settings?xero_success=connected`;

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    logger.error('Error processing Xero OAuth callback', { error });
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?xero_error=connection_failed`
    );
  }
}






