import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

export type CommercialWorkspaceNextStep = {
  title: string;
  description: string;
  href: string;
  cta: string;
};

/**
 * Operator next step from existing workspace summary + approval counts.
 * Does not invent new readiness math — uses counts already on the operational graph.
 */
export function commercialWorkspaceNextStep(input: {
  workspaceId: string;
  participantCount: number;
  pendingApprovals: number;
  hasFundingSources: boolean;
  fundingLabel: string;
  obligationAwaitingCount?: number;
}): CommercialWorkspaceNextStep {
  const { workspaceId } = input;
  if (input.participantCount === 0) {
    return {
      title: 'Add participants',
      description: 'This workspace has no people yet. Add counterparties so obligations can be derived.',
      href: COMMERCIAL_OS_ROUTES.arrangementPeople(workspaceId),
      cta: 'Open People',
    };
  }
  if (input.pendingApprovals > 0) {
    return {
      title: 'Coordinate approvals',
      description: `${input.pendingApprovals} participant${input.pendingApprovals === 1 ? '' : 's'} still need agreement coordination.`,
      href: COMMERCIAL_OS_ROUTES.arrangementPeople(workspaceId),
      cta: 'Open People',
    };
  }
  if (!input.hasFundingSources) {
    return {
      title: 'Attach funding',
      description:
        input.fundingLabel ||
        'Connect an existing invoice or add a funding source. Invoices stay in Receivables.',
      href: COMMERCIAL_OS_ROUTES.arrangementMoney(workspaceId),
      cta: 'Open Money',
    };
  }
  if ((input.obligationAwaitingCount ?? 0) > 0) {
    return {
      title: 'Review obligations',
      description: 'Derived obligations are waiting on funding or participant coordination.',
      href: COMMERCIAL_OS_ROUTES.arrangementObligations(workspaceId),
      cta: 'Open Obligations',
    };
  }
  return {
    title: 'Workspace is operating',
    description: 'Review settlement readiness or activity for this arrangement.',
    href: COMMERCIAL_OS_ROUTES.arrangementMoney(workspaceId),
    cta: 'Open Money',
  };
}
