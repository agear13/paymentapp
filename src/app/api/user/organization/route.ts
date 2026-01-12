import { NextRequest, NextResponse } from 'next/server';
import { getUserOrganization } from '@/lib/auth/get-org';
import { getCurrentUser } from '@/lib/auth/session';

/**
 * GET /api/user/organization
 * Get the current user's organization
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const organization = await getUserOrganization();

    if (!organization) {
      return NextResponse.json(
        { error: 'No organization found for user' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      organizationId: organization.id,
      name: organization.name,
      clerkOrgId: organization.clerk_org_id,
    });
  } catch (error: any) {
    console.error('Error fetching user organization:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organization' },
      { status: 500 }
    );
  }
}

