/**
 * Used to verify which build is deployed in production.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  const gitSha = process.env.GIT_SHA ?? process.env.RENDER_GIT_COMMIT ?? 'unknown';
  const buildTime = process.env.BUILD_TIME ?? 'unknown';
  const nodeEnv = process.env.NODE_ENV ?? 'unknown';

  return NextResponse.json({
    gitSha,
    buildTime,
    nodeEnv,
    timestamp: new Date().toISOString(),
  });
}
