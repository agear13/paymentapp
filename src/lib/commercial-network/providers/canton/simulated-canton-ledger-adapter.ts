/**
 * Simulated Canton ledger adapter — wraps CantonLedgerRuntime.
 *
 * Use for unit tests and local development without LocalNet.
 * Demo / production LocalNet mode must use LocalNetJsonApiAdapter.
 */

import type { CommercialNetworkEventDispatcher } from '@/lib/commercial-network/event-dispatcher';
import {
  createCantonLedgerRuntime,
  type CantonLedgerRuntime,
} from '@/lib/commercial-network/providers/canton/canton-ledger-runtime';
import type {
  CantonLedgerAdapter,
  CantonLedgerEventHandler,
} from '@/lib/commercial-network/providers/canton/canton-ledger-adapter';

export function createSimulatedCantonLedgerAdapter(options?: {
  runtime?: CantonLedgerRuntime;
  dispatcher?: CommercialNetworkEventDispatcher;
  now?: () => string;
}): CantonLedgerAdapter {
  const runtime =
    options?.runtime ??
    createCantonLedgerRuntime({
      dispatcher: options?.dispatcher,
      now: options?.now,
    });

  return {
    mode: 'simulated',

    async validateConnection() {
      return { connected: true, error: null };
    },

    async createProposal(input) {
      const created = runtime.createProposal(input);
      return { proposalContractId: created.contractId };
    },

    async accept(input) {
      return runtime.accept(input);
    },

    async reject(input) {
      runtime.reject(input);
    },

    async withdraw(input) {
      runtime.withdraw(input);
    },

    async declareSettlementReady(input) {
      const ready = runtime.declareSettlementReady(input);
      return { settlementReadyContractId: ready.contractId };
    },

    async getActiveProposal(id) {
      return runtime.getActiveProposal(id);
    },

    async getActiveAgreement(id) {
      return runtime.getActiveAgreement(id);
    },

    async getSettlementReady(id) {
      return runtime.getSettlementReady(id);
    },

    async project(id) {
      return runtime.project(id);
    },

    subscribe(handler: CantonLedgerEventHandler) {
      // Runtime already dispatches via shared dispatcher when configured.
      // Extra subscribe is a no-op passthrough for interface symmetry.
      if (options?.dispatcher) {
        return options.dispatcher.subscribe(handler);
      }
      return () => undefined;
    },

    getSimulatedRuntime() {
      return runtime;
    },

    hydrateAgreement(state) {
      runtime.hydrateAgreement(state);
    },
  };
}
