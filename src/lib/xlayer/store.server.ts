import 'server-only';

import { Prisma } from '@prisma/client';
import type { Hex } from 'viem';
import { prisma } from '@/lib/server/prisma';
import {
  XLAYER_COMMITMENT_DISCLAIMER,
  XLAYER_TESTNET_CHAIN_ID,
  XLAYER_TESTNET_NAME,
  buildXlayerExplorerTxUrl,
  getConfiguredRegistryAddress,
  getXlayerExplorerBaseUrl,
  isXlayerCommitmentsEnabled,
} from '@/lib/xlayer/chain';
import {
  computeCommitmentId,
  displayCommitmentId,
  hashUtf8,
  stringToBytes32,
} from '@/lib/xlayer/terms-hash';
import type {
  OnchainCommitmentStatus,
  OnchainVerificationStatus,
  XlayerCommitmentRecord,
  XlayerCommitmentView,
  XlayerRegisterArgs,
} from '@/lib/xlayer/types';
import type { CanonicalIncentiveSnapshot } from '@/lib/xlayer/terms-hash';

export const XLAYER_COMMITMENT_ENTITY_TYPE = 'xlayer_commitment';

type Row = {
  id: string;
  organization_id: string;
  source_agreement_id: string;
  pilot_deal_id: string | null;
  display_commitment_id: string;
  onchain_commitment_id: string;
  buyer_label: string;
  supplier_label: string;
  amount_minor_units: bigint;
  source_currency: string;
  settlement_currency: string;
  due_date: Date | null;
  purpose: string;
  terms_hash: string;
  offchain_lifecycle_stage: string | null;
  onchain_status: OnchainCommitmentStatus | null;
  verification_status: OnchainVerificationStatus;
  chain_id: number;
  contract_address: string;
  wallet_address: string | null;
  transaction_hash: string | null;
  block_number: bigint | null;
  explorer_url: string | null;
  created_at: Date;
  updated_at: Date;
  created_by_user_id: string;
  incentive_snapshot: unknown;
  original_due_label: string | null;
};

function asIncentive(value: unknown): CanonicalIncentiveSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Partial<NonNullable<CanonicalIncentiveSnapshot>>;
  if (raw.status !== 'approved') return null;
  if (typeof raw.policyId !== 'string') return null;
  return {
    status: 'approved',
    policyId: raw.policyId,
    acceleratedDays: Number(raw.acceleratedDays),
    incentivePercent: Number(raw.incentivePercent),
    compensationType: String(raw.compensationType ?? 'conditional_bonus'),
  };
}

export function buildRegisterArgs(row: {
  organization_id: string;
  source_agreement_id: string;
  buyer_label: string;
  supplier_label: string;
  amount_minor_units: bigint | number;
  source_currency: string;
  settlement_currency: string;
  due_date: Date | null;
  purpose: string;
  terms_hash: string;
}): XlayerRegisterArgs {
  const dueDate = row.due_date ? Math.floor(row.due_date.getTime() / 1000) : 0;
  const commitmentId = computeCommitmentId(row.organization_id, row.source_agreement_id);
  return {
    commitmentId,
    buyerRefHash: hashUtf8(row.buyer_label),
    supplierRefHash: hashUtf8(row.supplier_label),
    amountMinorUnits: String(row.amount_minor_units),
    sourceCurrency: stringToBytes32(row.source_currency),
    settlementCurrency: stringToBytes32(row.settlement_currency),
    dueDate,
    purposeHash: hashUtf8(row.purpose),
    termsHash: row.terms_hash as Hex,
  };
}

export function toCommitmentRecord(row: Row): XlayerCommitmentRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    sourceAgreementId: row.source_agreement_id,
    pilotDealId: row.pilot_deal_id,
    displayCommitmentId: row.display_commitment_id,
    onchainCommitmentId: row.onchain_commitment_id as Hex,
    buyerLabel: row.buyer_label,
    supplierLabel: row.supplier_label,
    amountMinorUnits: Number(row.amount_minor_units),
    sourceCurrency: row.source_currency,
    settlementCurrency: row.settlement_currency,
    dueDate: row.due_date?.toISOString() ?? null,
    purpose: row.purpose,
    termsHash: row.terms_hash as Hex,
    offchainLifecycleStage: row.offchain_lifecycle_stage,
    onchainStatus: row.onchain_status,
    verificationStatus: row.verification_status,
    chainId: row.chain_id,
    contractAddress: row.contract_address,
    walletAddress: row.wallet_address,
    transactionHash: row.transaction_hash,
    blockNumber: row.block_number != null ? String(row.block_number) : null,
    explorerUrl: row.explorer_url,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    createdByUserId: row.created_by_user_id,
    originalDueLabel: row.original_due_label,
    incentive: asIncentive(row.incentive_snapshot),
    registerArgs: buildRegisterArgs(row),
  };
}

export function emptyCommitmentView(): XlayerCommitmentView {
  return {
    enabled: isXlayerCommitmentsEnabled(),
    chainId: XLAYER_TESTNET_CHAIN_ID,
    chainName: XLAYER_TESTNET_NAME,
    contractAddress: getConfiguredRegistryAddress(),
    explorerBaseUrl: getXlayerExplorerBaseUrl(),
    disclaimer: XLAYER_COMMITMENT_DISCLAIMER,
    commitment: null,
    preview: null,
  };
}

export async function getCommitmentForAgreement(input: {
  organizationId: string;
  agreementId: string;
}): Promise<XlayerCommitmentRecord | null> {
  const row = await prisma.commercial_onchain_commitments.findFirst({
    where: {
      organization_id: input.organizationId,
      source_agreement_id: input.agreementId,
      chain_id: XLAYER_TESTNET_CHAIN_ID,
    },
  });
  return row ? toCommitmentRecord(row as Row) : null;
}

