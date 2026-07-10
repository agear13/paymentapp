/**
 * Scenario Commercial Snapshot
 *
 * Wraps CommercialFinancialSnapshot with baseline vs scenario comparison.
 * All forecast math flows through deriveCommercialFinancialSnapshot — no duplicate logic.
 */

import type { BriefingObligationRowInput } from '@/lib/agreements/agreement-briefing.model';
import type { CommercialHealthLevel } from '@/lib/commercial/commercial-health';
import {
  commercialRolesToObligationRows,
  sumFixedRoleBudgets,
} from '@/lib/commercial/commercial-roles-to-obligation-rows';
import {
  deriveCommercialFinancialSnapshot,
  type CommercialFinancialSnapshot,
} from '@/lib/commercial/commercial-financial-snapshot';
import { formatForecastAmount } from '@/lib/commercial/commercial-forecast';
import type { CommercialRole } from '@/lib/projects/commercial-roles/types';
import type { ProjectFundingSourceDto } from '@/lib/projects/funding-sources/types';
import { formatCommercialRoleBudget } from '@/lib/projects/commercial-roles/format-commercial-role';

export type ScenarioPlanningInput = {
  projectId: string;
  dealId: string;
  commercialRoles: CommercialRole[];
  fundingSources: ProjectFundingSourceDto[];
  currency: string;
};

export type ScenarioDiffEntry = {
  id: string;
  label: string;
  before: string;
  after: string;
  deltaLabel?: string;
};

export type ScenarioCommercialSnapshot = {
  baseline: CommercialFinancialSnapshot;
  scenario: CommercialFinancialSnapshot;
  dirty: boolean;
  diff: ScenarioDiffEntry[];
  insights: string[];
  riskSummary: ScenarioRiskSummary[];
};

export type ScenarioRiskSummary = {
  label: string;
  impact: string;
};

function planningRevenueTotal(sources: ProjectFundingSourceDto[]): number {
  return sources.reduce((sum, s) => sum + s.amount, 0);
}

function derivePlanningSnapshot(input: ScenarioPlanningInput): CommercialFinancialSnapshot {
  const { projectId, dealId, commercialRoles, fundingSources, currency } = input;
  const expectedRevenue = planningRevenueTotal(fundingSources);
  const obligationRows = commercialRolesToObligationRows(
    commercialRoles,
    expectedRevenue,
    dealId,
    currency
  );

  return deriveCommercialFinancialSnapshot({
    projectId,
    dealId,
    fundingSources,
    treasury: null,
    obligationRows,
    releaseConfidence: null,
    currency,
    kpis: null,
    decision: null,
  });
}

export function deriveScenarioCommercialSnapshot(
  baselineInput: ScenarioPlanningInput,
  scenarioInput: ScenarioPlanningInput
): ScenarioCommercialSnapshot {
  const baseline = derivePlanningSnapshot(baselineInput);
  const scenario = derivePlanningSnapshot(scenarioInput);

  const dirty =
    JSON.stringify(baselineInput.commercialRoles) !==
      JSON.stringify(scenarioInput.commercialRoles) ||
    JSON.stringify(baselineInput.fundingSources) !==
      JSON.stringify(scenarioInput.fundingSources);

  const diff = buildScenarioDiff(baselineInput, scenarioInput, baseline, scenario);
  const riskSummary = buildRiskSummary(baseline, scenario, diff, baselineInput.currency);
  const insights = buildPlanningInsights(
    baselineInput,
    scenarioInput,
    baseline,
    scenario,
    diff,
    baselineInput.currency
  );

  return { baseline, scenario, dirty, diff, insights, riskSummary };
}

function healthLevelLabel(level: CommercialHealthLevel): string {
  const labels: Record<CommercialHealthLevel, string> = {
    excellent: 'Excellent',
    good: 'Healthy',
    attention: 'Needs attention',
    at_risk: 'At risk',
    blocked: 'Blocked',
  };
  return labels[level];
}

function buildScenarioDiff(
  baselineInput: ScenarioPlanningInput,
  scenarioInput: ScenarioPlanningInput,
  baseline: CommercialFinancialSnapshot,
  scenario: CommercialFinancialSnapshot
): ScenarioDiffEntry[] {
  const entries: ScenarioDiffEntry[] = [];
  const currency = baselineInput.currency;

  const baseRevenue = planningRevenueTotal(baselineInput.fundingSources);
  const scenRevenue = planningRevenueTotal(scenarioInput.fundingSources);
  if (baseRevenue !== scenRevenue) {
    entries.push({
      id: 'revenue-total',
      label: 'Revenue',
      before: formatForecastAmount(baseRevenue, currency),
      after: formatForecastAmount(scenRevenue, currency),
      deltaLabel:
        scenRevenue - baseRevenue >= 0
          ? `+${formatForecastAmount(scenRevenue - baseRevenue, currency)}`
          : formatForecastAmount(scenRevenue - baseRevenue, currency),
    });
  }

  for (const scenRole of scenarioInput.commercialRoles) {
    const baseRole = baselineInput.commercialRoles.find((r) => r.id === scenRole.id);
    if (!baseRole || baseRole.budgetValue === scenRole.budgetValue) continue;
    entries.push({
      id: `role-${scenRole.id}`,
      label: scenRole.title,
      before: formatCommercialRoleBudget(baseRole, currency),
      after: formatCommercialRoleBudget(scenRole, currency),
    });
  }

  const baseSurplus = baseline.forecast.forecastPosition.forecastSurplus;
  const scenSurplus = scenario.forecast.forecastPosition.forecastSurplus;
  if (baseSurplus !== scenSurplus) {
    entries.push({
      id: 'forecast-surplus',
      label: 'Forecast',
      before: (baseSurplus >= 0 ? '+' : '') + formatForecastAmount(baseSurplus, currency),
      after: (scenSurplus >= 0 ? '+' : '') + formatForecastAmount(scenSurplus, currency),
      deltaLabel:
        scenSurplus - baseSurplus >= 0
          ? `+${formatForecastAmount(scenSurplus - baseSurplus, currency)}`
          : formatForecastAmount(scenSurplus - baseSurplus, currency),
    });
  }

  if (baseline.health.level !== scenario.health.level) {
    entries.push({
      id: 'commercial-health',
      label: 'Commercial health',
      before: healthLevelLabel(baseline.health.level),
      after: healthLevelLabel(scenario.health.level),
    });
  }

  const baseConf = baseline.forecast.overallConfidence.score;
  const scenConf = scenario.forecast.overallConfidence.score;
  if (baseConf !== scenConf) {
    entries.push({
      id: 'confidence',
      label: 'Commercial confidence',
      before: `${baseConf}%`,
      after: `${scenConf}%`,
    });
  }

  return entries;
}

