import type {
  ProjectFundingConfidenceLevel,
  ProjectFundingSourceStatus,
} from '@prisma/client';

/** Normalize legacy uppercase API values to Prisma enum casing. */
export function normalizeFundingSourceStatus(
  status: ProjectFundingSourceStatus | string
): ProjectFundingSourceStatus {
  return status.toLowerCase() as ProjectFundingSourceStatus;
}

export function normalizeFundingConfidenceLevel(
  level: ProjectFundingConfidenceLevel | string
): ProjectFundingConfidenceLevel {
  return level.toLowerCase() as ProjectFundingConfidenceLevel;
}

export function isFundingConfirmed(
  status: ProjectFundingSourceStatus | string
): boolean {
  const normalized = normalizeFundingSourceStatus(status);
  return (
    normalized === 'confirmed' ||
    normalized === 'cleared' ||
    normalized === 'reconciled'
  );
}

export function isFundingPending(status: ProjectFundingSourceStatus | string): boolean {
  return normalizeFundingSourceStatus(status) === 'pending';
}

export function isFundingForecast(status: ProjectFundingSourceStatus | string): boolean {
  return normalizeFundingSourceStatus(status) === 'forecast';
}

export function isHighFundingConfidence(
  level: ProjectFundingConfidenceLevel | string
): boolean {
  return normalizeFundingConfidenceLevel(level) === 'high';
}

export function isMediumFundingConfidence(
  level: ProjectFundingConfidenceLevel | string
): boolean {
  return normalizeFundingConfidenceLevel(level) === 'medium';
}
