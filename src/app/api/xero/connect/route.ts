import { NextRequest, NextResponse } from 'next/server';
import { generateAuthUrl, isXeroConfigured } from '@/lib/xero';
import { logger, loggers } from '@/lib/logger';
import { signOAuthState } from '@/lib/security/oauth-state';
import { hashOAuthState } from '@/lib/xero/oauth-state-trace';
import {
  redirectToMfaForStepUp,
  requirePaymentConfigurationAccess,
} from '@/lib/auth/step-up.server';

import { normalizeXeroOAuthReturnPath } from '@/lib/xero/oauth-return-path';

export async function GET(request: NextRequest) {
  try {
    if (!isXeroConfigured()) {
      logger.error('Xero integration not configured');
      return NextResponse.json(
        {
          error: 'Xero integration is not configured. Please contact support.',
          details: 'Missing required environment variables: XERO_CLIENT_ID, XERO_CLIENT_SECRET, XERO_REDIRECT_URI',
        },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const access = await requirePaymentConfigurationAccess(
      request,
      searchParams.get('organization_id')
    );
    if (!access.ok) {
      if (access.code) {
        return redirectToMfaForStepUp(request, access.code);
      }
      return access.response;
    }
    const user = access.user;
    const organizationId = access.organizationId;

    const { requireEntitlement } = await import('@/lib/entitlements/gate-api.server');
    const entitlementBlock = await requireEntitlement({
      organizationId,
      userId: user.id,
      userEmail: user.email ?? undefined,
      feature: 'xero_integration',
    });
    if (entitlementBlock) return entitlementBlock;

    const returnTo = normalizeXeroOAuthReturnPath(searchParams.get('return_to'));

    const stateParam = signOAuthState({
      organizationId,
      userId: user.id,
      ...(returnTo ? { returnTo } : {}),
    });

    loggers.xero.debug('xero_connect_state_signed', {
      step: 'sign_oauth_state',
      stateHash: hashOAuthState(stateParam),
      stateLength: stateParam.length,
    });

    const authUrl = await generateAuthUrl(stateParam);

    logger.info({
      organizationId,
      userId: user.id,
    }, 'Xero OAuth flow initiated');

    return NextResponse.redirect(authUrl);
  } catch (error) {
    logger.error({ error }, 'Error initiating Xero OAuth flow');
    return NextResponse.json(
      { error: 'Failed to initiate Xero connection' },
      { status: 500 }
    );
  }
}
