'use client';

import type { EntitlementFeature } from '@/lib/entitlements/types';
import { FeatureGate } from '@/components/entitlements/feature-gate';

type EntitlementPageShellProps = {
  feature: EntitlementFeature;
  children: React.ReactNode;
};

/** Full-page entitlement gate — does not affect shared business logic. */
export function EntitlementPageShell({ feature, children }: EntitlementPageShellProps) {
  return (
    <FeatureGate feature={feature} mode="block">
      {children}
    </FeatureGate>
  );
}
