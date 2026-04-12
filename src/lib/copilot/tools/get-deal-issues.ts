/**
 * Pure analysis for Deal Network Copilot — safe to run server-side from API tools.
 * Input is an explicit snapshot from the client (demo pilot state or future server-backed deals).
 */

export type DealIssueSeverity = 'info' | 'warning' | 'critical';

export type DealIssueItem = {
  id: string;
  label: string;
  detail?: string;
  severity: DealIssueSeverity;
};

export type GetDealIssuesInput = {
  deal: {
    id: string;
    dealName: string;
    status: string;
    paymentStatus?: string;
    archived?: boolean;
  } | null;
  participants: Array<{
    id: string;
    name: string;
    role: string;
    approvalStatus?: string;
    payoutSettlementStatus?: string;
  }>;
};

export type GetDealIssuesResult = {
  summary: string;
  items: DealIssueItem[];
};

function push(
  items: DealIssueItem[],
  id: string,
  label: string,
  severity: DealIssueSeverity,
  detail?: string
) {
  items.push({ id, label, severity, detail });
}

export function getDealIssues(input: GetDealIssuesInput): GetDealIssuesResult {
  const items: DealIssueItem[] = [];
  const { deal, participants } = input;

  if (!deal || deal.id === '__placeholder__') {
    push(items, 'no-deal', 'No deal selected', 'critical', 'Choose a deal from the pipeline to diagnose blockers.');
    return {
      summary: 'Select an active deal to analyze payout and approval blockers.',
      items,
    };
  }

  if (deal.archived) {
    push(items, 'archived', 'Deal is archived', 'warning', 'Restore this deal from the archived list to continue operations.');
  }

  const terminalPaid = deal.status === 'Paid' || deal.paymentStatus === 'Paid';

  if (!terminalPaid && (deal.status === 'Pending' || deal.status === 'In Review')) {
    push(
      items,
      'settlement',
      'Settlement not advanced',
      'warning',
      `Deal is in “${deal.status}”. Advance settlement (Pending → Eligible → Approved → Paid) when prerequisites are met.`
    );
  }

  if (deal.paymentStatus === 'Not Paid' && deal.status !== 'Paid') {
    push(
      items,
      'contract-pay',
      'Contract / counterparty payment open',
      'info',
      'Counterparty or contract payment may still be required before commissions can settle.'
    );
  }

  const pendingApproval = participants.filter(
    (p) => (p.approvalStatus ?? '').trim() !== 'Approved' && !p.id.startsWith('internal-')
  );
  if (pendingApproval.length > 0) {
    push(
      items,
      'approvals',
      `${pendingApproval.length} participant(s) not fully approved`,
      'warning',
      pendingApproval.map((p) => `${p.name} (${p.role})`).join('; ')
    );
  }

  const payoutStuck = participants.filter((p) => {
    const ps = (p.payoutSettlementStatus ?? '').trim();
    return ps === 'Pending' || ps === 'Eligible';
  });
  if (!terminalPaid && payoutStuck.length > 0) {
    push(
      items,
      'payout-lines',
      'Payout lines still moving through workflow',
      'info',
      `${payoutStuck.length} line(s) are not Paid yet. Confirm approvals and rails before marking Paid.`
    );
  }

  if (items.length === 0) {
    push(items, 'clear', 'No obvious blockers in snapshot', 'info', 'Review rails and approvals if payouts still fail in production.');
  }

  const critical = items.some((i) => i.severity === 'critical');
  const summary = critical
    ? 'This deal needs a selection or configuration before payouts can be diagnosed further.'
    : items.some((i) => i.severity === 'warning')
      ? 'There are items to clear before this deal is payout-ready.'
      : 'Snapshot looks healthy; verify external rails and banking outside this demo if issues persist.';

  items.sort((a, b) => {
    const rank = (s: DealIssueSeverity) => (s === 'critical' ? 0 : s === 'warning' ? 1 : 2);
    return rank(a.severity) - rank(b.severity);
  });

  return { summary, items };
}
