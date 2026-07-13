/**
 * AI extension points — future AI recommends and explains automation.
 *
 * Do not implement AI logic. Automation remains deterministic.
 */

import type {
  CommercialAutomationInput,
  CommercialAutomationResult,
  CommercialRule,
} from '@/lib/commercial-automation/types';
import { runCommercialAutomation } from '@/lib/commercial-automation/automation-engine';
import { DEFAULT_COMMERCIAL_RULES } from '@/lib/commercial-automation/rule-engine';

export type AiRuleRecommendation = {
  id: string;
  ruleId: string;
  ruleName: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  suggestedPolicyId?: string | null;
};

export type AiAutomationExplanation = {
  executionId: string;
  ruleName: string;
  summary: string;
  triggerExplanation: string;
  conditionExplanation: string;
  actionExplanation: string;
};

export type AiAutomationExtensionResult = {
  status: 'extension_point';
  recommendations: AiRuleRecommendation[];
  message: string;
};

/** Extension: AI recommends automation rules based on commercial context. */
export function deriveAiRuleRecommendationsExtension(
  input: CommercialAutomationInput
): AiAutomationExtensionResult {
  const recommendations: AiRuleRecommendation[] = [];

  const missingPayout = input.participants?.some(
    (p) => p.agreementApproved && !p.payoutDetailsSubmitted
  );
  if (missingPayout) {
    recommendations.push({
      id: 'ai:rec:payout',
      ruleId: 'rule:agreement_approved_request_payout',
      ruleName: 'Request Payout Details on Agreement Approval',
      reason: 'Participants approved but payout details missing',
      confidence: 'high',
      suggestedPolicyId: input.policyId ?? 'default',
    });
  }

  const overdue = input.invoices?.some((i) => i.overdue);
  if (overdue) {
    recommendations.push({
      id: 'ai:rec:overdue',
      ruleId: 'rule:invoice_overdue_reminder',
      ruleName: 'Payment Reminder for Overdue Invoice',
      reason: 'Outstanding invoices are overdue',
      confidence: 'high',
    });
  }

  return {
    status: 'extension_point',
    recommendations,
    message: 'AI rule recommendations will consume this extension when implemented.',
  };
}

/** Extension: AI explains why automation executed. */
export function deriveAiExecutionExplanationExtension(
  result: CommercialAutomationResult
): AiAutomationExplanation[] {
  return result.executions
    .filter((e) => e.status !== 'skipped')
    .map((e) => ({
      executionId: e.executionId,
      ruleName: e.ruleName,
      summary: `Rule "${e.ruleName}" executed via trigger ${e.trigger.label}`,
      triggerExplanation: `Triggered by ${e.trigger.label} at ${e.trigger.occurredAt}`,
      conditionExplanation: e.conditions
        .map((c) => `${c.kind}: ${c.reason}`)
        .join('; '),
      actionExplanation: e.actions.map((a) => a.label).join(', '),
    }));
}

/** Extension: AI suggests workflow improvements. */
export function deriveAiWorkflowImprovementExtension(
  input: CommercialAutomationInput
): AiAutomationExtensionResult {
  const result = runCommercialAutomation(input);
  const skipped = result.executions.filter((e) => e.status === 'skipped');

  return {
    status: 'extension_point',
    recommendations: skipped.map((e) => ({
      id: `ai:improve:${e.ruleId}`,
      ruleId: e.ruleId,
      ruleName: e.ruleName,
      reason: e.conditions.find((c) => !c.satisfied)?.reason ?? 'Conditions not met',
      confidence: 'medium' as const,
    })),
    message: 'AI workflow improvements will consume this extension when implemented.',
  };
}

/** Extension: AI recommends settlement timing. */
export function deriveAiSettlementTimingExtension(
  input: CommercialAutomationInput
): AiAutomationExtensionResult {
  const settlementRule = DEFAULT_COMMERCIAL_RULES.find(
    (r) => r.id === 'rule:settlement_ready_release'
  );
  return {
    status: 'extension_point',
    recommendations: settlementRule
      ? [
          {
            id: 'ai:settlement_timing',
            ruleId: settlementRule.id,
            ruleName: settlementRule.name,
            reason: 'Settlement timing derived from commercial forecast and workflow state',
            confidence: 'medium',
          },
        ]
      : [],
    message: 'AI settlement timing will consume this extension when implemented.',
  };
}

/** Extension: AI recommends payment terms. */
export function deriveAiPaymentTermsExtension(
  input: CommercialAutomationInput
): AiAutomationExtensionResult {
  return {
    status: 'extension_point',
    recommendations: [],
    message: 'AI payment term recommendations will consume this extension when implemented.',
  };
}

export type { CommercialRule };
