import { NextResponse } from 'next/server';

import { BUILD_ID, BUILD_TIME, GIT_SHA } from '@/generated/build-info';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return NextResponse.json(
    {
      buildId: BUILD_ID,
      gitSha: GIT_SHA,
      buildTime: BUILD_TIME,
    },
    {
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
      },
    }
  );
}
