'use client';

/**
 * Project Planning View
 *
 * Commercial forecasting workspace — local scenario state with instant recalculation.
 * All forecast math flows through deriveCommercialFinancialSnapshot via ScenarioCommercialSnapshot.
 */

import * as React from 'react';
import {
  ArrowDown,
  Lightbulb,
  Minus,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CommercialPositionCards } from '@/components/operations/commercial-position-cards';
import { AddCommercialRoleDialog } from '@/components/projects/add-commercial-role-dialog';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import {
  useProjectPlanningScenario,
  newPlanningFundingSourceId,
} from '@/hooks/use-project-planning-scenario';
import {
  formatForecastAmount,
  formatForecastBalance,
} from '@/lib/commercial/commercial-forecast';
import { planningRevenueTotal } from '@/lib/commercial/scenario-commercial-snapshot';
import { commercialRoleBudgetTypeLabel } from '@/lib/projects/commercial-roles/format-commercial-role';
import type { CommercialRole } from '@/lib/projects/commercial-roles/types';
import type { ProjectFundingSourceDto } from '@/lib/projects/funding-sources/types';
import { PRODUCT_TERMINOLOGY } from '@/lib/product/product-terminology';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { CommercialTimingSection } from '@/components/projects/commercial-timing-section';

export function ProjectPlanningView() {
  const { summary, projectId, allDeals } = useProjectWorkspace();
  const planning = useProjectPlanningScenario();
  const [addRoleOpen, setAddRoleOpen] = React.useState(false);

  if (!summary) return null;

  const snapshot = planning.scenario?.scenario ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{summary.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">{PRODUCT_TERMINOLOGY.planning}</p>
      </div>

      {planning.dirty && (
        <ScenarioBanner
          saving={planning.saving}
          onDiscard={planning.discard}
          onSave={() => void planning.save()}
        />
      )}

      <CommercialPositionCards
        snapshot={snapshot}
        loading={planning.loading}
        projectId={projectId}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6 min-w-0">
          <CommercialStorySection planning={planning} onAddRole={() => setAddRoleOpen(true)} />
          <CommercialTimingSection
            timing={planning.scenarioCommercialTiming}
            onChange={planning.updateCommercialTiming}
            disabled={planning.saving}
          />
          <RiskSimulatorSection planning={planning} />
          <PlanningInsightsSection planning={planning} />
        </div>

        <ScenarioSummarySidebar planning={planning} />
      </div>

      <AddCommercialRoleDialog
        projectId={projectId}
        allDeals={allDeals}
        open={addRoleOpen}
        onOpenChange={setAddRoleOpen}
        onSave={async (nextDeals) => {
          const nextDeal = nextDeals.find((d) => d.id === projectId);
          const role = nextDeal?.commercialRoles?.at(-1);
          if (role) planning.addRole(role);
          setAddRoleOpen(false);
          return true;
        }}
        onCreated={() => toast.success(PRODUCT_TERMINOLOGY.budgetedRoleAdded)}
      />
    </div>
  );
}

/* ─── Scenario banner ─────────────────────────────────────────────────────── */

function ScenarioBanner({
  saving,
  onDiscard,
  onSave,
}: {
  saving: boolean;
  onDiscard: () => void;
  onSave: () => void;
}) {
  return (
    <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <div>
        <p className="text-sm font-semibold text-foreground">
          Scenario · {PRODUCT_TERMINOLOGY.scenarioUnsavedChanges}
        </p>
        <p className="text-sm text-muted-foreground mt-0.5">
          {PRODUCT_TERMINOLOGY.scenarioSimulationHint}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button type="button" variant="outline" size="sm" onClick={onDiscard} disabled={saving}>
          {PRODUCT_TERMINOLOGY.discardScenario}
        </Button>
        <Button type="button" size="sm" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : PRODUCT_TERMINOLOGY.saveScenario}
        </Button>
      </div>
    </div>
  );
}

/* ─── Commercial story ──────────────────────────────────────────────────────── */

type PlanningApi = ReturnType<typeof useProjectPlanningScenario>;

