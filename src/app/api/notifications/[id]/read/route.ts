import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
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
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const notificationId = params.id;

    const notification = await markNotificationAsRead(notificationId);

    return NextResponse.json({ notification });
  } catch (error: any) {
    console.error('[Mark Read API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to mark notification as read' },
      { status: 500 }
    );
  }
}