export async function getCommitmentById(input: {
  organizationId: string;
  id: string;
}): Promise<XlayerCommitmentRecord | null> {
  const row = await prisma.commercial_onchain_commitments.findFirst({
    where: { id: input.id, organization_id: input.organizationId },
  });
  return row ? toCommitmentRecord(row as Row) : null;
}

export async function upsertPreparedCommitment(input: {
  organizationId: string;
  userId: string;
  sourceAgreementId: string;
  pilotDealId: string | null;
  buyerLabel: string;
  supplierLabel: string;
  amountMinorUnits: number;
  sourceCurrency: string;
  settlementCurrency: string;
  dueDate: Date;
  purpose: string;
  termsHash: Hex;
  offchainLifecycleStage: string;
  originalDueLabel: string | null;
  incentive: CanonicalIncentiveSnapshot;
}): Promise<XlayerCommitmentRecord> {
  const contractAddress = getConfiguredRegistryAddress();
  if (!contractAddress) {
    throw Object.assign(new Error('X Layer registry is not configured'), {
      code: 'NOT_CONFIGURED',
      status: 409,
    });
  }
  const onchainCommitmentId = computeCommitmentId(input.organizationId, input.sourceAgreementId);
  const data = {
    organization_id: input.organizationId,
    source_agreement_id: input.sourceAgreementId,
    pilot_deal_id: input.pilotDealId,
    display_commitment_id: displayCommitmentId(onchainCommitmentId),
    onchain_commitment_id: onchainCommitmentId,
    buyer_label: input.buyerLabel,
    supplier_label: input.supplierLabel,
    amount_minor_units: BigInt(input.amountMinorUnits),
    source_currency: input.sourceCurrency,
    settlement_currency: input.settlementCurrency,
    due_date: input.dueDate,
    purpose: input.purpose,
    terms_hash: input.termsHash,
    offchain_lifecycle_stage: input.offchainLifecycleStage,
    onchain_status: null,
    verification_status: 'prepared' as const,
    chain_id: XLAYER_TESTNET_CHAIN_ID,
    contract_address: contractAddress,
    wallet_address: null,
    transaction_hash: null,
    block_number: null,
    explorer_url: null,
    created_by_user_id: input.userId,
    incentive_snapshot: input.incentive ?? Prisma.DbNull,
    original_due_label: input.originalDueLabel,
  };

  const existing = await prisma.commercial_onchain_commitments.findFirst({
    where: {
      organization_id: input.organizationId,
      source_agreement_id: input.sourceAgreementId,
      chain_id: XLAYER_TESTNET_CHAIN_ID,
    },
  });

  if (existing) {
    const status = existing.verification_status as OnchainVerificationStatus;
    if (status === 'submitted' || status === 'confirming' || status === 'verified') {
      return toCommitmentRecord(existing as Row);
    }
    const updated = await prisma.commercial_onchain_commitments.update({
      where: { id: existing.id },
      data,
    });
    return toCommitmentRecord(updated as Row);
  }

  const created = await prisma.commercial_onchain_commitments.create({ data });
  return toCommitmentRecord(created as Row);
}

export async function markCommitmentSubmitted(input: {
  organizationId: string;
  id: string;
  transactionHash: string;
  walletAddress: string;
}): Promise<XlayerCommitmentRecord> {
  const updated = await prisma.commercial_onchain_commitments.updateMany({
    where: {
      id: input.id,
      organization_id: input.organizationId,
      verification_status: 'prepared',
    },
    data: {
      transaction_hash: input.transactionHash.toLowerCase(),
      wallet_address: input.walletAddress,
      verification_status: 'submitted',
      chain_id: XLAYER_TESTNET_CHAIN_ID,
    },
  });
  if (updated.count !== 1) {
    throw Object.assign(new Error('Commitment is not prepared for submission'), {
      code: 'NOT_PREPARED',
      status: 409,
    });
  }
  const row = await getCommitmentById({ organizationId: input.organizationId, id: input.id });
  if (!row) {
    throw Object.assign(new Error('Commitment not found'), { code: 'NOT_FOUND', status: 404 });
  }
  return row;
}

export async function saveVerificationResult(input: {
  organizationId: string;
  id: string;
  verificationStatus: OnchainVerificationStatus;
  onchainStatus?: OnchainCommitmentStatus | null;
  blockNumber?: bigint | null;
  explorerUrl?: string | null;
}): Promise<XlayerCommitmentRecord> {
  await prisma.commercial_onchain_commitments.updateMany({
    where: { id: input.id, organization_id: input.organizationId },
    data: {
      verification_status: input.verificationStatus,
      onchain_status: input.onchainStatus ?? undefined,
      block_number: input.blockNumber === undefined ? undefined : input.blockNumber,
      explorer_url: input.explorerUrl === undefined ? undefined : input.explorerUrl,
    },
  });
  const row = await getCommitmentById({ organizationId: input.organizationId, id: input.id });
  if (!row) {
    throw Object.assign(new Error('Commitment not found'), { code: 'NOT_FOUND', status: 404 });
  }
  return row;
}

export async function writeCommitmentAudit(input: {
  organizationId: string;
  userId: string;
  entityId: string;
  action: string;
  values: Record<string, unknown>;
}): Promise<void> {
  await prisma.audit_logs.create({
    data: {
      organization_id: input.organizationId,
      user_id: input.userId,
      entity_type: XLAYER_COMMITMENT_ENTITY_TYPE,
      entity_id: input.entityId,
      action: input.action,
      new_values: input.values as Prisma.InputJsonValue,
    },
  });
}

export { buildXlayerExplorerTxUrl };
