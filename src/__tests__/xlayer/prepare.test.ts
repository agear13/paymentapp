const mockAgreementFindFirst = jest.fn();
const mockCommitmentFindFirst = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockAuditCreate = jest.fn();

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    organization_workflow_agreements: {
      findFirst: (...args: unknown[]) => mockAgreementFindFirst(...args),
    },
    commercial_onchain_commitments: {
      findFirst: (...args: unknown[]) => mockCommitmentFindFirst(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    audit_logs: { create: (...args: unknown[]) => mockAuditCreate(...args) },
  },
}));

jest.mock('@/lib/commercial-incentive/store.server', () => ({
  getEarlyPaymentIncentiveDecision: jest.fn().mockResolvedValue(null),
}));

import { net30FourMilestones } from '@/__tests__/commercial-incentive/extraction-fixture';
import { prepareXlayerCommitment } from '@/lib/xlayer/prepare.server';

const ORG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const AGR = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER = 'user-1';
const REGISTRY = '0x1111111111111111111111111111111111111111';

describe('xlayer prepare', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_XLAYER_COMMITMENTS_ENABLED = 'true';
    process.env.NEXT_PUBLIC_XLAYER_COMMITMENT_REGISTRY_ADDRESS = REGISTRY;
    mockAgreementFindFirst.mockReset();
    mockCommitmentFindFirst.mockReset();
    mockCreate.mockReset();
    mockUpdate.mockReset();
    mockAuditCreate.mockReset().mockResolvedValue({});
  });

  it('rejects an agreement from another organization', async () => {
    mockAgreementFindFirst.mockResolvedValue(null);
    await expect(
      prepareXlayerCommitment({ organizationId: ORG, userId: USER, agreementId: AGR })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rejects a missing extraction', async () => {
    mockAgreementFindFirst.mockResolvedValue({
      id: AGR,
      organization_id: ORG,
      extraction_result: null,
      extraction_status: 'PENDING',
      approved_at: null,
      pilot_deal_id: null,
    });
    await expect(
      prepareXlayerCommitment({ organizationId: ORG, userId: USER, agreementId: AGR })
    ).rejects.toMatchObject({ code: 'MISSING_EXTRACTION' });
  });

  it('derives commitment ID and terms hash server-side and does not submit a transaction', async () => {
    mockAgreementFindFirst.mockResolvedValue({
      id: AGR,
      organization_id: ORG,
      extraction_result: net30FourMilestones(),
      extraction_status: 'READY_FOR_REVIEW',
      approved_at: null,
      pilot_deal_id: 'aiwf-test',
    });
    mockCommitmentFindFirst.mockResolvedValue(null);
    const created = {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      organization_id: ORG,
      source_agreement_id: AGR,
      pilot_deal_id: 'aiwf-test',
      display_commitment_id: '0xabcabcabca',
      onchain_commitment_id: `0x${'aa'.repeat(32)}`,
      buyer_label: 'Buyer',
      supplier_label: 'ABC Retail Pty Ltd',
      amount_minor_units: BigInt(10_000_000),
      source_currency: 'AUD',
      settlement_currency: 'AUD',
      due_date: new Date('2026-10-17T00:00:00.000Z'),
      purpose: 'Inventory purchase',
      terms_hash: `0x${'bb'.repeat(32)}`,
      offchain_lifecycle_stage: 'negotiated',
      onchain_status: null,
      verification_status: 'prepared',
      chain_id: 1952,
      contract_address: REGISTRY,
      wallet_address: null,
      transaction_hash: null,
      block_number: null,
      explorer_url: null,
      created_at: new Date(),
      updated_at: new Date(),
      created_by_user_id: USER,
      incentive_snapshot: null,
      original_due_label: 'Net 30',
    };
    mockCreate.mockResolvedValue(created);

    const view = await prepareXlayerCommitment({
      organizationId: ORG,
      userId: USER,
      agreementId: AGR,
    });

    expect(view.commitment?.verificationStatus).toBe('prepared');
    expect(view.commitment?.transactionHash).toBeNull();
    expect(view.commitment?.registerArgs.commitmentId).toMatch(/^0x[a-f0-9]{64}$/);
    expect(mockCreate).toHaveBeenCalled();
    const payload = mockCreate.mock.calls[0][0].data;
    expect(payload.transaction_hash).toBeNull();
    expect(payload.onchain_commitment_id).toBe(view.commitment?.registerArgs.commitmentId);
  });

  it('returns the existing submitted commitment instead of duplicating it', async () => {
    mockAgreementFindFirst.mockResolvedValue({
      id: AGR,
      organization_id: ORG,
      extraction_result: net30FourMilestones(),
      extraction_status: 'READY_FOR_REVIEW',
      approved_at: null,
      pilot_deal_id: null,
    });
    mockCommitmentFindFirst.mockResolvedValue({
      id: 'existing',
      organization_id: ORG,
      source_agreement_id: AGR,
      pilot_deal_id: null,
      display_commitment_id: '0xabcabcabca',
      onchain_commitment_id: `0x${'aa'.repeat(32)}`,
      buyer_label: 'Buyer',
      supplier_label: 'Supplier',
      amount_minor_units: BigInt(10_000_000),
      source_currency: 'AUD',
      settlement_currency: 'AUD',
      due_date: new Date(),
      purpose: 'Inventory purchase',
      terms_hash: `0x${'bb'.repeat(32)}`,
      offchain_lifecycle_stage: 'negotiated',
      onchain_status: null,
      verification_status: 'submitted',
      chain_id: 1952,
      contract_address: REGISTRY,
      wallet_address: '0x0000000000000000000000000000000000000001',
      transaction_hash: `0x${'cd'.repeat(32)}`,
      block_number: null,
      explorer_url: null,
      created_at: new Date(),
      updated_at: new Date(),
      created_by_user_id: USER,
      incentive_snapshot: null,
      original_due_label: 'Net 30',
    });

    const view = await prepareXlayerCommitment({
      organizationId: ORG,
      userId: USER,
      agreementId: AGR,
    });
    expect(view.commitment?.verificationStatus).toBe('submitted');
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
