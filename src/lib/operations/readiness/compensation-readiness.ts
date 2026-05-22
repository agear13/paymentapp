import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  deriveParticipantCapabilityFlags,
  safeCompensationState,
} from '@/lib/operations/guards/hydration-guards';
import type { OperationalReadinessResult } from '@/lib/operations/types/readiness-result';
import { emptyReadiness } from '@/lib/operations/types/readiness-result';

export function deriveCompensationReadiness(
  participant: DemoParticipant | null | undefined
): OperationalReadinessResult {
  const state = safeCompensationState(participant);
  const caps = deriveParticipantCapabilityFlags(participant);
  if (state === 'CONFIGURED') {
    return emptyReadiness({
      readinessScore: 100,
      readinessLevel: 'ready',
      needsGuidance: false,
    });
  }
  const missing = ['Compensation structure missing'];
  if (state === 'DRAFT') missing.push('Compensation draft not saved');
  return emptyReadiness({
    readinessScore: caps.hasIdentity ? 25 : 0,
    readinessLevel: 'partial',
    blockers: missing,
    missingRequirements: missing,
    needsGuidance: true,
  });
}
