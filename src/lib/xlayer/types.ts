import type { Hex } from 'viem';
import type { CanonicalIncentiveSnapshot } from '@/lib/xlayer/terms-hash';

export type OnchainCommitmentStatus = 'registered' | 'updated' | 'fulfilled';
export type OnchainVerificationStatus =
  | 'prepared'
  | 'submitted'
  | 'confirming'
  | 'verified'
  | 'failed'
  | 'mismatch';

export type XlayerRegisterArgs = {
  commitmentId: Hex;
  buyerRefHash: Hex;
  supplierRefHash: Hex;
  amountMinorUnits: string;
  sourceCurrency: Hex;
  settlementCurrency: Hex;
  dueDate: number;
  purposeHash: Hex;
  termsHash: Hex;
};

export type XlayerCommitmentRecord = {
  id: string;
  organizationId: string;
  sourceAgreementId: string;
  pilotDealId: string | null;
  displayCommitmentId: string;
  onchainCommitmentId: Hex;
  buyerLabel: string;
  supplierLabel: string;
  amountMinorUnits: number;
  sourceCurrency: string;
  settlementCurrency: string;
  dueDate: string | null;
  purpose: string;
  termsHash: Hex;
  offchainLifecycleStage: string | null;
  onchainStatus: OnchainCommitmentStatus | null;
  verificationStatus: OnchainVerificationStatus;
  chainId: number;
  contractAddress: string;
  walletAddress: string | null;
  transactionHash: string | null;
  blockNumber: string | null;
  explorerUrl: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
  originalDueLabel: string | null;
  incentive: CanonicalIncentiveSnapshot;
  registerArgs: XlayerRegisterArgs;
};

export type XlayerCommitmentPreview = {
  buyerLabel: string;
  supplierLabel: string;
  amountMinorUnits: number;
  sourceCurrency: string;
  settlementCurrency: string;
  dueDate: string | null;
  purpose: string;
  originalDueLabel: string | null;
  incentive: CanonicalIncentiveSnapshot;
};

export type XlayerCommitmentView = {
  enabled: boolean;
  chainId: number;
  chainName: string;
  contractAddress: string | null;
  explorerBaseUrl: string;
  disclaimer: string;
  commitment: XlayerCommitmentRecord | null;
  preview: XlayerCommitmentPreview | null;
};
