'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import { resolveOperationalWorkspaceCurrency } from '@/lib/currency/resolve-operational-workspace-currency';
import {
  commercialRolesFromDeal,
} from '@/lib/projects/commercial-roles/commercial-roles-payload';
import type { CommercialRole } from '@/lib/projects/commercial-roles/types';
import type { ProjectFundingSourceDto } from '@/lib/projects/funding-sources/types';
import {
  clonePlanningFundingSources,
  clonePlanningRoles,
  deriveScenarioCommercialSnapshot,
  updateFundingSourceAmountInList,
  updateRoleBudgetInList,
  type ScenarioCommercialSnapshot,
  type ScenarioPlanningInput,
} from '@/lib/commercial/scenario-commercial-snapshot';

const TEMP_FUNDING_SOURCE_PREFIX = 'plan-fs-';

export function newPlanningFundingSourceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${TEMP_FUNDING_SOURCE_PREFIX}${crypto.randomUUID()}`;
  }
  return `${TEMP_FUNDING_SOURCE_PREFIX}${Date.now()}`;
}

export type UseProjectPlanningScenarioResult = {
  loading: boolean;
  saving: boolean;
  currency: string;
  scenario: ScenarioCommercialSnapshot | null;
  scenarioRoles: CommercialRole[];
  scenarioFundingSources: ProjectFundingSourceDto[];
  dirty: boolean;
  updateRoleBudget: (roleId: string, budgetValue: number) => void;
  updateFundingAmount: (sourceId: string, amount: number) => void;
  addRole: (role: CommercialRole) => void;
  addFundingSource: (source: ProjectFundingSourceDto) => void;
  discard: () => void;
  save: () => Promise<boolean>;
};

export function useProjectPlanningScenario(): UseProjectPlanningScenarioResult {
  const { projectId, deal, refresh } = useProjectWorkspace();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [baselineRoles, setBaselineRoles] = React.useState<CommercialRole[]>([]);
  const [baselineFundingSources, setBaselineFundingSources] = React.useState<
    ProjectFundingSourceDto[]
  >([]);
  const [scenarioRoles, setScenarioRoles] = React.useState<CommercialRole[]>([]);
  const [scenarioFundingSources, setScenarioFundingSources] = React.useState<
    ProjectFundingSourceDto[]
  >([]);

  const currency = resolveOperationalWorkspaceCurrency({
    projectCurrency: deal?.projectValueCurrency,
  });

  const loadBaseline = React.useCallback(async () => {
    if (!deal) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/funding-sources`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const sources: ProjectFundingSourceDto[] = res.ok
        ? ((await res.json()) as { data?: ProjectFundingSourceDto[] }).data ?? []
        : [];
      const roles = commercialRolesFromDeal(deal);
      setBaselineRoles(roles);
      setBaselineFundingSources(sources);
      setScenarioRoles(clonePlanningRoles(roles));
      setScenarioFundingSources(clonePlanningFundingSources(sources));
    } catch {
      const roles = commercialRolesFromDeal(deal);
      setBaselineRoles(roles);
      setBaselineFundingSources([]);
      setScenarioRoles(clonePlanningRoles(roles));
      setScenarioFundingSources([]);
    } finally {
      setLoading(false);
    }
  }, [deal, projectId]);

  React.useEffect(() => {
    void loadBaseline();
  }, [loadBaseline]);

  const baselineInput = React.useMemo<ScenarioPlanningInput | null>(() => {
    if (!deal) return null;
    return {
      projectId,
      dealId: deal.id,
      commercialRoles: baselineRoles,
      fundingSources: baselineFundingSources,
      currency,
    };
  }, [baselineFundingSources, baselineRoles, currency, deal, projectId]);

  const scenarioInput = React.useMemo<ScenarioPlanningInput | null>(() => {
    if (!deal) return null;
    return {
      projectId,
      dealId: deal.id,
      commercialRoles: scenarioRoles,
      fundingSources: scenarioFundingSources,
      currency,
    };
  }, [currency, deal, projectId, scenarioFundingSources, scenarioRoles]);

  const scenario = React.useMemo(() => {
    if (!baselineInput || !scenarioInput) return null;
    return deriveScenarioCommercialSnapshot(baselineInput, scenarioInput);
  }, [baselineInput, scenarioInput]);

  const updateRoleBudget = React.useCallback((roleId: string, budgetValue: number) => {
    setScenarioRoles((prev) => updateRoleBudgetInList(prev, roleId, budgetValue));
  }, []);

  const updateFundingAmount = React.useCallback((sourceId: string, amount: number) => {
    setScenarioFundingSources((prev) => updateFundingSourceAmountInList(prev, sourceId, amount));
  }, []);

  const addRole = React.useCallback((role: CommercialRole) => {
    setScenarioRoles((prev) => [...prev, role]);
  }, []);

  const addFundingSource = React.useCallback((source: ProjectFundingSourceDto) => {
    setScenarioFundingSources((prev) => [...prev, source]);
  }, []);

  const discard = React.useCallback(() => {
    setScenarioRoles(clonePlanningRoles(baselineRoles));
    setScenarioFundingSources(clonePlanningFundingSources(baselineFundingSources));
  }, [baselineFundingSources, baselineRoles]);

  const save = React.useCallback(async (): Promise<boolean> => {
    if (!deal || !scenario?.dirty) return true;
    setSaving(true);
    try {
      const rolesRes = await fetch(
        `/api/deal-network-pilot/deals/${encodeURIComponent(projectId)}/commercial-roles`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ commercialRoles: scenarioRoles }),
        }
      );
      if (!rolesRes.ok) throw new Error('Failed to save budgeted roles');

      for (const source of scenarioFundingSources) {
        const baseline = baselineFundingSources.find((s) => s.id === source.id);
        if (baseline && baseline.amount === source.amount) continue;

        if (source.id.startsWith(TEMP_FUNDING_SOURCE_PREFIX)) {
          const postRes = await fetch(
            `/api/projects/${encodeURIComponent(projectId)}/funding-sources`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: source.name,
                description: source.description,
                sourceType: source.sourceType,
                amount: source.amount,
                currency: source.currency,
                status: source.status,
                confidenceLevel: source.confidenceLevel,
                expectedSettlementDate: source.expectedSettlementDate,
                notes: source.notes,
              }),
            }
          );
          if (!postRes.ok) throw new Error('Failed to save revenue source');
        } else {
          const patchRes = await fetch(
            `/api/projects/${encodeURIComponent(projectId)}/funding-sources/${encodeURIComponent(source.id)}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ amount: source.amount }),
            }
          );
          if (!patchRes.ok) throw new Error('Failed to update revenue source');
        }
      }

      await refresh({ scope: 'summary', silent: true, force: true });
      await loadBaseline();
      toast.success('Planning scenario saved');
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save scenario');
      return false;
    } finally {
      setSaving(false);
    }
  }, [
    baselineFundingSources,
    deal,
    loadBaseline,
    projectId,
    refresh,
    scenario?.dirty,
    scenarioFundingSources,
    scenarioRoles,
  ]);

  return {
    loading,
    saving,
    currency,
    scenario,
    scenarioRoles,
    scenarioFundingSources,
    dirty: scenario?.dirty ?? false,
    updateRoleBudget,
    updateFundingAmount,
    addRole,
    addFundingSource,
    discard,
    save,
  };
}
