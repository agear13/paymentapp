/**
 * Xero OAuth Initiation Endpoint
 * Generates authorization URL and redirects user to Xero
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateAuthUrl } from '@/lib/xero';
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

    // TODO: Verify user has permission to connect Xero for this organization

    // Generate authorization URL
    const authUrl = generateAuthUrl();

    // Store organization_id in state parameter for callback
    const stateParam = Buffer.from(
      JSON.stringify({
        organizationId,
        userId: user.id,
      })
    ).toString('base64');

    const authUrlWithState = `${authUrl}&state=${stateParam}`;

    logger.info('Xero OAuth flow initiated', {
      organizationId,
      userId: user.id,
    });

    // Redirect to Xero authorization page
    return NextResponse.redirect(authUrlWithState);
  } catch (error) {
    logger.error('Error initiating Xero OAuth flow', { error });
    return NextResponse.json(
      { error: 'Failed to initiate Xero connection' },
      { status: 500 }
    );
  }
}






