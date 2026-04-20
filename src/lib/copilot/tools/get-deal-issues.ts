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
  diagnosticType?: 'blockers' | 'payout_readiness' | 'funding' | 'state_consistency' | 'needs_action';
  deal: {
    id: string;
    dealName: string;
    status: string;
    paymentStatus?: string;
    archived?: boolean;
    paymentLink?: string;
    paidAmount?: number;
    paidAt?: string;
    currentStage?: string;
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
  const { deal, participants, diagnosticType = 'blockers' } = input;

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
  const pendingApproval = participants.filter(
    (p) => (p.approvalStatus ?? '').trim() !== 'Approved' && !p.id.startsWith('internal-')
  );
  const payoutStuck = participants.filter((p) => {
    const ps = (p.payoutSettlementStatus ?? '').trim();
    return ps === 'Pending' || ps === 'Eligible';
  });
  const payoutApprovedAwaitingPay = participants.filter(
    (p) => (p.payoutSettlementStatus ?? '').trim() === 'Approved'
  );

  if (diagnosticType === 'blockers' || diagnosticType === 'needs_action') {
    if (!terminalPaid && (deal.status === 'Pending' || deal.status === 'In Review')) {
      push(
        items,
        'settlement',
        'Settlement not advanced',
        'warning',
        `Deal is in “${deal.status}”. Advance settlement (Pending → Eligible → Approved → Paid) when prerequisites are met.`
      );
    }
    if (!deal.paymentLink?.trim() && !terminalPaid) {
      push(
        items,
        'missing-payment-link',
        'No payment link attached',
        'warning',
        'Add a payment link or record external funding evidence to improve payout traceability.'
      );
    }
    if (pendingApproval.length > 0) {
      push(
        items,
        'approvals',
        `${pendingApproval.length} participant(s) not fully approved`,
        'warning',
        pendingApproval.map((p) => `${p.name} (${p.role})`).join('; ')
      );
    }
  }

  if (diagnosticType === 'funding' || diagnosticType === 'blockers' || diagnosticType === 'needs_action') {
    if (deal.paymentStatus === 'Not Paid' && deal.status !== 'Paid') {
      push(
        items,
        'contract-pay',
        'Funding not yet marked received',
        'warning',
        'Counterparty payment appears open. Mark payment received when funds settle.'
      );
    }
    if (deal.paymentStatus === 'Paid' && !deal.paidAt) {
      push(
        items,
        'paid-no-time',
        'Payment marked paid without timestamp',
        'info',
        'Record paidAt for cleaner audit and timeline context.'
      );
    }
  }

  if (diagnosticType === 'payout_readiness' || diagnosticType === 'blockers' || diagnosticType === 'needs_action') {
    if (!terminalPaid && payoutStuck.length > 0) {
      push(
        items,
        'payout-lines',
        'Payout lines still moving through workflow',
        'info',
        `${payoutStuck.length} line(s) are not Approved/Paid yet.`
      );
    }
    if (payoutApprovedAwaitingPay.length > 0 && deal.paymentStatus !== 'Paid') {
      push(
        items,
        'approved-awaiting-funding',
        `${payoutApprovedAwaitingPay.length} payout line(s) approved but funding not marked paid`,
        'warning',
        'Funding confirmation is still needed before final Paid settlement is safe.'
      );
    }
  }

  if (diagnosticType === 'state_consistency' || diagnosticType === 'blockers') {
    if (deal.status === 'Paid' && deal.paymentStatus !== 'Paid') {
      push(
        items,
        'paid-mismatch',
        'State mismatch: settlement is Paid but payment is Not Paid',
        'critical',
        'Set counterparty payment to Paid or reopen settlement state.'
      );
    }
    if (deal.paymentStatus === 'Paid' && deal.status === 'Pending') {
      push(
        items,
        'pending-paid',
        'State mismatch: payment is Paid while settlement is Pending',
        'warning',
        'Move settlement to Eligible/Approved/Paid to match funding state.'
      );
    }
    if (deal.currentStage === 'Payment Received' && deal.paymentStatus !== 'Paid') {
      push(
        items,
        'stage-payment-conflict',
        'Operating stage says payment received, but payment status is not paid',
        'warning'
      );
    }
  }

  if (diagnosticType === 'needs_action' && items.length === 0) {
    push(
      items,
      'needs-action-clear',
      'No immediate operator actions detected',
      'info',
      'Current state appears actionable-complete for this deal.'
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
