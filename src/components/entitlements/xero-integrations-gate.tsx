'use client';

import type { ReactNode } from 'react';
import { FeatureGate } from '@/components/entitlements/feature-gate';

export function XeroIntegrationsGate({ children }: { children: ReactNode }) {
  return (
    <FeatureGate feature="xero_integration" mode="block">
      {children}
    </FeatureGate>
  );
}
