import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { getNotifications, getUnreadNotifications } from '@/lib/notifications/service';

/**
 * GET /api/notifications
 * 
 * Get notifications for the current user/organization
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

    // Get organization
    const organization = await prisma.organizations.findUnique({
      where: { clerk_org_id: orgId },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');

    let notifications;
    if (unreadOnly) {
      notifications = await getUnreadNotifications(organization.id, user.email);
    } else {
      notifications = await getNotifications(organization.id, user.email, limit);
    }

    return NextResponse.json({ notifications });
  } catch (error: any) {
    console.error('[Notifications API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}







