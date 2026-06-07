import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { CommercialRole } from '@/lib/projects/commercial-roles/types';
import {
  commercialRoleBudgetTypeLabel,
  formatCommercialRoleBudget,
} from '@/lib/projects/commercial-roles/format-commercial-role';
import { commercialRolesFromDeal } from '@/lib/projects/commercial-roles/commercial-roles-payload';
import type { ReleaseConfidenceLevel } from '@/lib/operations/explainability/types';
import type { OperationalKPIs } from '@/lib/operations/reducer/types';
import type { ProjectTreasurySummary } from '@/lib/projects/funding-sources/types';
import type { ProjectWorkspaceSummary } from '@/lib/projects/project-workspace-summary';
import { PROJECT_PHASE_OPERATOR } from '@/lib/operations/design-language';
import { safeProjectState } from '@/lib/operations/guards/hydration-guards';
import { deriveParticipantViewStats } from '@/lib/operations/selectors/derive-participant-view-stats';
import type { OperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';

export type BriefingObligationGroup = 'pending' | 'in_progress' | 'completed' | 'blocked';

export type BriefingObligationItem = {
  id: string;
  title: string;
  owner: string;
  dueDate?: string;
  status: BriefingObligationGroup;
  statusLabel: string;
  amountLabel?: string;
};

export type BriefingParticipantCard = {
  id: string;
  name: string;
  role: string;
  status: string;
  email?: string;
  settlementStatus: string;
  isPrimary?: boolean;
};

export type BriefingCommercialTerm = {
  label: string;
  value: string;
};

export type BriefingApprovalItem = {
  id: string;
  title: string;
  owner: string;
  status: 'pending' | 'approved' | 'required';
  statusLabel: string;
  history?: string;
};

export type BriefingReadinessItem = {
  label: string;
  complete: boolean;
};

export type AgreementBriefingSnapshot = {
  agreementName: string;
  agreementType: string;
  statusLabel: string;
  createdLabel: string;
  agreementValue?: string;
  participantCount: number;
  obligationCount: number;
  settlementReadinessScore: number;
  settlementTrend: 'stable' | 'improving' | 'attention';
  participants: BriefingParticipantCard[];
  commercialTerms: BriefingCommercialTerm[];
  obligationsByGroup: Record<BriefingObligationGroup, BriefingObligationItem[]>;
  approvals: BriefingApprovalItem[];
  readyRequirements: BriefingReadinessItem[];
  blockingIssues: BriefingReadinessItem[];
  missingRequirements: BriefingReadinessItem[];
  healthLabel: string;
  pendingApprovalCount: number;
  outstandingObligationCount: number;
  fundingProgressLabel: string;
};

export type BriefingObligationRowInput = {
  id: string;
  deal_id: string;
  obligation_type: string;
  status: string;
  amount_owed: unknown;
  currency: string;
  participant: { name: string; role: string; approvalStatus?: string } | null;
};

function confidenceToScore(level: ReleaseConfidenceLevel): number {
  switch (level) {
    case 'HIGH':
      return 92;
    case 'MEDIUM':
      return 74;
    case 'LOW':
      return 56;
    case 'BLOCKED':
      return 38;
    default:
      return 50;
  }
}

function inferAgreementType(deal: RecentDeal, roles: CommercialRole[]): string {
  if (deal.createdVia?.includes('template')) return 'Template Agreement';
  if (deal.createdVia?.includes('conversation') || deal.importedConversation) {
    return 'Conversation Import Agreement';
  }
  if (roles.some((r) => r.budgetType === 'REVENUE_SHARE')) return 'Revenue Share Agreement';
  if (roles.some((r) => r.budgetType === 'CUSTOMER_ATTRIBUTION')) return 'Referral Agreement';
  if (deal.introducerAmount != null || deal.closerAmount != null) return 'Revenue Share Agreement';
  return 'Commercial Agreement';
}

function formatCreatedDate(deal: RecentDeal): string {
  const raw = deal.importedAt ?? deal.lastUpdated;
  if (!raw) return 'Date not recorded';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function mapObligationGroup(status: string, participantApproved: boolean): BriefingObligationGroup {
  const s = status.toLowerCase();
  if (s.includes('block') || s.includes('hold')) return 'blocked';
  if (s.includes('complete') || s.includes('paid') || s.includes('settled')) return 'completed';
  if (s.includes('progress') || s.includes('fund') || s.includes('ready')) return 'in_progress';
  if (!participantApproved) return 'blocked';
  return 'pending';
}

function groupLabel(group: BriefingObligationGroup): string {
  const map: Record<BriefingObligationGroup, string> = {
    pending: 'Pending',
    in_progress: 'In progress',
    completed: 'Completed',
    blocked: 'Blocked',
  };
  return map[group];
}

function formatMoney(amount: unknown, currency: string): string {
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: 2,
  }).format(n);
}

