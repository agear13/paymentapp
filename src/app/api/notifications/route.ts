import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { prisma } from '@/lib/server/prisma'
import { getNotifications, getUnreadNotifications } from '@/lib/notifications/service'

function getOrganizationId(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  return (
    searchParams.get('organizationId') ||
    searchParams.get('orgId') ||
    req.headers.get('x-organization-id')
  )
}

/**
 * GET /api/notifications
 * Get notifications for the current user within an organization
 *
 * Required:
 * - organizationId (query param) OR x-organization-id header
 *
 * Optional:
 * - unreadOnly=true
 * - limit=50
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = getOrganizationId(req)
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
    }

    const organization = await prisma.organizations.findUnique({
      where: { id: organizationId },
      select: { id: true },
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const unreadOnly = searchParams.get('unreadOnly') === 'true'
    const limit = Number.parseInt(searchParams.get('limit') || '50', 10)

    const notifications = unreadOnly
      ? await getUnreadNotifications(organization.id, user.email)
      : await getNotifications(organization.id, user.email, Number.isFinite(limit) ? limit : 50)

    return NextResponse.json({ notifications })
  } catch (error: any) {
    console.error('[Notifications API] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
  }
}
