'use client';

import * as React from 'react';
import type { DashboardProductProfile } from '@/lib/auth/admin-shared';
import type { DealNetworkExperienceMode } from '@/lib/deal-network-demo/deal-network-experience';

type DealNetworkExperienceContextValue = {
  profile: DashboardProductProfile;
  dealNetworkExperienceMode: DealNetworkExperienceMode;
};

const DealNetworkExperienceContext = React.createContext<DealNetworkExperienceContextValue | null>(
  null
);

export function DealNetworkExperienceProvider({
  profile,
  dealNetworkExperienceMode,
  children,
}: {
  profile: DashboardProductProfile;
  dealNetworkExperienceMode: DealNetworkExperienceMode;
  children: React.ReactNode;
}) {
  const value = React.useMemo(
    () => ({ profile, dealNetworkExperienceMode }),
    [profile, dealNetworkExperienceMode]
  );
  return (
    <DealNetworkExperienceContext.Provider value={value}>
      {children}
    </DealNetworkExperienceContext.Provider>
  );
}

export function useDealNetworkExperience(): DealNetworkExperienceContextValue {
  const ctx = React.useContext(DealNetworkExperienceContext);
  if (!ctx) {
    throw new Error('useDealNetworkExperience must be used under DealNetworkExperienceProvider');
  }
  return ctx;
}
