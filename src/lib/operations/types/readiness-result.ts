/**
 * Standard shape returned by all readiness derivations in the operations domain.
 * UI and APIs should consume this — never invent parallel readiness types.
 */

export type ReadinessLevel = 'none' | 'partial' | 'ready' | 'blocked' | 'degraded';

export type RecommendedAction = {
  id: string;
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  priority: number;
};

export type OperationalReadinessResult = {
  /** 0–100 deterministic score from fulfilled requirements */
  readinessScore: number;
  readinessLevel: ReadinessLevel;
  blockers: string[];
  warnings: string[];
  missingRequirements: string[];
  nextRecommendedActions: RecommendedAction[];
  /** When true, show continued guidance even if score is high */
  needsGuidance: boolean;
};

export function emptyReadiness(partial?: Partial<OperationalReadinessResult>): OperationalReadinessResult {
  return {
    readinessScore: 0,
    readinessLevel: 'none',
    blockers: [],
    warnings: [],
    missingRequirements: [],
    nextRecommendedActions: [],
    needsGuidance: true,
    ...partial,
  };
}

export function mergeReadiness(
  ...parts: Partial<OperationalReadinessResult>[]
): OperationalReadinessResult {
  const base = emptyReadiness();
  for (const p of parts) {
    if (p.readinessScore != null) base.readinessScore = Math.max(base.readinessScore, p.readinessScore);
    if (p.readinessLevel) base.readinessLevel = p.readinessLevel;
    if (p.blockers) base.blockers.push(...p.blockers);
    if (p.warnings) base.warnings.push(...p.warnings);
    if (p.missingRequirements) base.missingRequirements.push(...p.missingRequirements);
    if (p.nextRecommendedActions) base.nextRecommendedActions.push(...p.nextRecommendedActions);
    if (p.needsGuidance != null) base.needsGuidance = base.needsGuidance || p.needsGuidance;
  }
  base.blockers = [...new Set(base.blockers)];
  base.warnings = [...new Set(base.warnings)];
  base.missingRequirements = [...new Set(base.missingRequirements)];
  return base;
}
