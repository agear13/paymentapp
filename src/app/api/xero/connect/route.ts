import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateAuthUrl, isXeroConfigured } from '@/lib/xero';
import { logger, loggers } from '@/lib/logger';
import { signOAuthState } from '@/lib/security/oauth-state';
import { hashOAuthState } from '@/lib/xero/oauth-state-trace';
import { hasOrganizationPermission } from '@/lib/auth/organization-access';
import { resolveSessionOrganizationId } from '@/lib/organization/resolve-organization-api.server';

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

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const resolved = await resolveSessionOrganizationId(
      user.id,
      searchParams.get('organization_id'),
      'xero/connect'
    );
    if (resolved.response) return resolved.response;
    const organizationId = resolved.organizationId;

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

    const { requireEntitlement } = await import('@/lib/entitlements/gate-api.server');
    const entitlementBlock = await requireEntitlement({
      organizationId,
      userId: user.id,
      userEmail: user.email ?? undefined,
      feature: 'xero_integration',
    });
    if (entitlementBlock) return entitlementBlock;

    const stateParam = signOAuthState({
      organizationId,
      userId: user.id,
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
