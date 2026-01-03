import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { prisma } from '@/lib/server/prisma'
import { v4 as uuidv4 } from 'uuid'

function getOrganizationId(req: NextRequest) {
  // Prefer query param, fall back to header
  const { searchParams } = new URL(req.url)
  return (
    searchParams.get('organizationId') ||
    searchParams.get('orgId') ||
    req.headers.get('x-organization-id')
  )
}

/**
 * GET /api/notifications/preferences
 * Get notification preferences for the current user within an organization
 *
 * Required:
 * - organizationId (query param) OR x-organization-id header
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

    // Get or create preferences
    let preferences = await prisma.notification_preferences.findUnique({
      where: {
        organization_id_user_email: {
          organization_id: organization.id,
          user_email: user.email,
        },
      },
    })

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
      })
    }

    return NextResponse.json({ preferences })
  } catch (error: any) {
    console.error('[Preferences GET] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 })
  }
}

/**
 * PUT /api/notifications/preferences
 * Update notification preferences for the current user within an organization
 *
 * Required:
 * - organizationId (query param) OR x-organization-id header
 */
export async function PUT(req: NextRequest) {
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

    const body = await req.json()

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
    })

    return NextResponse.json({ preferences })
  } catch (error: any) {
    console.error('[Preferences PUT] Error:', error)
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 })
  }
}
