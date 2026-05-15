/**
 * Operator view: all referral_codes + referral_links for the org (read-only surfacing).
 * GET /api/organization-referrals?organizationId=...
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { requireAuth } from '@/lib/supabase/middleware';
import { checkUserPermission } from '@/lib/auth/permissions';
import { applyRateLimit } from '@/lib/rate-limit';
import {
  buildReferralQrUrl,
  buildReferralShareUrl,
  resolveReferralSlug,
} from '@/lib/referrals/referral-share-url';
import { serviceCreatedAtIso } from '@/lib/format/organization-service-timestamps';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const auth = await requireAuth(request);
    if (!auth.user) return auth.response!;

    const organizationId = request.nextUrl.searchParams.get('organizationId');
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    const canView = await checkUserPermission(auth.user.id, organizationId, 'view_payment_links');
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin).replace(/\/$/, '');

    const rows = await prisma.referral_codes.findMany({
      where: { organization_id: organizationId },
      orderBy: { created_at: 'desc' },
      take: 200,
      include: {
        referral_links: {
          select: {
            id: true,
            code: true,
            status: true,
            slug: true,
            created_by_user_id: true,
            created_at: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: rows.map((rc) => {
        const link = rc.referral_links;
        const code = rc.code.trim().toUpperCase();
        const slug = resolveReferralSlug({
          code,
          slug: rc.slug,
          referralLinkSlug: link.slug,
        });
        const shareSource = {
          code,
          slug: rc.slug,
          referralLinkSlug: link.slug,
        };
        const createdAt =
          serviceCreatedAtIso(rc.created_at) ??
          serviceCreatedAtIso(link.created_at) ??
          new Date(0).toISOString();

        return {
          id: rc.id,
          referralLinkId: link.id,
          code,
          slug,
          vanityPath: slug ? `/ref/${slug}` : null,
          referralUrl: buildReferralShareUrl(baseUrl, shareSource),
          qrUrl: buildReferralQrUrl(baseUrl, code),
          status: rc.status,
          linkStatus: link.status,
          participantUserId: rc.participant_user_id,
          participantLabel: rc.participant_user_id
            ? `User …${rc.participant_user_id.slice(-8)}`
            : 'Unassigned participant',
          createdAt,
          expiresAt: rc.expires_at?.toISOString() ?? null,
        };
      }),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
