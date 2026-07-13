/**
 * Commercial Automation Engine — canonical orchestrator.
 *
 * Deterministic rule engine that coordinates commercial operations.
 * Consumes the commercial model; never owns it.
 *
 * Pipeline:
 *   Trigger → Rules → Conditions → Actions → Notifications + Activity + Audit
 */

import { evaluateConditions } from '@/lib/commercial-automation/condition-engine';
import { planActions } from '@/lib/commercial-automation/action-engine';
import {
  findRulesForTrigger,
  resolveRulesForPolicy,
} from '@/lib/commercial-automation/rule-engine';
import { collectNotificationsFromExecutions } from '@/lib/commercial-automation/notification-engine';
import { deriveCommercialForecasting } from '@/lib/commercial-forecasting';
import type {
  AutomationAuditEntry,
  CommercialAutomationInput,
  CommercialAutomationResult,
  CommercialExecution,
  CommercialRule,
} from '@/lib/commercial-automation/types';

function executionId(ruleId: string, triggerAt: string): string {
  return `exec:${ruleId}:${triggerAt}`;
}

function buildAuditEntry(
  execution: Omit<CommercialExecution, 'auditEntry'>,
  startedAt: number
): AutomationAuditEntry {
  const failedActions = execution.actions.filter((a) => a.status === 'failed');
  const status =
    execution.status === 'skipped'
      ? 'skipped'
      : failedActions.length === execution.actions.length
        ? 'failed'
        : failedActions.length > 0
          ? 'partial'
          : 'success';

  return {
    id: `audit:${execution.executionId}`,
    ruleId: execution.ruleId,
    ruleName: execution.ruleName,
    trigger: execution.trigger.kind,
    conditions: execution.conditions,
    actions: execution.actions,
    occurredAt: execution.completedAt,
    durationMs: execution.durationMs,
    status,
    retryCount: 0,
  };
}

/** Execute a single rule against input context. */
export function executeCommercialRule(
  rule: CommercialRule,
  input: CommercialAutomationInput
): CommercialExecution {
  const startedAt = Date.now();
  const startedIso = new Date(startedAt).toISOString();

  const { satisfied, results } = evaluateConditions(
    rule.conditions,
    input,
    rule.conditionMode ?? 'all'
  );

  if (!satisfied) {
    const completedAt = new Date().toISOString();
    const execution: CommercialExecution = {
      executionId: executionId(rule.id, input.trigger.occurredAt),
      ruleId: rule.id,
      ruleName: rule.name,
      trigger: input.trigger,
      conditions: results,
      actions: [],
      notifications: [],
      activityEvents: [],
      auditEntry: {} as AutomationAuditEntry,
      status: 'skipped',
      startedAt: startedIso,
      completedAt,
      durationMs: Date.now() - startedAt,
    };
    execution.auditEntry = buildAuditEntry(execution, startedAt);
    return execution;
  }

  const actionPlans = planActions(rule, input);
  const actions = actionPlans.map((p) => p.result);
  const notifications = actionPlans
    .map((p) => p.notification)
    .filter((n): n is NonNullable<typeof n> => n !== null && n !== undefined);
  const activityEvents = actionPlans
    .map((p) => p.activityEvent)
    .filter((a): a is NonNullable<typeof a> => a !== null && a !== undefined);

  const completedAt = new Date().toISOString();
  const execution: CommercialExecution = {
    executionId: executionId(rule.id, input.trigger.occurredAt),
    ruleId: rule.id,
    ruleName: rule.name,
    trigger: input.trigger,
    conditions: results,
    actions,
    notifications,
    activityEvents,
    auditEntry: {} as AutomationAuditEntry,
    status: actions.some((a) => a.status === 'failed') ? 'partial' : 'success',
    startedAt: startedIso,
    completedAt,
    durationMs: Date.now() - startedAt,
  };
  execution.auditEntry = buildAuditEntry(execution, startedAt);
  return execution;
}

/** Enrich input with forecast if forecasting input provided. */
function enrichInputWithForecast(
  input: CommercialAutomationInput
): CommercialAutomationInput {
  if (input.forecast || !input.forecastingInput) return input;
  return {
    ...input,
    forecast: deriveCommercialForecasting(input.forecastingInput),
  };
}

/**
 * Run the Commercial Automation Engine.
 *
 * Evaluates all matching rules for the trigger, executes actions,
 * and produces notifications, activity events, and audit entries.
 */
export function runCommercialAutomation(
  input: CommercialAutomationInput
): CommercialAutomationResult {
  const enriched = enrichInputWithForecast(input);
  const rules = resolveRulesForPolicy(
    enriched.policyId ?? 'default',
    enriched.rules
  );
  const matchingRules = findRulesForTrigger(enriched.trigger.kind, rules);

  const recentSet = new Set(enriched.recentExecutions ?? []);
  const rulesToRun = matchingRules.filter(
    (r) => !recentSet.has(`${r.id}:${enriched.trigger.occurredAt}`)
  );

  const executions = rulesToRun.map((rule) =>
    executeCommercialRule(rule, enriched)
  );

  const executed = executions.filter((e) => e.status !== 'skipped');
  const notifications = collectNotificationsFromExecutions(executions);
  const activityEvents = executions.flatMap((e) => e.activityEvents);
  const auditEntries = executions.map((e) => e.auditEntry);

  return {
    trigger: enriched.trigger,
    executions,
    notifications,
    activityEvents,
    auditEntries,
    rulesEvaluated: matchingRules.length,
    rulesMatched: executed.length,
    rulesExecuted: executed.filter((e) => e.status === 'success').length,
  };
}

/** Convenience: run automation from trigger kind. */
export function runCommercialAutomationForTrigger(
  triggerKind: CommercialAutomationInput['trigger']['kind'],
  input: Omit<CommercialAutomationInput, 'trigger'>
): CommercialAutomationResult {
  return runCommercialAutomation({
    ...input,
    trigger: {
      kind: triggerKind,
      label: triggerKind,
      occurredAt: input.asOfDate ?? new Date().toISOString(),
      projectId: input.projectId,
      dealId: input.dealId,
    },
  });
}
