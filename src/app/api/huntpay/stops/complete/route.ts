import { NextRequest, NextResponse } from 'next/server';
import { completeStop } from '@/lib/huntpay/core';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { teamId, stopId } = body;

    if (!teamId || !stopId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await completeStop(teamId, stopId);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Complete stop error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to complete stop' },
      { status: 500 }
    );
  }
}
