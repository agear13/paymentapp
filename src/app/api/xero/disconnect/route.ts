/**
 * Xero Disconnect Endpoint
 * Revokes and removes Xero connection
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { disconnectXero } from '@/lib/xero';
import { logger } from '@/lib/logger';

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

    // Get organization from request body
    const body = await request.json();
    const { organizationId } = body;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Missing organizationId' },
        { status: 400 }
      );
    }

    // TODO: Verify user has permission to disconnect Xero for this organization

    // Disconnect Xero
    await disconnectXero(organizationId);

    logger.info('Xero connection disconnected', {
      organizationId,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      message: 'Xero connection disconnected successfully',
    });
  } catch (error) {
    logger.error('Error disconnecting Xero', { error });
    return NextResponse.json(
      { error: 'Failed to disconnect Xero' },
      { status: 500 }
    );
  }
}






