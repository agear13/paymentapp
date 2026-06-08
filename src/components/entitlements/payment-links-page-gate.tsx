'use client';

import * as React from 'react';
import { FeatureGate } from '@/components/entitlements/feature-gate';

export function PaymentLinksPageGate({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate feature="payment_links" mode="block">
      {children}
    </FeatureGate>
  );
}
