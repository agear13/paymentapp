import type { CryptoVerificationStatus, MatchConfidence } from '@prisma/client';

export type UnifiedVerificationResult = {
  verification_status: CryptoVerificationStatus;
  match_confidence: MatchConfidence;
  verification_issues: string[];
};

type BaseVerificationInput = {
  expectedAmount: number;
  expectedCurrency: string;
  submittedAmount: string;
  submittedCurrency?: string | null;
  expectedDestinationLabel?: string;
  expectedDestinationValue?: string | null;
  submittedDestinationLabel?: string;
  submittedDestinationValue?: string | null;
  submittedReference?: string | null;
  submittedProof?: string | null;
};

function parseFirstNumber(s: string): number | null {
  const m = s.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function currenciesEqual(a: string, b: string): boolean {
  return normalize(a) === normalize(b);
}

export function finalizeVerification(
  issues: string[],
  hardIssueCount: number
): UnifiedVerificationResult {
  const verification_status: CryptoVerificationStatus = hardIssueCount > 0 ? 'FLAGGED' : 'VERIFIED';

  let match_confidence: MatchConfidence;
  if (issues.length === 0) {
    match_confidence = 'HIGH';
  } else if (hardIssueCount > 0 || issues.length >= 3) {
    match_confidence = 'LOW';
  } else {
    match_confidence = 'MEDIUM';
  }

  return {
    verification_status,
    match_confidence,
    verification_issues: issues,
  };
}

/**
 * Shared baseline verification for manual payer-submitted confirmations.
 * Rail-specific verifiers can add extra checks, then call `finalizeVerification`.
 */
export function verifyManualConfirmationBase(input: BaseVerificationInput): UnifiedVerificationResult {
  const issues: string[] = [];
  let hard = 0;

  const parsed = parseFirstNumber(input.submittedAmount);
  if (parsed == null) {
    issues.push('Amount sent is missing or not parseable');
    hard += 1;
  } else {
    const expected = Math.max(0, input.expectedAmount);
    const exactTol = Math.max(0.01, expected * 0.005);
    const softTol = Math.max(0.02, expected * 0.03);
    const diff = Math.abs(parsed - expected);
    if (diff <= exactTol) {
      // exact / near-exact
    } else if (diff <= softTol) {
      issues.push(
        `Amount is close but not exact: expected ${expected} ${input.expectedCurrency}, submitted ${parsed}`
      );
    } else {
      issues.push(
        `Amount mismatch: expected ${expected} ${input.expectedCurrency}, submitted ${parsed}`
      );
      hard += 1;
    }
  }

  const submittedCurrency = input.submittedCurrency?.trim();
  if (!submittedCurrency) {
    issues.push('Currency not provided by payer');
  } else if (!currenciesEqual(input.expectedCurrency, submittedCurrency)) {
    issues.push(
      `Currency mismatch: expected ${input.expectedCurrency}, submitted ${submittedCurrency}`
    );
    hard += 1;
  }

  const expectedDest = input.expectedDestinationValue?.trim();
  const submittedDest = input.submittedDestinationValue?.trim();
  if (expectedDest) {
    if (!submittedDest) {
      issues.push(
        `${input.submittedDestinationLabel ?? 'Destination'} not provided by payer`
      );
    } else if (normalize(expectedDest) !== normalize(submittedDest)) {
      issues.push(
        `${input.expectedDestinationLabel ?? 'Destination'} mismatch: expected "${expectedDest}", submitted "${submittedDest}"`
      );
      hard += 1;
    }
  }

  if (!input.submittedReference?.trim()) {
    issues.push('Reference missing');
  }
  if (!input.submittedProof?.trim()) {
    issues.push('Proof details missing');
  }

  return finalizeVerification(issues, hard);
}

