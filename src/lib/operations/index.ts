/**
 * @module operations
 *
 * Canonical operational state architecture for Provvypay.
 * Single source of truth for lifecycle states, transitions, readiness, and orchestration.
 *
 * @example
 * import { orchestrateOperations, selectParticipantPayoutReadiness } from '@/lib/operations';
 */

export * from '@/lib/operations/types';
export * from '@/lib/operations/states';
export * from '@/lib/operations/transitions';
export * from '@/lib/operations/guards';
export * from '@/lib/operations/readiness';
export * from '@/lib/operations/orchestration';
export * from '@/lib/operations/selectors';
export * from '@/lib/operations/explainability';
export * from '@/lib/operations/severity';
export * from '@/lib/operations/design-language';
export * from '@/lib/operations/routing';
export * from '@/lib/operations/lifecycle';
export * from '@/lib/operations/truth';
export * from '@/lib/operations/hydration';
