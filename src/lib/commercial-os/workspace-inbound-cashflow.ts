import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { ProjectCashflowSnapshot } from '@/lib/ai-extractor/commercial-graph-types';
import type { RecentDeal } from '@/lib/data/mock-deal-network';

/** Project/client inbound schedule persisted on the deal via conversation import audit. */
export function resolveWorkspaceInboundCashflow(
  deal: RecentDeal | null | undefined
): ProjectCashflowSnapshot | null {
  if (!deal) return null;
  const records = deal.conversationImportHistory ?? [];
  for (let i = records.length - 1; i >= 0; i -= 1) {
    const cashflow = records[i]?.extractionSummary.obligationSnapshot?.commercialGraph?.projectCashflow;
    if (cashflow && cashflow.entries.length > 0) return cashflow;
  }
  return null;
}

export type WorkspaceParticipantPayable = {
  name: string;
  amount: number;
};

/** Named participant payables — never project instalment amounts. */
export function workspaceParticipantPayables(
  participants: DemoParticipant[]
): WorkspaceParticipantPayable[] {
  return participants
    .filter((participant) => participant.commissionKind === 'fixed_amount' && participant.commissionValue > 0)
    .map((participant) => ({
      name: participant.name,
      amount: participant.commissionValue,
    }));
}

export function formatWorkspaceCashflowAmount(
  amount: number | null | undefined,
  currency?: string | null
): string | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  const code = currency?.trim().toUpperCase() === 'USD' ? 'USD' : 'AUD';
  const prefix = code === 'USD' ? 'US$' : 'A$';
  return `${prefix}${amount.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;
}
