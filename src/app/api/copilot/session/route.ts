import { NextResponse } from 'next/server';
import { getDashboardProductProfile } from '@/lib/auth/dashboard-product.server';
import { dealNetworkExperienceFromProductProfile } from '@/lib/deal-network-demo/deal-network-experience';

/**
 * GET /api/copilot/session
 * Returns dashboard product profile for scoped UI (Deal Network Copilot, etc.).
 */
export async function GET() {
  const profile = await getDashboardProductProfile();
  const dealNetworkExperienceMode = dealNetworkExperienceFromProductProfile(profile);
  return NextResponse.json({ profile, dealNetworkExperienceMode });
}
