import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import type { WorkflowAgreementExtractionStatus } from '@prisma/client';

export type AgreementWorkspaceHandoffInput = {
  pilotDealId?: string | null;
  bootstrappedAt?: string | null;
  extractionStatus?: WorkflowAgreementExtractionStatus | null;
  approvedStructure?: unknown;
};

export type AgreementWorkspaceHandoff =
  | { kind: 'open'; href: string; label: 'Open Commercial Workspace' }
  | { kind: 'activate'; label: 'Create Commercial Workspace' }
  | { kind: 'none' };

/**
 * Agreement Intelligence → Commercial Workspace handoff.
 * Open only when the operational deal was actually bootstrapped.
 * Activate uses the existing retry-bootstrap path — never a second deal creator.
 */
export function agreementWorkspaceHandoff(
  agreement: AgreementWorkspaceHandoffInput | null | undefined
): AgreementWorkspaceHandoff {
  if (!agreement) return { kind: 'none' };

  const pilotDealId = agreement.pilotDealId?.trim() || null;
  if (pilotDealId && agreement.bootstrappedAt) {
    return {
      kind: 'open',
      href: COMMERCIAL_OS_ROUTES.arrangement(pilotDealId),
      label: 'Open Commercial Workspace',
    };
  }

  if (
    agreement.extractionStatus === 'APPROVED' &&
    agreement.approvedStructure &&
    !agreement.bootstrappedAt &&
    !pilotDealId
  ) {
    return { kind: 'activate', label: 'Create Commercial Workspace' };
  }

  return { kind: 'none' };
}
