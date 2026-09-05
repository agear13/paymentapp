'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  EMPTY_ADVISOR_CONTEXT,
  type AdvisorContext,
} from '@/lib/journey/landing-advisor';
import type { LandingResultFilters } from '@/lib/journey/landing-result-labels';
import type { LandingPriorityId } from '@/lib/journey/landing-route-model';

type PriorityHandler = ((priority: LandingPriorityId) => void) | null;
type FilterHandler = ((filters: LandingResultFilters) => void) | null;

type LandingAdvisorApi = {
  context: AdvisorContext;
  update: (patch: Partial<AdvisorContext>) => void;
  replace: (next: AdvisorContext) => void;
  changePriority: (priority: LandingPriorityId) => void;
  registerPriorityChange: (handler: PriorityHandler) => void;
  applyFilters: (filters: LandingResultFilters) => void;
  registerFilterChange: (handler: FilterHandler) => void;
};

const LandingAdvisorContext = createContext<LandingAdvisorApi | null>(null);

function sameAdvisorContext(left: AdvisorContext, right: AdvisorContext): boolean {
  return (Object.keys(left) as (keyof AdvisorContext)[]).every((key) => left[key] === right[key]);
}

export function LandingAdvisorProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<AdvisorContext>(EMPTY_ADVISOR_CONTEXT);
  const priorityHandler = useRef<PriorityHandler>(null);
  const filterHandler = useRef<FilterHandler>(null);

  const update = useCallback((patch: Partial<AdvisorContext>) => {
    setContext((current) => {
      const next = { ...current, ...patch };
      return sameAdvisorContext(current, next) ? current : next;
    });
  }, []);

  const replace = useCallback((next: AdvisorContext) => {
    setContext(next);
  }, []);

  const changePriority = useCallback((priority: LandingPriorityId) => {
    priorityHandler.current?.(priority);
  }, []);

  const registerPriorityChange = useCallback((handler: PriorityHandler) => {
    priorityHandler.current = handler;
  }, []);

  const applyFilters = useCallback((filters: LandingResultFilters) => {
    filterHandler.current?.(filters);
  }, []);

  const registerFilterChange = useCallback((handler: FilterHandler) => {
    filterHandler.current = handler;
  }, []);

  const value = useMemo(
    () => ({
      context,
      update,
      replace,
      changePriority,
      registerPriorityChange,
      applyFilters,
      registerFilterChange,
    }),
    [context, update, replace, changePriority, registerPriorityChange, applyFilters, registerFilterChange]
  );

  return <LandingAdvisorContext.Provider value={value}>{children}</LandingAdvisorContext.Provider>;
}

export function useLandingAdvisor(): LandingAdvisorApi {
  const value = useContext(LandingAdvisorContext);
  if (!value) {
    throw new Error('useLandingAdvisor must be used within LandingAdvisorProvider');
  }
  return value;
}

export function useOptionalLandingAdvisor(): LandingAdvisorApi | null {
  return useContext(LandingAdvisorContext);
}
