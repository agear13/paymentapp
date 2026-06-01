import type { OperationalAuditEntry } from '@/lib/operations/audit/operational-audit';
import type { ProjectFundingSourceDto } from '@/lib/projects/funding-sources/types';

export type FundingSourceAuditAction = 'added' | 'updated' | 'removed';

const ACTION_TITLES: Record<FundingSourceAuditAction, string> = {
  added: 'Funding source added',
  updated: 'Funding source updated',
  removed: 'Funding source removed',
};

function formatAmount(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function buildFundingSourceAuditEntry(input: {
  projectId: string;
  action: FundingSourceAuditAction;
  source: Pick<ProjectFundingSourceDto, 'id' | 'name' | 'amount' | 'currency' | 'status'>;
  timestamp?: string;
}): OperationalAuditEntry {
  const timestamp = input.timestamp ?? new Date().toISOString();
  const amountLabel = formatAmount(input.source.amount, input.source.currency);
  return {
    id: `funding-source-${input.action}-${input.source.id}-${timestamp}`,
    type: 'funding_linked',
    title: ACTION_TITLES[input.action],
    description: `${input.source.name} · ${amountLabel} · ${input.source.status}`,
    timestamp,
    projectId: input.projectId,
  };
}
