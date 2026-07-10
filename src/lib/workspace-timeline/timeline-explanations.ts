import type { TimelineExplanation, TimelineLayer, WorkspaceTimelineEventType } from '@/lib/workspace-timeline/types';
import { formatForecastAmount } from '@/lib/commercial/commercial-forecast';

type ExplainInput = {
  type: WorkspaceTimelineEventType;
  status: string;
  layer: TimelineLayer;
  title: string;
  projectName?: string | null;
  amount?: number | null;
  currency?: string | null;
};

export function buildTimelineExplanation(input: ExplainInput): TimelineExplanation {
  const { type, status, layer, title, projectName, amount, currency } = input;
  const amt =
    amount != null && currency ? formatForecastAmount(amount, currency) : null;

  switch (type) {
    case 'invoice_due':
    case 'expected_payment':
      return {
        whyThisMatters: amt
          ? `${amt} expected${projectName ? ` for ${projectName}` : ''}.`
          : `Payment expected${projectName ? ` for ${projectName}` : ''}.`,
        recommendedAction: status === 'awaiting_payment' ? 'Follow up with customer or open payment link.' : null,
        commercialConsequence: 'Revenue not yet secured until payment is confirmed.',
        accountingConsequence: 'No accounting entry until payment is received.',
        settlementConsequence: 'Settlement cannot begin until payment is confirmed.',
      };

    case 'invoice_paid':
    case 'stripe_payment':
    case 'metamask_payment':
      return {
        whyThisMatters: `${title} confirmed${projectName ? ` for ${projectName}` : ''}.`,
        recommendedAction: status === 'settlement_pending' ? 'Review settlement blocker.' : null,
        commercialConsequence: 'Revenue already secured.',
        accountingConsequence: 'Invoice posted or awaiting sync.',
        settlementConsequence:
          status === 'settlement_pending' ? 'Funds not yet released.' : 'Settlement in progress.',
      };

    case 'settlement_pending':
      return {
        whyThisMatters: `Settlement awaiting release${projectName ? ` for ${projectName}` : ''}.`,
        recommendedAction: 'Review settlement blocker.',
        commercialConsequence: 'Revenue already secured.',
        accountingConsequence: 'Invoice posted.',
        settlementConsequence: 'Funds not yet released.',
      };

    case 'settlement_completed':
    case 'obligation_due':
      return {
        whyThisMatters: amt
          ? `${amt} commitment due${projectName ? ` on ${projectName}` : ''}.`
          : `Commitment due${projectName ? ` on ${projectName}` : ''}.`,
        recommendedAction: 'Confirm funding covers this obligation.',
        commercialConsequence: 'Reduces forecast surplus when paid.',
        accountingConsequence: 'May require supplier bill or accrual.',
        settlementConsequence: 'Release when funding and approvals are ready.',
      };

    case 'participant_approval':
      return {
        whyThisMatters: `${title} is blocking settlement progress.`,
        recommendedAction: 'Send or chase participant approval.',
        commercialConsequence: 'Payouts remain locked until approved.',
        accountingConsequence: null,
        settlementConsequence: 'Settlement blocked until approval.',
      };

    case 'cash_shortfall':
      return {
        whyThisMatters: amt ? `Projects forecast a ${amt} shortfall.` : 'Projects forecast a cash shortfall.',
        recommendedAction: 'Increase revenue or reduce fixed commitments in Planning.',
        commercialConsequence: 'Not all obligations may be fundable.',
        accountingConsequence: null,
        settlementConsequence: 'Some settlements may be delayed.',
      };

    case 'budget_review':
      return {
        whyThisMatters: `Planned budget for ${title}${projectName ? ` on ${projectName}` : ''}.`,
        recommendedAction: 'Review assumptions in Planning before execution.',
        commercialConsequence: 'Affects forecast surplus when obligations materialise.',
        accountingConsequence: null,
        settlementConsequence: 'Will flow to settlement when invoiced.',
      };

    default:
      return {
        whyThisMatters: `${title}${projectName ? ` · ${projectName}` : ''}.`,
        recommendedAction: layer === 'operational' ? 'Review in project workspace.' : null,
        commercialConsequence: layer === 'commercial' ? 'Affects commercial forecast.' : null,
        accountingConsequence: layer === 'accounting' ? 'Affects accounting records.' : null,
        settlementConsequence: layer === 'settlement' ? 'Affects settlement readiness.' : null,
      };
  }
}
