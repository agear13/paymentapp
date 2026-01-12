/**
 * Reset Xero Sync Queue
 * Deletes all failed sync records so they can be requeued
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/server/prisma';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.warn('Unauthorized Xero queue reset attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organizationId } = await request.json();

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Missing organizationId parameter' },
        { status: 400 }
      );
    }

    logger.info({ organizationId, userId: user.id }, 'Resetting Xero sync queue');

    // Delete all failed syncs for this organization
    const result = await prisma.xero_syncs.deleteMany({
      where: {
        organization_id: organizationId,
        status: 'FAILED',
      },
    });

    logger.info(
      { organizationId, deletedCount: result.count },
      'Deleted failed Xero syncs'
    );

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      message: `Deleted ${result.count} failed sync records`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, 'Error resetting Xero queue');
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Xero queue reset endpoint',
    usage: 'POST with { organizationId: string } in body',
  });
}

