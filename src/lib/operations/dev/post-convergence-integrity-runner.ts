import {
  assertPostConvergenceIntegrity,
  collectPostConvergenceIntegrityViolations,
} from '@/lib/operations/dev/assert-post-convergence-integrity';
import type { PostConvergenceIntegrityInput } from '@/lib/operations/dev/post-convergence-integrity-types';
import { emitOperationalTelemetry } from '@/lib/operations/telemetry/operational-telemetry';

/** Downstream observer — emits telemetry then delegates to pure validation. */
export function runPostConvergenceIntegrityCheck(input: PostConvergenceIntegrityInput): void {
  const violations = collectPostConvergenceIntegrityViolations(input);
  for (const violation of violations) {
    emitOperationalTelemetry({
      type: 'post_convergence_assertion_failure',
      code: violation.code,
      mutation: input.mutation,
      message: violation.message,
    });
    emitOperationalTelemetry({
      type: 'cross_surface_mismatch',
      code: violation.code,
      mutation: input.mutation,
      surface: input.surface ?? null,
      detail: { message: violation.message },
    });
  }
  assertPostConvergenceIntegrity(input);
}
