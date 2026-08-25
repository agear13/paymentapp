import { agreementWorkspaceHandoff } from '@/lib/workflows/agreement-intelligence/commercial-workspace-handoff';
import type { ApprovedAgreementStructure } from '@/lib/workflows/agreement-intelligence/types';

const approvedStructure = { approvedAt: '2026-08-24T00:00:00.000Z' } as ApprovedAgreementStructure;

describe('Agreement Intelligence → Commercial Workspace handoff', () => {
  it('opens the existing workspace when pilot_deal_id and bootstrap are present', () => {
    const handoff = agreementWorkspaceHandoff({
      pilotDealId: 'aiwf-agr-1',
      bootstrappedAt: '2026-08-24T12:00:00.000Z',
      extractionStatus: 'APPROVED',
      approvedStructure,
    });

    expect(handoff).toEqual({
      kind: 'open',
      href: '/workspace/arrangements/aiwf-agr-1',
      label: 'Open Commercial Workspace',
    });
  });

  it('does not imply an operational workspace before approval', () => {
    expect(
      agreementWorkspaceHandoff({
        pilotDealId: null,
        bootstrappedAt: null,
        extractionStatus: 'READY_FOR_REVIEW',
        approvedStructure: null,
      })
    ).toEqual({ kind: 'none' });
  });

  it('uses the existing bootstrap path when approved without a workspace', () => {
    expect(
      agreementWorkspaceHandoff({
        pilotDealId: null,
        bootstrappedAt: null,
        extractionStatus: 'APPROVED',
        approvedStructure,
      })
    ).toEqual({
      kind: 'activate',
      label: 'Create Commercial Workspace',
    });
  });

  it('does not offer Open while bootstrap has not completed', () => {
    expect(
      agreementWorkspaceHandoff({
        pilotDealId: 'aiwf-agr-1',
        bootstrappedAt: null,
        extractionStatus: 'APPROVED',
        approvedStructure,
      })
    ).toEqual({ kind: 'none' });
  });
});
