import { countsTowardPresent, isApplicable } from '@/lib/business-passport/match-requirements';
import {
  INFORMATION_READINESS_DISCLAIMER,
  type RailOnboardingReadiness,
  type RequirementMatch,
} from '@/lib/business-passport/types';

export function calculateReadiness(input: {
  organizationId: string;
  offeringId: string;
  offeringLabel: string;
  providerName: string;
  rows: RequirementMatch[];
  notes?: string[];
  assessedAt?: string;
}): RailOnboardingReadiness {
  const applicable = input.rows.filter((row) => isApplicable(row.status));
  const present = applicable.filter((row) => countsTowardPresent(row.status));
  const unknown = input.rows.filter((row) => row.status === 'unknown');
  const percent =
    applicable.length === 0 ? 0 : Math.round((present.length / applicable.length) * 100);

  return {
    organizationId: input.organizationId,
    offeringId: input.offeringId,
    offeringLabel: input.offeringLabel,
    providerName: input.providerName,
    percent,
    presentCount: present.length,
    applicableCount: applicable.length,
    unknownCount: unknown.length,
    rows: input.rows,
    complete: present,
    stillRequired: input.rows.filter((row) => row.status === 'missing'),
    notAssessed: unknown,
    notes: input.notes ?? [],
    disclaimer: INFORMATION_READINESS_DISCLAIMER,
    assessedAt: input.assessedAt ?? new Date().toISOString(),
  };
}
