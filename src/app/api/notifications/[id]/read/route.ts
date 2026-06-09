import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { markNotificationAsRead } from '@/lib/notifications/service';

/**
 * POST /api/notifications/[id]/read
 * 
 * Mark a notification as read
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getCurrentUserForApi(req);
    if (!auth.user) return auth.response!;
    const user = auth.user;

    const notificationId = params.id;

    const notification = await markNotificationAsRead(notificationId, user.id, user.email);

    return NextResponse.json({ notification });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to mark notification as read';
    if (message === 'Notification not found') {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message === 'Forbidden') {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error('[Mark Read API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to mark notification as read' },
      { status: 500 }
    );
  }
}







