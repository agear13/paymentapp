/**
 * Scheduler — time-based automation rule evaluation.
 *
 * Supports future recurring automations and timing-based triggers.
 */

import {
  CommercialTriggerKind,
  type CommercialAutomationInput,
  type CommercialRule,
  type ScheduledAutomationJob,
} from '@/lib/commercial-automation/types';
import { buildCommercialTrigger } from '@/lib/commercial-automation/trigger-engine';
import { findRulesForTrigger } from '@/lib/commercial-automation/rule-engine';

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** Derive scheduled jobs from commercial timing and rules. */
export function deriveScheduledAutomationJobs(
  input: CommercialAutomationInput,
  rules: CommercialRule[]
): ScheduledAutomationJob[] {
  const jobs: ScheduledAutomationJob[] = [];
  const asOf = input.asOfDate ?? new Date().toISOString();

  const timingRules = findRulesForTrigger(
    CommercialTriggerKind.CommercialTimingApproaching,
    rules
  );
  for (const rule of timingRules) {
    jobs.push({
      id: `sched:${rule.id}:timing`,
      ruleId: rule.id,
      trigger: CommercialTriggerKind.CommercialTimingApproaching,
      scheduledFor: addDays(asOf, 7),
      description: 'Commercial timing approaching — evaluate rule',
      status: 'pending',
    });
  }

  const overdueRules = findRulesForTrigger(
    CommercialTriggerKind.InvoiceOverdue,
    rules
  );
  for (const invoice of input.invoices ?? []) {
    if (!invoice.overdue) continue;
    for (const rule of overdueRules) {
      const days = invoice.daysOverdue ?? 14;
      jobs.push({
        id: `sched:${rule.id}:${invoice.paymentLinkId}`,
        ruleId: rule.id,
        trigger: CommercialTriggerKind.InvoiceOverdue,
        scheduledFor: addDays(asOf, Math.max(0, 14 - days)),
        description: `Invoice overdue reminder — ${invoice.paymentLinkId}`,
        status: 'pending',
      });
    }
  }

  const settlementRules = findRulesForTrigger(
    CommercialTriggerKind.SettlementReady,
    rules
  );
  for (const rule of settlementRules) {
    jobs.push({
      id: `sched:${rule.id}:settlement`,
      ruleId: rule.id,
      trigger: CommercialTriggerKind.SettlementReady,
      scheduledFor: addDays(asOf, 3),
      description: 'Settlement eligibility check',
      status: 'pending',
    });
  }

  return jobs.sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
}

/** Build automation input from a scheduled job. */
export function automationInputFromScheduledJob(
  job: ScheduledAutomationJob,
  baseInput: Omit<CommercialAutomationInput, 'trigger'>
): CommercialAutomationInput {
  return {
    ...baseInput,
    trigger: buildCommercialTrigger(job.trigger, {
      occurredAt: job.scheduledFor,
      projectId: baseInput.projectId,
      dealId: baseInput.dealId,
    }),
  };
}

/** Filter jobs due for execution as of a given date. */
export function filterDueScheduledJobs(
  jobs: ScheduledAutomationJob[],
  asOfDate: string
): ScheduledAutomationJob[] {
  const asOf = new Date(asOfDate).getTime();
  return jobs.filter(
    (j) => j.status === 'pending' && new Date(j.scheduledFor).getTime() <= asOf
  );
}

/** Execute due scheduled jobs — returns inputs for automation engine. */
export function prepareScheduledExecutions(
  input: CommercialAutomationInput,
  rules: CommercialRule[]
): { jobs: ScheduledAutomationJob[]; dueInputs: CommercialAutomationInput[] } {
  const jobs = deriveScheduledAutomationJobs(input, rules);
  const due = filterDueScheduledJobs(jobs, input.asOfDate ?? new Date().toISOString());
  const dueInputs = due.map((job) =>
    automationInputFromScheduledJob(job, input)
  );
  return { jobs, dueInputs };
}
