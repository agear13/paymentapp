import {
  assertProjectableSnapshotInvariants,
  assertReleaseCapabilityInvariants,
  assertOperationalCurrencyInvariants,
  assertOperationalReadinessInvariants,
} from '@/lib/operations/dev/operational-invariants';

export { assertReleaseCapabilityInvariants as assertReleaseCapabilityCompliance };
export { assertOperationalCurrencyInvariants as assertOperationalCurrencyConsistency };

export function validateProjectableOperationalSnapshot(input: {
  summaryPresent?: boolean;
  fundingPresent?: boolean;
}): void {
  assertProjectableSnapshotInvariants(input);
}

export function validateOperationalReadiness(input: Parameters<typeof assertOperationalReadinessInvariants>[0]): void {
  assertOperationalReadinessInvariants(input);
}
