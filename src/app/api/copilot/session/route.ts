import { NextResponse } from 'next/server';
import { getDashboardProductProfile } from '@/lib/auth/dashboard-product.server';

/**
 * GET /api/copilot/session
 * Returns dashboard product profile for scoped UI (Deal Network Copilot, etc.).
 */
export async function GET() {
  const profile = await getDashboardProductProfile();
  return NextResponse.json({ profile });
}
