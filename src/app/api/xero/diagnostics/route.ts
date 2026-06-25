/**
 * GET /api/xero/diagnostics?organization_id=...
 * Admin-only Xero connection diagnostics (no secrets exposed).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminForApi } from '@/lib/auth/api-session.server';
import {
  assertXeroConfigured,
  XeroConfigurationError,
} from '@/lib/xero/xero-config';
import { runXeroDiagnostics } from '@/lib/xero/xero-diagnostics';
import { loggers } from '@/lib/logger';
import { parseOrganizationIdParam } from '@/lib/organization/resolve-organization-api.server';

export async function GET(request: NextRequest) {
  try {
    const adminAuth = await requireAdminForApi(request);
    if (!adminAuth.user) {
      return adminAuth.response!;
    }

    const organizationIdParam = new URL(request.url).searchParams.get('organization_id');
    const parsed = parseOrganizationIdParam(
      organizationIdParam,
      'organization_id',
      'xero/diagnostics'
    );
    if (parsed.response) return parsed.response;
    const organizationId = parsed.organizationId!;

    loggers.xero.info('xero_diagnostics_request', {
      organizationId,
      userId: adminAuth.user.id,
    });

    try {
      assertXeroConfigured();
    } catch (error) {
      if (error instanceof XeroConfigurationError) {
        return NextResponse.json(
          {
            error: error.message,
            code: 'XERO_NOT_CONFIGURED',
            missingEnv: error.missing,
            diagnostics: {
              organizationId,
              environment: {
                XERO_CLIENT_ID: Boolean(process.env.XERO_CLIENT_ID),
                XERO_CLIENT_SECRET: Boolean(process.env.XERO_CLIENT_SECRET),
                XERO_REDIRECT_URI: Boolean(process.env.XERO_REDIRECT_URI),
                XERO_ENCRYPTION_KEY: Boolean(process.env.XERO_ENCRYPTION_KEY),
                SESSION_SECRET: Boolean(
                  process.env.OAUTH_STATE_SECRET ||
                    process.env.SESSION_SECRET ||
                    process.env.ENCRYPTION_KEY
                ),
              },
              connectionRecordExists: false,
            },
          },
          { status: 503 }
        );
      }
      throw error;
    }

    const diagnostics = await runXeroDiagnostics(organizationId);
    return NextResponse.json({ diagnostics });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    loggers.xero.error('xero_diagnostics_route_failed', error, { step: 'diagnostics_handler' });
    return NextResponse.json(
      {
        error: message,
        code: 'XERO_DIAGNOSTICS_FAILED',
      },
      { status: 500 }
    );
  }
}
