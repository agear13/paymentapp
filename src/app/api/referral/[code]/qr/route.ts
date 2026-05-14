import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { prisma } from '@/lib/server/prisma';
import { applyRateLimit } from '@/lib/rate-limit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'public');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const { code } = await params;
    const referralCode = code?.trim()?.toUpperCase() || '';
    if (!referralCode) {
      return NextResponse.json({ error: 'Referral code is required' }, { status: 400 });
    }

    const exists = await prisma.referral_links.findFirst({
      where: {
        code: referralCode,
        status: 'ACTIVE',
        OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
      },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json({ error: 'Referral not found' }, { status: 404 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const url = `${baseUrl.replace(/\/$/, '')}/r/${referralCode}`;
    const png = await QRCode.toBuffer(url, { type: 'png', width: 280, margin: 2 });

    return new NextResponse(png, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
