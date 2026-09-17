import {
  encodeAbiParameters,
  keccak256,
  pad,
  stringToHex,
  toBytes,
  type Hex,
} from 'viem';
import { XLAYER_COMMITMENT_DOMAIN } from '@/lib/xlayer/chain';

export type CanonicalIncentiveSnapshot = {
  status: 'approved';
  policyId: string;
  acceleratedDays: number;
  incentivePercent: number;
  compensationType: string;
} | null;

export type CanonicalCommitmentTerms = {
  sourceAgreementId: string;
  amountMinorUnits: number;
  sourceCurrency: string;
  settlementCurrency: string;
  dueDateUnix: number;
  purpose: string;
  incentive: CanonicalIncentiveSnapshot;
};

export function hashUtf8(value: string): Hex {
  return keccak256(toBytes(value));
}

export function stringToBytes32(value: string): Hex {
  const trimmed = value.trim();
  const asHex = stringToHex(trimmed);
  if ((asHex.length - 2) / 2 > 32) {
    return hashUtf8(trimmed);
  }
  return pad(asHex, { size: 32, dir: 'right' });
}

export function computeCommitmentId(organizationId: string, agreementId: string): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: 'string' }, { type: 'string' }, { type: 'string' }],
      [organizationId, agreementId, XLAYER_COMMITMENT_DOMAIN]
    )
  );
}

function incentiveKey(incentive: CanonicalIncentiveSnapshot): string {
  if (!incentive) return 'none';
  return [
    incentive.status,
    incentive.policyId,
    String(incentive.acceleratedDays),
    String(incentive.incentivePercent),
    incentive.compensationType,
  ].join(':');
}

export function computeTermsHash(terms: CanonicalCommitmentTerms): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'string' },
        { type: 'string' },
        { type: 'uint256' },
        { type: 'string' },
        { type: 'string' },
        { type: 'uint64' },
        { type: 'string' },
        { type: 'string' },
      ],
      [
        XLAYER_COMMITMENT_DOMAIN,
        terms.sourceAgreementId,
        BigInt(terms.amountMinorUnits),
        terms.sourceCurrency,
        terms.settlementCurrency,
        BigInt(terms.dueDateUnix),
        terms.purpose,
        incentiveKey(terms.incentive),
      ]
    )
  );
}

export function displayCommitmentId(onchainCommitmentId: Hex): string {
  return onchainCommitmentId.slice(0, 12);
}
