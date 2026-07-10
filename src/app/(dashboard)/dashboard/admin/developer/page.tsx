'use client';

/**
 * Developer Control Centre
 *
 * Single testing environment for the entire Commercial OS.
 *
 * Allows developers to simulate any subscription tier, business maturity,
 * payment provider state, or Commercial OS workflow stage in one click —
 * without creating multiple accounts, completing onboarding, or touching
 * the database.
 *
 * Architecture:
 *   This page writes overrides to localStorage (DevSimulatorStore).
 *   CommercialBrainProvider on any project page reads those overrides and
 *   merges them into the engine output. The engine itself is never bypassed.
 *
 * Access: NODE_ENV === 'development' OR admin email (see layout.tsx).
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  ExternalLink,
  Layers,
  RefreshCw,
  RotateCcw,
  Settings2,
  Sparkles,
  Terminal,
  Users,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { PRODUCT_TERMINOLOGY } from '@/lib/product/product-terminology';
import { useDevSimulator } from '@/components/dev/simulator-store';
import { SIMULATOR_SCENARIOS } from '@/lib/dev/simulator-scenarios';
import type { DevSimulatorState, SimulatorAuditEventType, SimulatorPlan } from '@/lib/dev/simulator-types';
import { EMPTY_SIMULATOR_STATE } from '@/lib/dev/simulator-types';
import type { CommercialCapabilities } from '@/components/workflow/commercial-decision-engine';
import type { WorkflowStage } from '@/components/workflow/workflow-context';

/* ─── Section wrapper ──────────────────────────────────────────────────────── */

function Section({
  id,
  icon: Icon,
  title,
  description,
  children,
}: {
  id: string;
  icon: React.ElementType;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(true);
  return (
    <Card id={id} className="overflow-hidden">
      <button
        type="button"
        className="w-full text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="h-7 w-7 rounded-md bg-primary/8 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">{title}</CardTitle>
                {description ? (
                  <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
                ) : null}
              </div>
            </div>
            {open ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
            )}
          </div>
        </CardHeader>
      </button>
      {open ? <CardContent className="pt-0">{children}</CardContent> : null}
    </Card>
  );
}

/* ─── Currency formatter ─────────────────────────────────────────────────────── */

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

/* ─── Capability row ─────────────────────────────────────────────────────────── */

const CAP_LABELS: Record<keyof CommercialCapabilities, string> = {
  participantsInvited: 'Participants Added',
  earningsConfigured: 'Earnings Configured',
  approvalsComplete: 'Approvals Complete',
  paymentProviderConnected: 'Payment Provider Connected',
  revenueCollectionEnabled: 'Revenue Collection Enabled',
  revenueFlowing: 'Revenue Flowing',
  settlementReady: 'Settlement Ready',
  payoutComplete: 'First Payout Completed',
};

const ALL_CAP_KEYS = Object.keys(CAP_LABELS) as (keyof CommercialCapabilities)[];

/* ─── Workflow stage options ──────────────────────────────────────────────────── */

const STAGE_OPTIONS: { value: WorkflowStage; label: string }[] = [
  { value: 'setup', label: 'Setup' },
  { value: 'configuring', label: 'Configuring' },
  { value: 'collecting-approvals', label: 'Collecting Approvals' },
  { value: 'preparing-payments', label: 'Preparing Payments' },
  { value: 'ready-to-collect', label: 'Ready to Collect' },
  { value: 'collecting-revenue', label: 'Collecting Revenue' },
  { value: 'ready-to-release', label: 'Ready to Release' },
  { value: 'operational', label: 'Operational' },
];

/* ─── Business state presets ─────────────────────────────────────────────────── */

type BusinessStatePreset = {
  id: string;
  label: string;
  caps: Partial<CommercialCapabilities>;
  stage: WorkflowStage;
};

