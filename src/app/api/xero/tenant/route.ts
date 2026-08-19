/**
 * Xero Tenant Selection Endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePaymentConfigurationAccess } from '@/lib/auth/step-up.server';
import { updateSelectedTenant } from '@/lib/xero';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId } = body;

    const access = await requirePaymentConfigurationAccess(request, body.organizationId);
    if (!access.ok) return access.response;
    const user = access.user;
    const organizationId = access.organizationId;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing tenantId' },
        { status: 400 }
      );
    }

    await updateSelectedTenant(organizationId, tenantId);

    logger.info('Xero tenant updated', {
      organizationId,
      tenantId,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      message: 'Xero tenant updated successfully',
    });
  } catch (error) {
    logger.error('Error updating Xero tenant', { error });
    return NextResponse.json(
      { error: 'Failed to update tenant' },
      { status: 500 }
    );
  }
}
