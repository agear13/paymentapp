/**
 * Used to verify which build is deployed in production.
 */

import { NextResponse } from 'next/server';
import { GIT_SHA, BUILD_TIME } from '@/generated/build-info';

export async function GET() {
  const nodeEnv = process.env.NODE_ENV ?? 'unknown';

  return NextResponse.json({
    gitSha: GIT_SHA,
    buildTime: BUILD_TIME,
    nodeEnv,
    timestamp: new Date().toISOString(),
  });
}
