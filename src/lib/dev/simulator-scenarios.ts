/**
 * Developer Simulator — Built-in Scenario Presets
 *
 * One click loads an entire Commercial OS state, including:
 * capabilities, payment provider, revenue, workflow stage, and plan.
 *
 * These are the canonical test configurations for the entire Commercial OS.
 * Every QA session, demo, and regression run should start from a named scenario.
 */

import type { DevSimulatorState } from './simulator-types';
import { EMPTY_SIMULATOR_STATE } from './simulator-types';

export type ScenarioDefinition = {
  id: string;
  label: string;
  description: string;
  icon: string;
  state: DevSimulatorState;
};

/* ─── Scenarios ─────────────────────────────────────────────────────────────── */

export const SIMULATOR_SCENARIOS: ScenarioDefinition[] = [
  {
    id: 'empty-workspace',
    label: 'Empty Workspace',
    description: 'Brand new operator. No agreement, no participants, no plan configuration.',
    icon: '📋',
    state: {
      ...EMPTY_SIMULATOR_STATE,
      capabilities: {
        participantsInvited: false,
        earningsConfigured: false,
        approvalsComplete: false,
        paymentProviderConnected: false,
        revenueCollectionEnabled: false,
        revenueFlowing: false,
        settlementReady: false,
        payoutComplete: false,
      },
      plan: 'starter',
      activeScenario: 'Empty Workspace',
    },
  },
  {
    id: 'new-hospitality-operator',
    label: 'New Hospitality Operator',
    description:
      'Operator has created an agreement and added participants but not configured earnings.',
    icon: '🏨',
    state: {
      ...EMPTY_SIMULATOR_STATE,
      capabilities: {
        participantsInvited: true,
        earningsConfigured: false,
        approvalsComplete: false,
        paymentProviderConnected: false,
        revenueCollectionEnabled: false,
        revenueFlowing: false,
        settlementReady: false,
        payoutComplete: false,
      },
      plan: 'professional',
      activeScenario: 'New Hospitality Operator',
    },
  },
  {
    id: 'event-ready-for-promotion',
    label: 'Event Ready for Promotion',
    description:
      'Participants added and earnings configured. Ready to collect approvals.',
    icon: '🎫',
    state: {
      ...EMPTY_SIMULATOR_STATE,
      capabilities: {
        participantsInvited: true,
        earningsConfigured: true,
        approvalsComplete: false,
        paymentProviderConnected: false,
        revenueCollectionEnabled: false,
        revenueFlowing: false,
        settlementReady: false,
        payoutComplete: false,
      },
      plan: 'professional',
      workflowStagePin: 'collecting-approvals',
      activeScenario: 'Event Ready for Promotion',
    },
  },
  {
    id: 'waiting-on-approvals',
    label: 'Waiting On Approvals',
    description:
      'Agreements sent. Operator is waiting for participant sign-offs before connecting payments.',
    icon: '⏳',
    state: {
      ...EMPTY_SIMULATOR_STATE,
      capabilities: {
        participantsInvited: true,
        earningsConfigured: true,
        approvalsComplete: false,
        paymentProviderConnected: false,
        revenueCollectionEnabled: false,
        revenueFlowing: false,
        settlementReady: false,
        payoutComplete: false,
      },
      plan: 'professional',
      workflowStagePin: 'collecting-approvals',
      activeScenario: 'Waiting On Approvals',
    },
  },
  {
    id: 'payment-provider-missing',
    label: 'Payment Provider Missing',
    description:
      'All approvals collected but no payment provider connected. Agreement is approval-complete, not payment-ready.',
    icon: '💳',
    state: {
      ...EMPTY_SIMULATOR_STATE,
      capabilities: {
        participantsInvited: true,
        earningsConfigured: true,
        approvalsComplete: true,
        paymentProviderConnected: false,
        revenueCollectionEnabled: false,
        revenueFlowing: false,
        settlementReady: false,
        payoutComplete: false,
      },
      plan: 'professional',
      workflowStagePin: 'preparing-payments',
      activeScenario: 'Payment Provider Missing',
    },
  },
  {
    id: 'revenue-flowing',
    label: 'Revenue Flowing',
    description:
      'Payment provider connected and charges enabled. Revenue is coming in.',
    icon: '💰',
    state: {
      ...EMPTY_SIMULATOR_STATE,
      capabilities: {
        participantsInvited: true,
        earningsConfigured: true,
        approvalsComplete: true,
        paymentProviderConnected: true,
        revenueCollectionEnabled: true,
        revenueFlowing: true,
        settlementReady: false,
        payoutComplete: false,
      },
      plan: 'growth',
      paymentProvider: {
        connected: true,
        chargesEnabled: true,
        payoutsEnabled: true,
        restricted: false,
      },
      revenue: {
        collectedRevenue: 12_500,
        readyToRelease: 0,
        outstanding: 4_200,
        held: 0,
      },
      workflowStagePin: 'collecting-revenue',
      activeScenario: 'Revenue Flowing',
    },
  },
  {
    id: 'settlement-ready',
    label: 'Settlement Ready',
    description:
      'Revenue collected. Funds are ready to release to participants.',
    icon: '🏦',
    state: {
      ...EMPTY_SIMULATOR_STATE,
      capabilities: {
        participantsInvited: true,
        earningsConfigured: true,
        approvalsComplete: true,
        paymentProviderConnected: true,
        revenueCollectionEnabled: true,
        revenueFlowing: true,
        settlementReady: true,
        payoutComplete: false,
      },
      plan: 'growth',
      paymentProvider: {
        connected: true,
        chargesEnabled: true,
        payoutsEnabled: true,
        restricted: false,
      },
      revenue: {
        collectedRevenue: 45_000,
        readyToRelease: 8_750,
        outstanding: 0,
        held: 0,
      },
      workflowStagePin: 'ready-to-release',
      activeScenario: 'Settlement Ready',
    },
  },
  {
    id: 'operational-business',
    label: 'Operational Business',
    description:
      'Full Commercial OS active. Revenue flowing, payouts completed, fully operational.',
    icon: '🚀',
    state: {
      ...EMPTY_SIMULATOR_STATE,
      capabilities: {
        participantsInvited: true,
        earningsConfigured: true,
        approvalsComplete: true,
        paymentProviderConnected: true,
        revenueCollectionEnabled: true,
        revenueFlowing: true,
        settlementReady: false,
        payoutComplete: true,
      },
      plan: 'enterprise',
      paymentProvider: {
        connected: true,
        chargesEnabled: true,
        payoutsEnabled: true,
        restricted: false,
      },
      revenue: {
        collectedRevenue: 128_400,
        readyToRelease: 0,
        outstanding: 0,
        held: 0,
      },
      workflowStagePin: 'operational',
      activeScenario: 'Operational Business',
    },
  },
  {
    id: 'release-day',
    label: 'Release Day',
    description:
      'Large event concluded. Significant revenue ready to release. Final payout day.',
    icon: '🎉',
    state: {
      ...EMPTY_SIMULATOR_STATE,
      capabilities: {
        participantsInvited: true,
        earningsConfigured: true,
        approvalsComplete: true,
        paymentProviderConnected: true,
        revenueCollectionEnabled: true,
        revenueFlowing: true,
        settlementReady: true,
        payoutComplete: false,
      },
      plan: 'enterprise',
      paymentProvider: {
        connected: true,
        chargesEnabled: true,
        payoutsEnabled: true,
        restricted: false,
      },
      revenue: {
        collectedRevenue: 285_000,
        readyToRelease: 52_300,
        outstanding: 0,
        held: 3_200,
      },
      workflowStagePin: 'ready-to-release',
      activeScenario: 'Release Day',
    },
  },
];
