import { NextRequest, NextResponse } from 'next/server';
import { submitConversion } from '@/lib/huntpay/core';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { teamId, stopId, challengeId, sponsorId, conversionType, txHash, screenshotUrl, note } = body;

    if (!teamId || !stopId || !challengeId || !sponsorId || !conversionType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await submitConversion({
      teamId,
      stopId,
      challengeId,
      sponsorId,
      conversionType,
      txHash,
      screenshotUrl,
      note,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Submit conversion error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit conversion' },
      { status: 500 }
    );
  }
}