const BUSINESS_STATES: BusinessStatePreset[] = [
  {
    id: 'empty',
    label: 'Empty Workspace',
    caps: {
      participantsInvited: false,
      earningsConfigured: false,
      approvalsComplete: false,
      paymentProviderConnected: false,
      revenueCollectionEnabled: false,
      revenueFlowing: false,
      settlementReady: false,
      payoutComplete: false,
    },
    stage: 'setup',
  },
  {
    id: 'business-created',
    label: 'Business Created',
    caps: { participantsInvited: false, earningsConfigured: false },
    stage: 'setup',
  },
  {
    id: 'participants-added',
    label: 'Participants Added',
    caps: { participantsInvited: true, earningsConfigured: false, approvalsComplete: false },
    stage: 'configuring',
  },
  {
    id: 'earnings-configured',
    label: 'Earnings Configured',
    caps: { participantsInvited: true, earningsConfigured: true, approvalsComplete: false },
    stage: 'collecting-approvals',
  },
  {
    id: 'collecting-approvals',
    label: 'Collecting Approvals',
    caps: {
      participantsInvited: true,
      earningsConfigured: true,
      approvalsComplete: false,
      paymentProviderConnected: false,
    },
    stage: 'collecting-approvals',
  },
  {
    id: 'payment-connected',
    label: 'Payment Provider Connected',
    caps: {
      participantsInvited: true,
      earningsConfigured: true,
      approvalsComplete: true,
      paymentProviderConnected: true,
      revenueCollectionEnabled: true,
    },
    stage: 'ready-to-collect',
  },
  {
    id: 'revenue-collecting',
    label: 'Revenue Collecting',
    caps: {
      participantsInvited: true,
      earningsConfigured: true,
      approvalsComplete: true,
      paymentProviderConnected: true,
      revenueCollectionEnabled: true,
      revenueFlowing: true,
    },
    stage: 'collecting-revenue',
  },
  {
    id: 'settlement-ready',
    label: 'Settlement Ready',
    caps: {
      participantsInvited: true,
      earningsConfigured: true,
      approvalsComplete: true,
      paymentProviderConnected: true,
      revenueCollectionEnabled: true,
      revenueFlowing: true,
      settlementReady: true,
    },
    stage: 'ready-to-release',
  },
  {
    id: 'operational',
    label: 'Operational Business',
    caps: {
      participantsInvited: true,
      earningsConfigured: true,
      approvalsComplete: true,
      paymentProviderConnected: true,
      revenueCollectionEnabled: true,
      revenueFlowing: true,
      settlementReady: false,
      payoutComplete: true,
    },
    stage: 'operational',
  },
];

/* ─── Audit event definitions ───────────────────────────────────────────────── */

const AUDIT_EVENTS: { type: SimulatorAuditEventType; label: string; icon: string }[] = [
  { type: 'approval_generated', label: 'Generate Approval', icon: '✓' },
  { type: 'stripe_connected', label: 'Generate Stripe Connected', icon: '💳' },
  { type: 'revenue_received', label: 'Generate Revenue Received', icon: '💰' },
  { type: 'settlement_released', label: 'Generate Settlement Released', icon: '🏦' },
  { type: 'agreement_created', label: 'Generate Project Created', icon: '📄' },
  { type: 'participant_added', label: 'Generate Participant Added', icon: '👤' },
  { type: 'payment_received', label: 'Generate Payment Received', icon: '💳' },
];

/* ─── JSON inspector ────────────────────────────────────────────────────────── */

