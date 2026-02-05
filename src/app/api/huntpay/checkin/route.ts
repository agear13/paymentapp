import { NextRequest, NextResponse } from 'next/server';
import { checkinAtStop } from '@/lib/huntpay/core';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { teamId, stopId, checkinCode } = body;

    if (!teamId || !stopId || !checkinCode) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await checkinAtStop({
      teamId,
      stopId,
      checkinCode,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Check-in error:', error);
    return NextResponse.json(
      { error: error.message || 'Check-in failed' },
      { status: 500 }
    );
  }
}
