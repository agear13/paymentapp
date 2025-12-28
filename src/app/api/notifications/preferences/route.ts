import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

/**
 * GET /api/notifications/preferences
 * 
 * Get notification preferences for the current user
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = await auth();
    if (!orgId) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    const organization = await prisma.organizations.findUnique({
      where: { clerk_org_id: orgId },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get or create preferences
    let preferences = await prisma.notification_preferences.findUnique({
      where: {
        organization_id_user_email: {
          organization_id: organization.id,
          user_email: user.email,
        },
      },
    });

    // Create default preferences if not exists
    if (!preferences) {
      preferences = await prisma.notification_preferences.create({
        data: {
          id: uuidv4(),
          organization_id: organization.id,
          user_email: user.email,
          payment_confirmed_email: true,
          payment_failed_email: true,
          xero_sync_failed_email: true,
          reconciliation_issue_email: true,
          weekly_summary_email: true,
          security_alert_email: true,
          payment_confirmed_inapp: true,
          payment_failed_inapp: true,
          xero_sync_failed_inapp: true,
        },
      });
    }

    return NextResponse.json({ preferences });
  } catch (error: any) {
    console.error('[Preferences GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/notifications/preferences
 * 
 * Update notification preferences
 */
export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId } = await auth();
    if (!orgId) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    const organization = await prisma.organizations.findUnique({
      where: { clerk_org_id: orgId },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const body = await req.json();

    // Update preferences
    const preferences = await prisma.notification_preferences.upsert({
      where: {
        organization_id_user_email: {
          organization_id: organization.id,
          user_email: user.email,
        },
      },
      create: {
        id: uuidv4(),
        organization_id: organization.id,
        user_email: user.email,
        ...body,
      },
      update: body,
    });

    return NextResponse.json({ preferences });
  } catch (error: any) {
    console.error('[Preferences PUT] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}







