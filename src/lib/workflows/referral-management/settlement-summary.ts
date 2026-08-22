/**
 * Referral Management settlement snippets.
 * Statuses come from the settlement domain — never from payout setup.
 */

import {
  moneyLabel,
  pickDominantSettlementStatus,
  SETTLEMENT_STATUS_LABELS,
  summarizeSettlement,
  type SettlementObligationRow,
  type SettlementWorkspaceStatus,
} from '@/lib/settlement/workspace-settlement';

export type ReferralParticipantSettlementSummary = {
  earned: number;
  earnedLabel: string;
  owed: number;
  owedLabel: string;
  ready: number;
  readyLabel: string;
  requiresAction: number;
  requiresActionLabel: string;
  status: SettlementWorkspaceStatus | null;
  statusLabel: string;
  nextAction: string | null;
};

export type ReferralWorkflowSettlementSummary = {
  earned: number;
  earnedLabel: string;
  owed: number;
  owedLabel: string;
  ready: number;
  readyLabel: string;
  requiresAction: number;
  requiresActionLabel: string;
};

export function deriveReferralParticipantSettlementSummary(
  rows: SettlementObligationRow[],
  earned: number,
  currency = 'AUD'
): ReferralParticipantSettlementSummary {
  const summary = summarizeSettlement(rows);
  const status = pickDominantSettlementStatus(rows.map((row) => row.workspaceStatus));
  const nextAction =
    rows.find((row) => row.workspaceStatus === 'requires_action')?.nextAction ??
    rows.find((row) => row.workspaceStatus === 'ready')?.nextAction ??
    rows[0]?.nextAction ??
    null;

  return {
    earned,
    earnedLabel: moneyLabel(earned, currency),
    owed: summary.owed,
    owedLabel: moneyLabel(summary.owed, currency),
    ready: summary.readyForPayout,
    readyLabel: moneyLabel(summary.readyForPayout, currency),
    requiresAction: summary.requiresAction,
    requiresActionLabel: moneyLabel(summary.requiresAction, currency),
    status,
    statusLabel: status ? SETTLEMENT_STATUS_LABELS[status] : 'No settlement yet',
    nextAction: status === 'requires_action' ? nextAction : null,
  };
}

export function deriveReferralWorkflowSettlementSummary(
  rows: SettlementObligationRow[],
  earned: number,
  currency = 'AUD'
): ReferralWorkflowSettlementSummary {
  const summary = summarizeSettlement(rows);
  return {
    earned,
    earnedLabel: moneyLabel(earned, currency),
    owed: summary.owed,
    owedLabel: moneyLabel(summary.owed, currency),
    ready: summary.readyForPayout,
    readyLabel: moneyLabel(summary.readyForPayout, currency),
    requiresAction: summary.requiresAction,
    requiresActionLabel: moneyLabel(summary.requiresAction, currency),
  };
}