function CommercialStorySection({
  planning,
  onAddRole,
}: {
  planning: PlanningApi;
  onAddRole: () => void;
}) {
  const [editingRevenue, setEditingRevenue] = React.useState(false);
  const [editingRoles, setEditingRoles] = React.useState(false);

  const revenueTotal = planningRevenueTotal(planning.scenarioFundingSources);
  const forecast = planning.scenario?.scenario.forecast;
  const obligationsTotal = forecast?.forecastPosition.totalCommitments ?? 0;
  const surplus = forecast?.forecastPosition.forecastSurplus ?? 0;
  const currency = planning.currency;

  const roleNames = planning.scenarioRoles.map((r) => r.title).slice(0, 4);
  const roleNamesLabel =
    roleNames.length > 0
      ? roleNames.join(', ') + (planning.scenarioRoles.length > 4 ? '…' : '')
      : 'None yet';

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-foreground">{PRODUCT_TERMINOLOGY.commercialStory}</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <StoryCard
          title={PRODUCT_TERMINOLOGY.revenueSources}
          summary={
            planning.scenarioFundingSources.length > 0
              ? `${planning.scenarioFundingSources.length} planned invoice${planning.scenarioFundingSources.length !== 1 ? 's' : ''}`
              : 'No revenue sources'
          }
          total={formatForecastAmount(revenueTotal, currency)}
          editing={editingRevenue}
          onEditToggle={() => setEditingRevenue((v) => !v)}
        >
          <RevenueSourcesEditor
            sources={planning.scenarioFundingSources}
            currency={currency}
            onAmountChange={planning.updateFundingAmount}
            onAdd={() => {
              const source: ProjectFundingSourceDto = {
                id: newPlanningFundingSourceId(),
                projectId: '',
                organizationId: null,
                name: 'Expected revenue',
                description: null,
                sourceType: 'manual_forecast',
                amount: 0,
                currency,
                status: 'forecast',
                confidenceLevel: 'medium',
                expectedSettlementDate: null,
                actualSettlementDate: null,
                linkedInvoiceId: null,
                linkedPaymentId: null,
                notes: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              planning.addFundingSource(source);
            }}
          />
        </StoryCard>

        <StoryCard
          title={PRODUCT_TERMINOLOGY.budgetedRoles}
          summary={roleNamesLabel}
          total={formatForecastAmount(obligationsTotal, currency)}
          editing={editingRoles}
          onEditToggle={() => setEditingRoles((v) => !v)}
        >
          <BudgetedRolesEditor
            roles={planning.scenarioRoles}
            currency={currency}
            onBudgetChange={planning.updateRoleBudget}
            onAddRole={onAddRole}
          />
        </StoryCard>

        <StoryCard
          title={PRODUCT_TERMINOLOGY.expectedObligations}
          summary={
            planning.scenarioRoles.length > 0
              ? `${planning.scenarioRoles.length} budgeted role${planning.scenarioRoles.length !== 1 ? 's' : ''}`
              : 'No obligations modeled'
          }
          total={formatForecastAmount(obligationsTotal, currency)}
          editing={false}
          onEditToggle={() => {}}
          hideEdit
        />

        <Card className="border-border/60 sm:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Commercial Position</CardTitle>
            <CardDescription className="text-xs">Expected revenue minus expected obligations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Expected Revenue</p>
                <p className="text-lg font-bold tabular-nums">
                  {formatForecastAmount(revenueTotal, currency)}
                </p>
              </div>
              <Minus className="h-4 w-4 text-muted-foreground" />
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Expected Obligations</p>
                <p className="text-lg font-bold tabular-nums">
                  {formatForecastAmount(obligationsTotal, currency)}
                </p>
              </div>
              <span className="text-muted-foreground">=</span>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">{PRODUCT_TERMINOLOGY.forecastSurplus}</p>
                <p
                  className={cn(
                    'text-lg font-bold tabular-nums',
                    surplus >= 0 ? 'text-green-700' : 'text-red-600'
                  )}
                >
                  {formatForecastBalance(surplus, currency)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StoryCard({
  title,
  summary,
  total,
  editing,
  onEditToggle,
  hideEdit,
  children,
}: {
  title: string;
  summary: string;
  total: string;
  editing: boolean;
  onEditToggle: () => void;
  hideEdit?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            <CardDescription className="text-xs mt-0.5">{summary}</CardDescription>
          </div>
          {!hideEdit && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs shrink-0"
              onClick={onEditToggle}
            >
              <Pencil className="h-3 w-3 mr-1" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xl font-bold tabular-nums">{total}</p>
        {editing && children}
      </CardContent>
    </Card>
  );
}

function RevenueSourcesEditor({
  sources,
  currency,
  onAmountChange,
  onAdd,
}: {
  sources: ProjectFundingSourceDto[];
  currency: string;
  onAmountChange: (id: string, amount: number) => void;
  onAdd: () => void;
}) {
  return (
    <div className="space-y-2 pt-1 border-t border-border/40">
      {sources.map((source) => (
        <div key={source.id} className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground flex-1 truncate">{source.name}</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">{currency}</span>
            <Input
              type="number"
              min={0}
              step={100}
              className="h-8 w-28 text-sm tabular-nums"
              value={source.amount || ''}
              onChange={(e) => onAmountChange(source.id, Number(e.target.value) || 0)}
            />
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onAdd}>
        Add revenue source
      </Button>
    </div>
  );
}

function BudgetedRolesEditor({
  roles,
  currency,
  onBudgetChange,
  onAddRole,
}: {
  roles: CommercialRole[];
  currency: string;
  onBudgetChange: (roleId: string, value: number) => void;
  onAddRole: () => void;
}) {
  if (roles.length === 0) {
    return (
      <div className="space-y-2 pt-1 border-t border-border/40">
        <p className="text-xs text-muted-foreground">
          {PRODUCT_TERMINOLOGY.noBudgetedRolesYet}
        </p>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onAddRole}>
          {PRODUCT_TERMINOLOGY.addBudgetedRole}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 pt-1 border-t border-border/40">
      {roles.map((role) => (
        <div key={role.id} className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{role.title}</p>
            <p className="text-[10px] text-muted-foreground">
              {commercialRoleBudgetTypeLabel(role.budgetType)}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {role.budgetType === 'FIXED' ? (
              <>
                <span className="text-xs text-muted-foreground">{currency}</span>
                <Input
                  type="number"
                  min={0}
                  step={50}
                  className="h-8 w-24 text-sm tabular-nums"
                  value={role.budgetValue || ''}
                  onChange={(e) => onBudgetChange(role.id, Number(e.target.value) || 0)}
                />
              </>
            ) : (
              <>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  className="h-8 w-16 text-sm tabular-nums"
                  value={role.budgetValue || ''}
                  onChange={(e) => onBudgetChange(role.id, Number(e.target.value) || 0)}
                />
                <span className="text-xs text-muted-foreground">%</span>
              </>
            )}
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onAddRole}>
        {PRODUCT_TERMINOLOGY.addBudgetedRole}
      </Button>
    </div>
  );
}

/* ─── Risk simulator ──────────────────────────────────────────────────────── */

function RiskSimulatorSection({ planning }: { planning: PlanningApi }) {
  const risks = planning.scenario?.riskSummary ?? [];
  if (risks.length === 0 && !planning.dirty) return null;

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
      <p className="text-sm font-semibold text-foreground">{PRODUCT_TERMINOLOGY.riskSimulator}</p>
      {risks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No changes to simulate yet.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            What changed?
          </p>
          {risks.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-sm gap-2">
              <span className="text-foreground">{item.label}</span>
              <Badge variant="outline" className="tabular-nums shrink-0">
                {item.impact}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Planning insights ─────────────────────────────────────────────────────── */

function PlanningInsightsSection({ planning }: { planning: PlanningApi }) {
  const insights = planning.scenario?.insights ?? [];
  if (insights.length === 0) return null;

  return (
    <div className="rounded-xl border border-[rgba(124,92,255,0.15)] bg-[rgba(124,92,255,0.03)] p-5 space-y-3">
      <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
        <Lightbulb className="h-4 w-4 text-[rgb(124,92,255)]" />
        {PRODUCT_TERMINOLOGY.planningInsights}
      </p>
      <ul className="space-y-2">
        {insights.map((line, i) => (
          <li key={i} className="text-sm text-muted-foreground leading-relaxed">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Scenario sidebar ─────────────────────────────────────────────────────── */

function ScenarioSummarySidebar({ planning }: { planning: PlanningApi }) {
  const diff = planning.scenario?.diff ?? [];

  return (
    <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
      <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {PRODUCT_TERMINOLOGY.scenarioSummary}
        </p>

        {planning.loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : diff.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Edit assumptions to see a before → after summary.
          </p>
        ) : (
          <div className="space-y-3">
            {diff.map((entry) => (
              <div key={entry.id} className="space-y-1">
                <p className="text-xs font-medium text-foreground">{entry.label}</p>
                <div className="flex items-center gap-1.5 text-sm tabular-nums">
                  <span className="text-muted-foreground">{entry.before}</span>
                  <ArrowDown className="h-3 w-3 text-muted-foreground rotate-[-90deg]" />
                  <span
                    className={cn(
                      'font-semibold',
                      entry.id === 'forecast-surplus' && entry.after.startsWith('-')
                        ? 'text-red-600'
                        : 'text-foreground'
                    )}
                  >
                    {entry.after}
                  </span>
                </div>
                {entry.deltaLabel && (
                  <p className="text-[10px] text-muted-foreground">{entry.deltaLabel}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
