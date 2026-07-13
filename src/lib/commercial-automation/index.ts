/**
 * Commercial Automation — canonical domain module.
 *
 * Deterministic rule engine that orchestrates commercial operations.
 * Consumes the commercial model — never owns it.
 */

export * from '@/lib/commercial-automation/types';
export * from '@/lib/commercial-automation/automation-engine';
export * from '@/lib/commercial-automation/trigger-engine';
export * from '@/lib/commercial-automation/condition-engine';
export * from '@/lib/commercial-automation/action-engine';
export * from '@/lib/commercial-automation/rule-engine';
export * from '@/lib/commercial-automation/workflow-engine';
export * from '@/lib/commercial-automation/notification-engine';
export * from '@/lib/commercial-automation/scheduler';

export * from '@/lib/commercial-automation/extensions/ai-recommendations';
export * from '@/lib/commercial-automation/adapters/provider-adapters';
export * from '@/lib/commercial-automation/reporting/automation-reporting';