function buildRiskSummary(
  baseline: CommercialFinancialSnapshot,
  scenario: CommercialFinancialSnapshot,
  diff: ScenarioDiffEntry[],
  currency: string
): ScenarioRiskSummary[] {
  const items: ScenarioRiskSummary[] = [];
  const surplusDelta =
    scenario.forecast.forecastPosition.forecastSurplus -
    baseline.forecast.forecastPosition.forecastSurplus;

  for (const entry of diff) {
    if (entry.id.startsWith('role-')) {
      items.push({
        label: `${entry.label} cost changed`,
        impact: `${entry.before} → ${entry.after}`,
      });
    }
  }

  if (surplusDelta !== 0) {
    items.push({
      label: 'Forecast surplus changed',
      impact:
        surplusDelta >= 0
          ? `+${formatForecastAmount(surplusDelta, currency)}`
          : formatForecastAmount(surplusDelta, currency),
    });
  }

  const confDelta =
    scenario.forecast.overallConfidence.score - baseline.forecast.overallConfidence.score;
  if (confDelta !== 0) {
    items.push({
      label: 'Commercial confidence',
      impact: `${baseline.forecast.overallConfidence.score}% → ${scenario.forecast.overallConfidence.score}%`,
    });
  }

  return items;
}

function buildPlanningInsights(
  baselineInput: ScenarioPlanningInput,
  scenarioInput: ScenarioPlanningInput,
  baseline: CommercialFinancialSnapshot,
  scenario: CommercialFinancialSnapshot,
  diff: ScenarioDiffEntry[],
  currency: string
): string[] {
  const insights: string[] = [];
  const surplusDelta =
    scenario.forecast.forecastPosition.forecastSurplus -
    baseline.forecast.forecastPosition.forecastSurplus;
  const scenSurplus = scenario.forecast.forecastPosition.forecastSurplus;

  for (const entry of diff) {
    if (!entry.id.startsWith('role-')) continue;
    const roleId = entry.id.replace('role-', '');
    const baseRole = baselineInput.commercialRoles.find((r) => r.id === roleId);
    const scenRole = scenarioInput.commercialRoles.find((r) => r.id === roleId);
    if (!baseRole || !scenRole) continue;
    const increased = scenRole.budgetValue > baseRole.budgetValue;
    if (surplusDelta < 0) {
      insights.push(
        `${increased ? 'Increasing' : 'Changing'} the ${entry.label} budget reduces forecast surplus by ${formatForecastAmount(Math.abs(surplusDelta), currency)}.`
      );
    }
  }

  if (scenSurplus < 0) {
    const shortfall = Math.abs(scenSurplus);
    insights.push(
      'This project will no longer generate enough revenue to cover all fixed obligations.'
    );
    insights.push(
      `Recommended: increase ticket sales by approximately ${formatForecastAmount(shortfall, currency)}, or reduce fixed commitments.`
    );
  } else if (surplusDelta < 0 && scenSurplus >= 0) {
    insights.push('The project remains commercially viable under this scenario.');
  } else if (diff.length === 0) {
    insights.push('Adjust revenue sources or budgeted roles to explore different outcomes.');
  }

  if (
    !scenario.forecast.cashReadiness.canEveryoneBePaid &&
    scenario.forecast.cashReadiness.primaryBlocker
  ) {
    insights.push(scenario.forecast.cashReadiness.primaryBlocker);
  }

  return insights.slice(0, 4);
}

/** Shallow clone helpers for local scenario state. */
export function clonePlanningRoles(roles: CommercialRole[]): CommercialRole[] {
  return roles.map((r) => ({ ...r }));
}

export function clonePlanningFundingSources(
  sources: ProjectFundingSourceDto[]
): ProjectFundingSourceDto[] {
  return sources.map((s) => ({ ...s }));
}

export function updateRoleBudgetInList(
  roles: CommercialRole[],
  roleId: string,
  budgetValue: number
): CommercialRole[] {
  return roles.map((r) => (r.id === roleId ? { ...r, budgetValue } : r));
}

export function updateFundingSourceAmountInList(
  sources: ProjectFundingSourceDto[],
  sourceId: string,
  amount: number
): ProjectFundingSourceDto[] {
  return sources.map((s) => (s.id === sourceId ? { ...s, amount } : s));
}

export { sumFixedRoleBudgets, planningRevenueTotal };
