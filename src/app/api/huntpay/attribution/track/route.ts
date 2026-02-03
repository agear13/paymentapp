import { NextRequest, NextResponse } from 'next/server';
import { trackAttribution } from '@/lib/huntpay/core';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { teamId, stopId, challengeId, sponsorId, referralUrl } = body;

    if (!teamId || !stopId || !challengeId || !sponsorId || !referralUrl) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const userAgent = request.headers.get('user-agent') || undefined;
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || undefined;

    const result = await trackAttribution({
      teamId,
      stopId,
      challengeId,
      sponsorId,
      referralUrl,
      userAgent,
      ipAddress,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Track attribution error:', error);
    // Non-fatal: return success even if tracking fails
    return NextResponse.json({ success: true });
  }
}
