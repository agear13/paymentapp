'use client';

import * as React from 'react';
import type { OperationalCoordinationStateOptions } from '@/hooks/use-operational-coordination-state';

export type OperationalCoordinationContextValue = ReturnType<
  typeof import('@/hooks/use-operational-coordination-state').useOperationalCoordinationStateCore
>;

export const OperationalCoordinationContext =
  React.createContext<OperationalCoordinationContextValue | null>(null);

export function useOperationalCoordinationContext(): OperationalCoordinationContextValue | null {
  return React.useContext(OperationalCoordinationContext);
}

/** Project-scoped overrides require an independent coordination instance. */
export function requiresLocalOperationalInstance(
  options?: OperationalCoordinationStateOptions
): boolean {
  return Boolean(
    options?.project ||
    (options?.participants?.length ?? 0) > 0 ||
    options?.treasury ||
    options?.requireConvergence
  );
}
