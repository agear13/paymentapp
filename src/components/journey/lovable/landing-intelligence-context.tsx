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
import { DEFAULT_LANDING_SEARCH, type LandingCountryCode } from '@/lib/journey/landing-route-model';
import type {
  PaymentIntelligenceSearchHint,
  PaymentWatchScope,
} from '@/lib/journey/payment-intelligence-types';

type CompareHandler = ((hint?: PaymentIntelligenceSearchHint | null) => void) | null;

type LandingIntelligenceApi = {
  origin: LandingCountryCode;
  destination: LandingCountryCode;
  scope: PaymentWatchScope;
  highlightedId: string | null;
  setCorridor: (next: { origin: LandingCountryCode; destination: LandingCountryCode }) => void;
  setScope: (scope: PaymentWatchScope) => void;
  setHighlightedId: (id: string) => void;
  requestCompare: (hint?: PaymentIntelligenceSearchHint | null) => void;
  registerCompare: (handler: CompareHandler) => void;
};

const LandingIntelligenceContext = createContext<LandingIntelligenceApi | null>(null);

export function LandingIntelligenceProvider({ children }: { children: ReactNode }) {
  const [origin, setOrigin] = useState<LandingCountryCode>(DEFAULT_LANDING_SEARCH.originCountry);
  const [destination, setDestination] = useState<LandingCountryCode>(
    DEFAULT_LANDING_SEARCH.destinationCountry
  );
  const [scope, setScope] = useState<PaymentWatchScope>('all');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const compareHandler = useRef<CompareHandler>(null);

  const setCorridor = useCallback(
    (next: { origin: LandingCountryCode; destination: LandingCountryCode }) => {
      setOrigin((current) => (current === next.origin ? current : next.origin));
      setDestination((current) => (current === next.destination ? current : next.destination));
    },
    []
  );

  const requestCompare = useCallback((hint?: PaymentIntelligenceSearchHint | null) => {
    compareHandler.current?.(hint);
  }, []);

  const registerCompare = useCallback((handler: CompareHandler) => {
    compareHandler.current = handler;
  }, []);

  const value = useMemo(
    () => ({
      origin,
      destination,
      scope,
      highlightedId,
      setCorridor,
      setScope,
      setHighlightedId,
      requestCompare,
      registerCompare,
    }),
    [origin, destination, scope, highlightedId, setCorridor, requestCompare, registerCompare]
  );

  return (
    <LandingIntelligenceContext.Provider value={value}>{children}</LandingIntelligenceContext.Provider>
  );
}

export function useLandingIntelligence(): LandingIntelligenceApi {
  const value = useContext(LandingIntelligenceContext);
  if (!value) {
    throw new Error('useLandingIntelligence must be used within LandingIntelligenceProvider');
  }
  return value;
}

export function useOptionalLandingIntelligence(): LandingIntelligenceApi | null {
  return useContext(LandingIntelligenceContext);
}
