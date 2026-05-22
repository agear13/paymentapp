/**
 * Unified operational completeness — cross-entity rollup for workspace/project surfaces.
 */

export type CompletenessLine = {
  id: string;
  label: string;
  complete: boolean;
  warning?: boolean;
};

export type OperationalCompleteness = {
  setupComplete: boolean;
  fundingReady: boolean;
  payoutReady: boolean;
  releaseReady: boolean;
  settlementReady: boolean;
  blockers: string[];
  warnings: string[];
  missingRequirements: string[];
};

export function defaultOperationalCompleteness(): OperationalCompleteness {
  return {
    setupComplete: false,
    fundingReady: false,
    payoutReady: false,
    releaseReady: false,
    settlementReady: false,
    blockers: [],
    warnings: [],
    missingRequirements: [],
  };
}
