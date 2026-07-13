/**
 * Automation reporting — reusable report derivation services.
 *
 * No dashboards. Only report slices.
 */

import type {
  CommercialAutomationInput,
  CommercialAutomationResult,
} from '@/lib/commercial-automation/types';
import { runCommercialAutomation } from '@/lib/commercial-automation/automation-engine';
import { deriveScheduledAutomationJobs } from '@/lib/commercial-automation/scheduler';
import { resolveRulesForPolicy } from '@/lib/commercial-automation/rule-engine';

export type AutomationReportSlice = {
  reportId: string;
  title: string;
  summary: string;
  generatedAt: string;
  data: Record<string, unknown>;
};

function reportBase(title: string): Omit<AutomationReportSlice, 'data'> {
  return {
    reportId: title.toLowerCase().replace(/\s+/g, '_'),
    title,
    summary: '',
    generatedAt: new Date().toISOString(),
  };
}

/** Automation executions report. */
export function deriveAutomationExecutionsReport(
  result: CommercialAutomationResult
): AutomationReportSlice {
  return {
    ...reportBase('Automation Executions'),
    summary: `${result.rulesExecuted} rule(s) executed, ${result.executions.length} evaluation(s)`,
    data: {
      trigger: result.trigger,
      executions: result.executions,
      rulesEvaluated: result.rulesEvaluated,
      rulesMatched: result.rulesMatched,
      rulesExecuted: result.rulesExecuted,
    },
  };
}

/** Rule success rate report. */
export function deriveRuleSuccessRateReport(
  results: CommercialAutomationResult[]
): AutomationReportSlice {
  const total = results.reduce((s, r) => s + r.executions.length, 0);
  const success = results.reduce(
    (s, r) => s + r.executions.filter((e) => e.status === 'success').length,
    0
  );
  const rate = total > 0 ? (success / total) * 100 : 0;

  return {
    ...reportBase('Rule Success Rate'),
    summary: `${rate.toFixed(1)}% success rate across ${total} execution(s)`,
    data: { total, success, failed: total - success, rate },
  };
}

/** Outstanding automation tasks report. */
export function deriveOutstandingAutomationTasksReport(
  input: CommercialAutomationInput
): AutomationReportSlice {
  const rules = resolveRulesForPolicy(input.policyId ?? 'default', input.rules);
  const jobs = deriveScheduledAutomationJobs(input, rules);
  const pending = jobs.filter((j) => j.status === 'pending');

  return {
    ...reportBase('Outstanding Automation Tasks'),
    summary: `${pending.length} scheduled automation task(s) pending`,
    data: { pending, all: jobs },
  };
}

/** Automation failures report. */
export function deriveAutomationFailuresReport(
  results: CommercialAutomationResult[]
): AutomationReportSlice {
  const failures = results.flatMap((r) =>
    r.executions.filter((e) => e.status === 'failed' || e.status === 'partial')
  );

  return {
    ...reportBase('Automation Failures'),
    summary: `${failures.length} failed or partial execution(s)`,
    data: { failures, auditEntries: failures.map((f) => f.auditEntry) },
  };
}

/** Upcoming automation events report. */
export function deriveUpcomingAutomationEventsReport(
  input: CommercialAutomationInput
): AutomationReportSlice {
  const rules = resolveRulesForPolicy(input.policyId ?? 'default', input.rules);
  const jobs = deriveScheduledAutomationJobs(input, rules);

  return {
    ...reportBase('Upcoming Automation Events'),
    summary: `${jobs.length} upcoming scheduled automation event(s)`,
    data: { jobs },
  };
}

/** Derive all automation reports. */
export function deriveAllAutomationReports(
  input: CommercialAutomationInput
): AutomationReportSlice[] {
  const result = runCommercialAutomation(input);
  return [
    deriveAutomationExecutionsReport(result),
    deriveRuleSuccessRateReport([result]),
    deriveOutstandingAutomationTasksReport(input),
    deriveAutomationFailuresReport([result]),
    deriveUpcomingAutomationEventsReport(input),
  ];
}
