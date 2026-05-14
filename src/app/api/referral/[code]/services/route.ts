import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { applyRateLimit } from '@/lib/rate-limit';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const rateLimitResult = await applyRateLimit(_request, 'public');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const { code } = await params;
    const referralCode = code?.trim()?.toUpperCase() || '';
    if (!referralCode) {
      return NextResponse.json({ error: 'Referral code is required' }, { status: 400 });
    }

    const referralLink = await prisma.referral_links.findFirst({
      where: {
        code: referralCode,
        status: 'ACTIVE',
        OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
      },
      select: { organization_id: true },
    });
    if (!referralLink) {
      return NextResponse.json({ error: 'Referral not found' }, { status: 404 });
    }

    const services = await prisma.organization_services.findMany({
      where: { organization_id: referralLink.organization_id, active: true },
      orderBy: { created_at: 'desc' },
      take: 100,
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        currency: true,
      },
    });

    return NextResponse.json({
      data: services.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        price: Number(s.price),
        currency: s.currency,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
