import 'server-only';

import { NextResponse } from 'next/server';
import type { EntitlementFeature } from '@/lib/entitlements/types';
import { FEATURE_DISPLAY_NAMES } from '@/lib/entitlements/feature-labels';
import { upgradeBody, upgradeHeadline } from '@/lib/entitlements/feature-labels';
import {
  resolveEntitlementContext,
  resolveProductProfileFromEmail,
} from '@/lib/entitlements/resolve-context.server';
import { evaluateFeature } from '@/lib/entitlements/workspace-entitlements';

export async function requireEntitlement(input: {
  organizationId: string;
  userId: string;
  userEmail?: string | null;
  feature: EntitlementFeature;
}): Promise<NextResponse | null> {
  const ctx = await resolveEntitlementContext({
    organizationId: input.organizationId,
    userId: input.userId,
    userEmail: input.userEmail,
    productProfile: resolveProductProfileFromEmail(input.userEmail ?? null),
  });

  const decision = evaluateFeature(ctx, input.feature);
  if (decision.allowed) return null;

  const atLimit =
    input.feature === 'create_agreement'
      ? decision.reason === 'active_agreement_limit'
      : input.feature === 'ai_import'
        ? decision.reason === 'ai_import_limit'
        : false;

  const requiredPlan = decision.requiredPlan ?? 'professional';

  return NextResponse.json(
    {
      error: 'feature_gated',
      code: 'ENTITLEMENT_REQUIRED',
      feature: input.feature,
      featureName: FEATURE_DISPLAY_NAMES[input.feature],
      currentPlan: ctx.plan,
      requiredPlan,
      headline: upgradeHeadline(input.feature, atLimit),
      message: upgradeBody(input.feature, requiredPlan, atLimit),
      usage: ctx.usage,
      limit: decision.limit,
      current: decision.current,
    },
    { status: 403 }
  );
}
