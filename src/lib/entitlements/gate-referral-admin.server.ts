import 'server-only';

import type { NextResponse } from 'next/server';
import { requireEntitlement } from '@/lib/entitlements/gate-api.server';

/** Operator-facing referral program management (Professional+). */
export async function requireReferralManagementEntitlement(input: {
  organizationId: string;
  userId: string;
  userEmail?: string | null;
}): Promise<NextResponse | null> {
  return requireEntitlement({
    organizationId: input.organizationId,
    userId: input.userId,
    userEmail: input.userEmail,
    feature: 'referral_management',
  });
}