function JsonBlock({ value }: { value: unknown }) {
  const [copied, setCopied] = React.useState(false);
  const text = JSON.stringify(value, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
        title="Copy JSON"
      >
        {copied ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
      <pre className="text-xs bg-zinc-950 text-zinc-100 rounded-lg p-4 overflow-x-auto max-h-72 leading-relaxed">
        {text}
      </pre>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────────── */

export default function DeveloperControlCentrePage() {
  const {
    state,
    patchCapabilities,
    patchPaymentProvider,
    patchRevenue,
    loadScenario,
    reset,
    addAuditEntry,
    setState,
  } = useDevSimulator();

  // Section 1 — Subscription plan
  const [selectedPlan, setSelectedPlan] = React.useState<SimulatorPlan>(
    state.plan ?? 'professional'
  );

  // Section 2 — Business state selector
  const [selectedBusinessState, setSelectedBusinessState] = React.useState('');

  // Section 7 — Revenue inputs (local draft)
  const [revInputs, setRevInputs] = React.useState({
    collectedRevenue: state.revenue?.collectedRevenue ?? 0,
    readyToRelease: state.revenue?.readyToRelease ?? 0,
    outstanding: state.revenue?.outstanding ?? 0,
    held: state.revenue?.held ?? 0,
  });

  // Keep local revenue inputs in sync when state loads from localStorage
  React.useEffect(() => {
    if (state.revenue) {
      setRevInputs({
        collectedRevenue: state.revenue.collectedRevenue,
        readyToRelease: state.revenue.readyToRelease,
        outstanding: state.revenue.outstanding,
        held: state.revenue.held,
      });
    }
  }, [state.revenue]);

  const isActive = Object.keys(state.capabilities).length > 0 ||
    state.plan !== null ||
    state.paymentProvider !== null ||
    state.workflowStagePin !== null;

  function applyPlan() {
    setState({ ...state, plan: selectedPlan, activeScenario: null });
    toast.success(`Plan switched to ${selectedPlan}`);
  }

  function loadBusinessState(preset: BusinessStatePreset) {
    setSelectedBusinessState(preset.id);
    setState({
      ...state,
      capabilities: { ...state.capabilities, ...preset.caps },
      workflowStagePin: preset.stage,
      activeScenario: null,
    });
    toast.success(`Loaded: ${preset.label}`);
  }

  function handleCapabilityToggle(key: keyof CommercialCapabilities, checked: boolean) {
    patchCapabilities({ [key]: checked });
  }

  function applyRevenue() {
    patchRevenue(revInputs);
    toast.success('Revenue updated');
  }

  function handleReset() {
    reset();
    setSelectedBusinessState('');
    setSelectedPlan('professional');
    setRevInputs({ collectedRevenue: 0, readyToRelease: 0, outstanding: 0, held: 0 });
    toast.success('Simulator reset — all overrides cleared');
  }

  /* ─── Navigation links for quick live preview ─── */

  const PROJECT_DEMO_ID = 'demo'; // replace with an actual projectId from your dev DB

  const LIVE_LINKS = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Projects', href: '/dashboard/projects' },
    { label: PRODUCT_TERMINOLOGY.projectOverview, href: `/dashboard/projects/${PROJECT_DEMO_ID}/overview` },
    { label: 'Participants (Approval Centre)', href: `/dashboard/projects/${PROJECT_DEMO_ID}/participants?focus=approvals` },
    { label: 'Money & Settlement', href: `/dashboard/projects/${PROJECT_DEMO_ID}/funding` },
    { label: 'Commercial Journey', href: `/dashboard/projects/${PROJECT_DEMO_ID}/commercial-journey` },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* ── Top bar ── */}
      <div className="sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-md bg-zinc-900 flex items-center justify-center">
              <Terminal className="h-3.5 w-3.5 text-zinc-100" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground leading-tight">
                Developer Control Centre
              </h1>
              <p className="text-[10px] text-muted-foreground">
                Provvypay · Internal use only
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isActive ? (
              <Badge className="bg-amber-500/10 text-amber-600 border-amber-300/50 text-xs font-medium">
                <Zap className="h-3 w-3 mr-1" />
                Simulator active
                {state.activeScenario ? ` · ${state.activeScenario}` : ''}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                No overrides
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs gap-1"
              onClick={handleReset}
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
          </div>
        </div>

        {/* Section navigation */}
        <div className="max-w-5xl mx-auto px-4 pb-2 flex gap-2 overflow-x-auto">
          {[
            ['subscription', 'Plan'],
            ['business-state', 'Business State'],
            ['payment-provider', 'Payment Provider'],
            ['capabilities', 'Capabilities'],
            ['scenarios', 'Scenarios'],
            ['revenue', 'Revenue'],
            ['audit', 'Audit'],
            ['inspector', 'Brain Inspector'],
            ['live-preview', 'Live Preview'],
          ].map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="shrink-0 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-accent transition-colors"
            >
              {label}
            </a>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">

        {/* ══════════════════════════════════════════════════════
            SECTION 1 — Subscription Simulator
            ══════════════════════════════════════════════════════ */}
        <Section
          id="subscription"
          icon={Layers}
          title="Subscription Simulator"
          description="Instantly switch the active plan to test every feature gate."
        >
          <div className="space-y-3">
            <RadioGroup
              value={selectedPlan}
              onValueChange={(v) => setSelectedPlan(v as SimulatorPlan)}
              className="grid grid-cols-2 sm:grid-cols-4 gap-2"
            >
              {(['starter', 'professional', 'growth', 'enterprise'] as SimulatorPlan[]).map(
                (plan) => (
                  <div
                    key={plan}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors',
                      selectedPlan === plan
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40'
                    )}
                    onClick={() => setSelectedPlan(plan)}
                  >
                    <RadioGroupItem value={plan} id={`plan-${plan}`} className="shrink-0" />
                    <Label
                      htmlFor={`plan-${plan}`}
                      className="text-xs font-medium capitalize cursor-pointer"
                    >
                      {plan}
                    </Label>
                  </div>
                )
              )}
            </RadioGroup>

            {state.plan ? (
              <p className="text-xs text-muted-foreground">
                Active override:{' '}
                <span className="font-semibold text-foreground capitalize">{state.plan}</span>
              </p>
            ) : null}

            <Button size="sm" onClick={applyPlan} className="h-8 text-xs px-4">
              Apply Plan
            </Button>

            <p className="text-xs text-muted-foreground/70">
              Plan override is stored in the browser. Refresh any page to see feature gate changes.
              The entitlement layer reads this value via the dev simulator shim.
            </p>
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════
            SECTION 2 — Business State Simulator
            ══════════════════════════════════════════════════════ */}
        <Section
          id="business-state"
          icon={Activity}
          title="Business State Simulator"
          description="Jump directly to any business maturity level without completing onboarding."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {BUSINESS_STATES.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={cn(
                  'text-left rounded-lg border px-3 py-2.5 transition-colors hover:border-primary/50',
                  selectedBusinessState === preset.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border'
                )}
                onClick={() => loadBusinessState(preset)}
              >
                <p className="text-xs font-medium text-foreground">{preset.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">
                  Stage: {preset.stage}
                </p>
              </button>
            ))}
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════
            SECTION 3 — Payment Provider
            ══════════════════════════════════════════════════════ */}
        <Section
          id="payment-provider"
          icon={Settings2}
          title="Payment Provider"
          description="Simulate Stripe account health without touching real Stripe."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              ['connected', 'Connected'] as const,
              ['chargesEnabled', 'Charges Enabled'] as const,
              ['payoutsEnabled', 'Payouts Enabled'] as const,
              ['restricted', 'Restricted / Under Review'] as const,
            ] as [keyof NonNullable<DevSimulatorState['paymentProvider']>, string][]).map(
              ([key, label]) => {
                const pp = state.paymentProvider ?? {
                  connected: false,
                  chargesEnabled: false,
                  payoutsEnabled: false,
                  restricted: false,
                };
                return (
                  <div
                    key={key}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border px-3 py-2.5',
                      pp[key] ? 'border-primary/40 bg-primary/4' : 'border-border'
                    )}
                  >
                    <Checkbox
                      id={`pp-${key}`}
                      checked={!!pp[key]}
                      onCheckedChange={(checked) =>
                        patchPaymentProvider({ [key]: Boolean(checked) })
                      }
                    />
                    <Label htmlFor={`pp-${key}`} className="text-xs cursor-pointer">
                      {label}
                    </Label>
                  </div>
                );
              }
            )}
          </div>
          <p className="text-xs text-muted-foreground/70 mt-3">
            Changing these cascades into{' '}
            <code className="text-[10px]">paymentProviderConnected</code> and{' '}
            <code className="text-[10px]">revenueCollectionEnabled</code> in CommercialCapabilities.
          </p>
        </Section>

        {/* ══════════════════════════════════════════════════════
            SECTION 4 — Commercial Capabilities
            ══════════════════════════════════════════════════════ */}
        <Section
          id="capabilities"
          icon={CheckCircle2}
          title="Commercial Capabilities"
          description="Toggle any capability directly. Immediately affects Commercial Brain, Dashboard, Approval Centre, and Settlement."
        >
          <div className="space-y-2">
            {ALL_CAP_KEYS.map((key) => {
              const overrideValue = state.capabilities[key];
              const isOverridden = overrideValue !== undefined;
              return (
                <div
                  key={key}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                    isOverridden && overrideValue
                      ? 'border-[rgba(29,111,66,0.4)] bg-[rgba(29,111,66,0.04)]'
                      : isOverridden && !overrideValue
                        ? 'border-border bg-muted/30'
                        : 'border-border/50'
                  )}
                >
                  <Checkbox
                    id={`cap-${key}`}
                    checked={!!overrideValue}
                    onCheckedChange={(checked) =>
                      handleCapabilityToggle(key, Boolean(checked))
                    }
                  />
                  <Label htmlFor={`cap-${key}`} className="text-xs cursor-pointer flex-1">
                    {CAP_LABELS[key]}
                  </Label>
                  {isOverridden ? (
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1.5 py-0 border-amber-300/60 text-amber-600"
                    >
                      overridden
                    </Badge>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/50">from engine</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Workflow Stage Pin</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STAGE_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  className={cn(
                    'text-left text-xs rounded-lg border px-2.5 py-2 transition-colors',
                    state.workflowStagePin === s.value
                      ? 'border-primary bg-primary/5 text-foreground font-medium'
                      : 'border-border text-muted-foreground hover:border-primary/40'
                  )}
                  onClick={() =>
                    setState({
                      ...state,
                      workflowStagePin:
                        state.workflowStagePin === s.value ? null : s.value,
                      activeScenario: null,
                    })
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
            {state.workflowStagePin ? (
              <p className="text-xs text-muted-foreground">
                Stage pinned to:{' '}
                <span className="font-medium text-foreground">{state.workflowStagePin}</span>
                {' · '}
                <button
                  type="button"
                  className="text-muted-foreground/70 hover:text-foreground underline underline-offset-2"
                  onClick={() => setState({ ...state, workflowStagePin: null })}
                >
                  clear pin
                </button>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground/60">
                No stage pin — workflow stage is derived from capabilities.
              </p>
            )}
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════
            SECTION 10 — Scenario Loader (moved earlier for discoverability)
            ══════════════════════════════════════════════════════ */}
        <Section
          id="scenarios"
          icon={Sparkles}
          title="Scenario Loader"
          description="One click loads a complete Commercial OS state: plan, capabilities, payment provider, revenue, workflow stage."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {SIMULATOR_SCENARIOS.map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                className={cn(
                  'text-left rounded-xl border p-3 transition-colors hover:border-primary/50 hover:bg-accent/30',
                  state.activeScenario === scenario.label
                    ? 'border-primary bg-primary/5'
                    : 'border-border'
                )}
                onClick={() => {
                  loadScenario(scenario.state);
                  toast.success(`Loaded scenario: ${scenario.label}`);
                }}
              >
                <div className="flex items-start gap-2">
                  <span className="text-base leading-none mt-0.5">{scenario.icon}</span>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{scenario.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                      {scenario.description}
                    </p>
                  </div>
                </div>
                {state.activeScenario === scenario.label ? (
                  <Badge className="mt-2 text-[9px] bg-primary/10 text-primary border-primary/30 px-1.5">
                    Active
                  </Badge>
                ) : null}
              </button>
            ))}
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════
            SECTION 7 — Revenue Simulator
            ══════════════════════════════════════════════════════ */}
        <Section
          id="revenue"
          icon={Activity}
          title="Revenue Simulator"
          description="Simulate money flows. Updates Dashboard, Settlement, Commercial OS."
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(
              [
                ['collectedRevenue', 'Collected Revenue'],
                ['readyToRelease', 'Ready to Release'],
                ['outstanding', 'Outstanding'],
                ['held', 'Held'],
              ] as [keyof typeof revInputs, string][]
            ).map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`rev-${key}`} className="text-xs text-muted-foreground">
                  {label}
                </Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    $
                  </span>
                  <input
                    id={`rev-${key}`}
                    type="number"
                    min={0}
                    value={revInputs[key]}
                    onChange={(e) =>
                      setRevInputs((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                    }
                    className="w-full rounded-md border border-input bg-background pl-6 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                {state.revenue ? (
                  <p className="text-[10px] text-muted-foreground/60">
                    Active: {fmt(state.revenue[key])}
                  </p>
                ) : null}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 mt-3">
            <Button size="sm" onClick={applyRevenue} className="h-8 text-xs px-4">
              Apply Revenue
            </Button>
            {state.revenue ? (
              <p className="text-xs text-muted-foreground">
                <span className="text-[rgb(29,111,66)] font-medium">
                  {fmt(state.revenue.collectedRevenue)}
                </span>{' '}
                collected ·{' '}
                <span className="font-medium">{fmt(state.revenue.readyToRelease)}</span> to release
              </p>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground/70 mt-2">
            Setting collectedRevenue &gt; 0 enables{' '}
            <code className="text-[10px]">revenueFlowing</code>. Setting readyToRelease &gt; 0
            enables <code className="text-[10px]">settlementReady</code>.
          </p>
        </Section>

        {/* ══════════════════════════════════════════════════════
            SECTION 8 — Audit Timeline Generator
            ══════════════════════════════════════════════════════ */}
        <Section
          id="audit"
          icon={RefreshCw}
          title="Audit Timeline Generator"
          description="Generate fake history to populate Business Story, Provvy Memory, and Commercial OS history."
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {AUDIT_EVENTS.map((ev) => (
              <Button
                key={ev.type}
                variant="outline"
                size="sm"
                className="h-8 text-xs justify-start gap-2"
                onClick={() => {
                  addAuditEntry(ev.type);
                  toast.success(`Added: ${ev.label}`);
                }}
              >
                <span>{ev.icon}</span>
                {ev.label}
              </Button>
            ))}
          </div>

          {state.auditEntries.length > 0 ? (
            <div className="mt-3 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Generated ({state.auditEntries.length})
              </p>
              <div className="max-h-36 overflow-y-auto space-y-1">
                {state.auditEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-2 text-xs py-1 px-2 rounded bg-muted/40"
                  >
                    <span className="text-foreground">{entry.label}</span>
                    <span className="text-muted-foreground/60 shrink-0 tabular-nums text-[10px]">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                onClick={() => setState({ ...state, auditEntries: [] })}
              >
                Clear history
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/60 mt-2">
              No generated entries. Click above to add fake audit events.
            </p>
          )}
        </Section>

        {/* ══════════════════════════════════════════════════════
            SECTION 9 — Quick Access Links (Impersonation / Context)
            ══════════════════════════════════════════════════════ */}
        <Section
          id="impersonation"
          icon={Users}
          title="Quick Context Links"
          description="Navigate to different agreement contexts to verify simulator effects."
        >
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              The simulator affects all project pages. Use these to quickly navigate to each
              Commercial OS surface and verify the active overrides.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              <Link
                href="/dashboard/projects"
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5 text-xs hover:border-primary/50 transition-colors group"
              >
                <span className="text-foreground font-medium">{PRODUCT_TERMINOLOGY.allProjects}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>
              <Link
                href="/dashboard"
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5 text-xs hover:border-primary/50 transition-colors group"
              >
                <span className="text-foreground font-medium">Dashboard</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>
              <Link
                href="/dashboard/settings/billing"
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5 text-xs hover:border-primary/50 transition-colors group"
              >
                <span className="text-foreground font-medium">Billing / Subscription</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>
              <Link
                href="/dashboard/admin"
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5 text-xs hover:border-primary/50 transition-colors group"
              >
                <span className="text-foreground font-medium">Admin Panel</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>
            </div>
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════
            SECTION 11 — Commercial Brain Inspector
            ══════════════════════════════════════════════════════ */}
        <Section
          id="inspector"
          icon={Code2}
          title="Commercial Brain Inspector"
          description="Inspect the active simulator state. Navigate to any project page to see the real engine output — this panel shows what overrides are active."
        >
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                Active Simulator State
              </p>
              <JsonBlock value={state} />
            </div>

            <Separator />

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                Capability Overrides
              </p>
              {Object.keys(state.capabilities).length > 0 ? (
                <JsonBlock value={state.capabilities} />
              ) : (
                <p className="text-xs text-muted-foreground/60 bg-muted/30 rounded-lg px-3 py-2">
                  No capability overrides active. The engine output is real.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-amber-200/60 bg-amber-50/40 dark:bg-amber-950/20 p-3">
              <div className="flex gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    To inspect real engine output
                  </p>
                  <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
                    Navigate to any project page (
                    <Link
                      href="/dashboard/projects"
                      className="underline underline-offset-2"
                    >
                      /dashboard/projects
                    </Link>
                    ), open the browser DevTools, and inspect the{' '}
                    <code className="text-[10px] bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded">
                      CommercialBrainCtx
                    </code>{' '}
                    React context. The{' '}
                    <code className="text-[10px] bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded">
                      OperationalDiagnosticsPanel
                    </code>{' '}
                    component also renders live JSON on project pages when{' '}
                    <code className="text-[10px]">NEXT_PUBLIC_OPERATIONAL_DIAGNOSTICS=true</code>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════
            SECTION 12 — Live Preview
            ══════════════════════════════════════════════════════ */}
        <Section
          id="live-preview"
          icon={ExternalLink}
          title="Live Preview"
          description="Every change above already propagates via CommercialBrainProvider. Open any of these surfaces to verify."
        >
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Changes are instant. No reload required. Open multiple tabs — one showing this
              panel, one showing the surface you want to verify.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              {LIVE_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5 text-xs hover:border-primary/50 transition-colors group"
                >
                  <span className="text-foreground font-medium">{link.label}</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </a>
              ))}
            </div>
          </div>
        </Section>

        {/* ── Footer ── */}
        <div className="text-center py-8">
          <p className="text-xs text-muted-foreground/50">
            Developer Control Centre · Internal tooling · Not visible to customers
          </p>
          {isActive ? (
            <button
              type="button"
              className="mt-2 text-xs text-amber-600 hover:text-amber-700 underline underline-offset-2"
              onClick={handleReset}
            >
              Clear all simulator overrides
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