export function composeAgreementBriefingSnapshot(input: {
  deal: RecentDeal;
  summary: ProjectWorkspaceSummary;
  participants: DemoParticipant[];
  obligationRows: BriefingObligationRowInput[];
  treasury: ProjectTreasurySummary | null;
  kpis: OperationalKPIs | null | undefined;
  graphParticipants: OperationalCoordinationSnapshot['participants'];
  releaseConfidenceLevel: ReleaseConfidenceLevel;
  blockerLabels: string[];
}): AgreementBriefingSnapshot {
  const roles = commercialRolesFromDeal(input.deal);
  const stats = deriveParticipantViewStats({
    canonicalKpis: input.kpis,
    graphParticipants: input.graphParticipants,
  });

  const participantCards: BriefingParticipantCard[] = input.participants.map((p, index) => {
    const graphRow = input.graphParticipants.find((g) => g.participant.id === p.id);
    const settlementStatus = graphRow?.releaseReadiness.releaseReady
      ? 'Settlement ready'
      : p.approvalStatus === 'Approved'
        ? stats.missingConfirmation > 0 && !p.payoutVerificationConfirmed
          ? 'Confirmation needed'
          : 'Coordinating'
        : 'Approval pending';

    return {
      id: p.id,
      name: p.name,
      role: p.role,
      status: p.approvalStatus ?? 'Pending approval',
      email: p.email || undefined,
      settlementStatus,
      isPrimary: index === 0,
    };
  });

  const commercialTerms: BriefingCommercialTerm[] = [];
  const currency = input.deal.projectValueCurrency ?? 'USD';

  if (input.summary.value > 0) {
    commercialTerms.push({ label: 'Agreement value', value: input.summary.currencyLabel });
  }
  if (input.deal.payoutTrigger) {
    commercialTerms.push({ label: 'Settlement schedule', value: input.deal.payoutTrigger });
  }
  roles.forEach((role) => {
    commercialTerms.push({
      label: role.title,
      value: `${formatCommercialRoleBudget(role, currency)} · ${commercialRoleBudgetTypeLabel(role.budgetType)}`,
    });
  });
  if (input.deal.introducerPayoutCondition) {
    commercialTerms.push({ label: 'Introducer terms', value: input.deal.introducerPayoutCondition });
  }
  if (input.deal.closerPayoutCondition) {
    commercialTerms.push({ label: 'Closer terms', value: input.deal.closerPayoutCondition });
  }
  commercialTerms.push({
    label: 'Approval requirements',
    value:
      stats.pendingAgreements > 0
        ? `${stats.pendingAgreements} participant agreement(s) pending`
        : 'Participant agreements captured',
  });
  commercialTerms.push({
    label: 'Settlement basis',
    value: input.treasury?.hasFundingSources
      ? 'Funding-linked obligations'
      : 'Awaiting funding sources',
  });
  commercialTerms.push({
    label: 'Payment terms',
    value:
      input.deal.paymentStatus === 'Paid'
        ? 'Funding recorded'
        : input.deal.paymentLink
          ? 'Collection via linked invoice'
          : 'To be coordinated',
  });

  const obligationsByGroup: Record<BriefingObligationGroup, BriefingObligationItem[]> = {
    pending: [],
    in_progress: [],
    completed: [],
    blocked: [],
  };

  for (const row of input.obligationRows) {
    const approved = row.participant?.approvalStatus === 'Approved';
    const group = mapObligationGroup(row.status, approved);
    const item: BriefingObligationItem = {
      id: row.id,
      title: row.obligation_type.replace(/_/g, ' '),
      owner: row.participant?.name ?? 'Unassigned',
      status: group,
      statusLabel: groupLabel(group),
      amountLabel: formatMoney(row.amount_owed, row.currency) || undefined,
    };
    obligationsByGroup[group].push(item);
  }

  if (input.obligationRows.length === 0 && input.participants.length > 0) {
    obligationsByGroup.pending.push({
      id: 'synthetic-earnings',
      title: 'Participant earnings configuration',
      owner: 'Operator',
      status: 'pending',
      statusLabel: 'Pending',
    });
    if (stats.pendingAgreements > 0) {
      obligationsByGroup.blocked.push({
        id: 'synthetic-approval',
        title: 'Participant approval required',
        owner: 'Participants',
        status: 'blocked',
        statusLabel: 'Blocked',
      });
    }
  }

  const approvals: BriefingApprovalItem[] = [];
  for (const p of input.participants) {
    if (p.approvalStatus !== 'Approved') {
      approvals.push({
        id: `approval-${p.id}`,
        title: `${p.name} participation agreement`,
        owner: p.name,
        status: 'pending',
        statusLabel: 'Awaiting signature',
        history: 'Agreement sent — pending participant approval',
      });
    }
  }
  if (stats.missingConfirmation > 0) {
    approvals.push({
      id: 'settlement-confirmation',
      title: 'Settlement confirmation',
      owner: 'Operator',
      status: 'required',
      statusLabel: 'Confirmation needed',
      history: `${stats.missingConfirmation} participant(s) need external settlement confirmation`,
    });
  }

  const participantsConfigured =
    (input.kpis?.earningsConfiguredCount ?? 0) >= Math.max(1, input.participants.length) &&
    input.participants.length > 0;
  const termsCaptured = roles.length > 0 || Boolean(input.deal.payoutTrigger) || input.summary.value > 0;
  const infrastructureConfigured = input.treasury?.hasFundingSources ?? Boolean(input.deal.paymentLink);
  const obligationsExist =
    input.obligationRows.length > 0 || (input.kpis?.obligationCount ?? 0) > 0;

  const readyRequirements: BriefingReadinessItem[] = [
    { label: 'Participants identified', complete: input.participants.length > 0 },
    { label: 'Participants configured', complete: participantsConfigured },
    { label: 'Commercial terms captured', complete: termsCaptured },
    { label: 'Collection infrastructure linked', complete: infrastructureConfigured },
    { label: 'Obligations identified', complete: obligationsExist },
  ].filter((r) => r.complete);

  const missingRequirements: BriefingReadinessItem[] = [
    { label: 'Add agreement participants', complete: input.participants.length > 0 },
    { label: 'Configure participant earnings', complete: participantsConfigured },
    { label: 'Capture commercial terms', complete: termsCaptured },
    { label: 'Link funding or invoice', complete: infrastructureConfigured },
    { label: 'Generate obligations', complete: obligationsExist },
  ].filter((r) => !r.complete);

  const blockingIssues: BriefingReadinessItem[] = input.blockerLabels.map((label) => ({
    label,
    complete: false,
  }));
  if (stats.pendingAgreements > 0) {
    blockingIssues.push({
      label: `${stats.pendingAgreements} approval(s) pending`,
      complete: false,
    });
  }
  if (input.releaseConfidenceLevel === 'BLOCKED') {
    blockingIssues.push({ label: 'Settlement not ready at workspace level', complete: false });
  }

  const ratioScore =
    input.kpis && input.kpis.participantCount > 0
      ? Math.round((input.kpis.payoutReadyCount / input.kpis.participantCount) * 100)
      : null;
  const confidenceScore = confidenceToScore(input.releaseConfidenceLevel);
  const settlementReadinessScore = ratioScore
    ? Math.round((ratioScore + confidenceScore) / 2)
    : confidenceScore;

  const phaseKey = safeProjectState(input.deal);
  const statusLabel = PROJECT_PHASE_OPERATOR[phaseKey] ?? 'Coordinating';

  const totalObligations =
    input.obligationRows.length || input.kpis?.obligationCount || obligationsByGroup.pending.length;

  return {
    agreementName: input.summary.name,
    agreementType: inferAgreementType(input.deal, roles),
    statusLabel,
    createdLabel: formatCreatedDate(input.deal),
    agreementValue: input.summary.value > 0 ? input.summary.currencyLabel : undefined,
    participantCount: input.participants.length,
    obligationCount: totalObligations,
    settlementReadinessScore,
    settlementTrend:
      blockingIssues.length > 0 ? 'attention' : settlementReadinessScore >= 85 ? 'improving' : 'stable',
    participants: participantCards,
    commercialTerms,
    obligationsByGroup,
    approvals,
    readyRequirements,
    blockingIssues,
    missingRequirements,
    healthLabel:
      blockingIssues.length === 0 && settlementReadinessScore >= 80
        ? 'Healthy'
        : blockingIssues.length > 0
          ? 'Needs attention'
          : 'In coordination',
    pendingApprovalCount: stats.pendingAgreements + (stats.missingConfirmation > 0 ? 1 : 0),
    outstandingObligationCount:
      obligationsByGroup.pending.length +
      obligationsByGroup.in_progress.length +
      obligationsByGroup.blocked.length,
    fundingProgressLabel: input.summary.fundingLabel,
  };
}

export const BRIEFING_SECTIONS = [
  { id: 'briefing-summary', label: 'Summary' },
  { id: 'briefing-participants', label: 'Participants' },
  { id: 'briefing-terms', label: 'Commercial terms' },
  { id: 'briefing-obligations', label: 'Obligations' },
  { id: 'briefing-approvals', label: 'Approvals' },
  { id: 'briefing-settlement', label: 'Settlement readiness' },
  { id: 'briefing-activity', label: 'Activity' },
  { id: 'briefing-audit', label: 'Audit' },
] as const;
