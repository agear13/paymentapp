'use client';

/**
 * Developer Simulator Store
 *
 * Persists developer overrides in localStorage and broadcasts changes to all
 * active Commercial Brain instances via a custom window event.
 *
 * Architecture:
 *
 *   DevControlCentre page → writes to localStorage → dispatches UPDATE_EVENT
 *   CommercialBrainProvider (any project page) → reads localStorage on mount
 *     → subscribes to UPDATE_EVENT → merges capability overrides into output
 *
 * This means the developer page and any open project page stay in sync
 * instantly, without a React provider hierarchy change.
 *
 * PRODUCTION SAFETY:
 *   - All hook logic runs inside a useEffect (no SSR issues)
 *   - Zero-cost in production: the hook returns null immediately when
 *     NEXT_PUBLIC_DEV_TOOLS !== 'true' and NODE_ENV !== 'development'
 *   - The Commercial Brain only reads overrides in dev/tools-enabled builds
 */

import * as React from 'react';
import type { DevSimulatorState } from '@/lib/dev/simulator-types';
import { EMPTY_SIMULATOR_STATE } from '@/lib/dev/simulator-types';

/* ─── Storage constants ─────────────────────────────────────────────────────── */

export const SIMULATOR_STORAGE_KEY = 'provvypay_dev_simulator';
export const SIMULATOR_UPDATE_EVENT = 'provvypay:dev:simulator:update';

/* ─── Is dev tools enabled? ─────────────────────────────────────────────────── */

export function isDevToolsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    process.env.NODE_ENV === 'development' ||
    process.env.NEXT_PUBLIC_DEV_TOOLS === 'true'
  );
}

/* ─── Raw read/write ────────────────────────────────────────────────────────── */

export function readSimulatorState(): DevSimulatorState | null {
  if (!isDevToolsEnabled()) return null;
  try {
    const raw = localStorage.getItem(SIMULATOR_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DevSimulatorState) : null;
  } catch {
    return null;
  }
}

export function writeSimulatorState(state: DevSimulatorState | null): void {
  if (!isDevToolsEnabled()) return;
  try {
    if (state === null) {
      localStorage.removeItem(SIMULATOR_STORAGE_KEY);
    } else {
      localStorage.setItem(SIMULATOR_STORAGE_KEY, JSON.stringify(state));
    }
    window.dispatchEvent(new CustomEvent(SIMULATOR_UPDATE_EVENT));
  } catch {
    // Storage quota or private browsing — fail silently
  }
}

/* ─── Read-only hook (used by CommercialBrainProvider) ──────────────────────── */

/**
 * Subscribe to simulator state changes.
 * Returns null in production or SSR. Safe to call from any component.
 */
export function useSimulatorState(): DevSimulatorState | null {
  const [state, setState] = React.useState<DevSimulatorState | null>(null);

  React.useEffect(() => {
    if (!isDevToolsEnabled()) return;

    // Hydrate on mount
    setState(readSimulatorState());

    const handler = () => setState(readSimulatorState());
    window.addEventListener(SIMULATOR_UPDATE_EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(SIMULATOR_UPDATE_EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  return state;
}

/* ─── Full read/write hook (used by DevControlCentre page) ──────────────────── */

export type UseDevSimulatorReturn = {
  state: DevSimulatorState;
  setState: (s: DevSimulatorState) => void;
  patchCapabilities: (caps: Partial<DevSimulatorState['capabilities']>) => void;
  patchPaymentProvider: (pp: Partial<NonNullable<DevSimulatorState['paymentProvider']>>) => void;
  patchRevenue: (rev: Partial<NonNullable<DevSimulatorState['revenue']>>) => void;
  loadScenario: (scenario: DevSimulatorState) => void;
  reset: () => void;
  addAuditEntry: (eventType: DevSimulatorState['auditEntries'][number]['eventType']) => void;
};

export function useDevSimulator(): UseDevSimulatorReturn {
  const [state, setStateLocal] = React.useState<DevSimulatorState>(EMPTY_SIMULATOR_STATE);

  React.useEffect(() => {
    setState(readSimulatorState() ?? EMPTY_SIMULATOR_STATE);

    const handler = () => setStateLocal(readSimulatorState() ?? EMPTY_SIMULATOR_STATE);
    window.addEventListener(SIMULATOR_UPDATE_EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(SIMULATOR_UPDATE_EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  function setState(next: DevSimulatorState) {
    writeSimulatorState(next);
    setStateLocal(next);
  }

  function patchCapabilities(caps: Partial<DevSimulatorState['capabilities']>) {
    setState({
      ...state,
      capabilities: { ...state.capabilities, ...caps },
      activeScenario: null,
    });
  }

  function patchPaymentProvider(pp: Partial<NonNullable<DevSimulatorState['paymentProvider']>>) {
    const base = state.paymentProvider ?? {
      connected: false,
      chargesEnabled: false,
      payoutsEnabled: false,
      restricted: false,
    };
    setState({
      ...state,
      paymentProvider: { ...base, ...pp },
      // Cascade into capabilities
      capabilities: {
        ...state.capabilities,
        paymentProviderConnected: pp.connected ?? base.connected,
        revenueCollectionEnabled:
          (pp.chargesEnabled ?? base.chargesEnabled) &&
          (pp.payoutsEnabled ?? base.payoutsEnabled) &&
          !(pp.restricted ?? base.restricted),
      },
      activeScenario: null,
    });
  }

  function patchRevenue(rev: Partial<NonNullable<DevSimulatorState['revenue']>>) {
    const base = state.revenue ?? {
      collectedRevenue: 0,
      readyToRelease: 0,
      outstanding: 0,
      held: 0,
    };
    const next = { ...base, ...rev };
    setState({
      ...state,
      revenue: next,
      capabilities: {
        ...state.capabilities,
        revenueFlowing: next.collectedRevenue > 0,
        settlementReady: next.readyToRelease > 0,
      },
      activeScenario: null,
    });
  }

  function loadScenario(scenario: DevSimulatorState) {
    setState(scenario);
  }

  function reset() {
    writeSimulatorState(null);
    setStateLocal(EMPTY_SIMULATOR_STATE);
  }

  function addAuditEntry(
    eventType: DevSimulatorState['auditEntries'][number]['eventType']
  ) {
    const labels: Record<typeof eventType, string> = {
      approval_generated: 'Approval generated',
      stripe_connected: 'Stripe connected',
      revenue_received: 'Revenue received',
      settlement_released: 'Settlement released',
      agreement_created: 'Project created',
      participant_added: 'Participant added',
      payment_received: 'Payment received',
    };
    const entry = {
      id: `dev-${Date.now()}`,
      eventType,
      label: labels[eventType],
      timestamp: new Date().toISOString(),
    };
    setState({
      ...state,
      auditEntries: [entry, ...state.auditEntries],
      activeScenario: null,
    });
  }

  return {
    state,
    setState,
    patchCapabilities,
    patchPaymentProvider,
    patchRevenue,
    loadScenario,
    reset,
    addAuditEntry,
  };
}
