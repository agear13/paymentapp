'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  CopilotGuideLink,
  ProvvypayCopilotGuide,
  type CopilotGuideTopic,
} from '@/components/copilot/provvypay-copilot-guide';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  Banknote,
  CalendarClock,
  Check,
  ChevronDown,
  FileText,
  Link as LinkIcon,
  Loader2,
  Plus,
  Sparkles,
} from 'lucide-react';
import {
  ONBOARDING_USE_CASES,
  ONBOARDING_PARTICIPANT_ROLES,
  ONBOARDING_START_METHODS,
  ONBOARDING_AGREEMENT_TEMPLATES,
  ONBOARDING_IMPORT_SOURCES,
  COLLECTION_PREFERENCES,
  normalizeOnboardingStep,
  type OnboardingStep,
  type OnboardingUseCaseId,
  type OnboardingStartMethodId,
  type OnboardingTemplateId,
  type OnboardingParticipantRole,
  type CollectionPreferenceId,
} from '@/lib/onboarding/operator-onboarding-types';
import {
  buildInsightsFromExtraction,
  buildInsightsFromManual,
  buildInsightsFromTemplate,
  rebuildInsightFromParticipants,
  type AgreementIntelligenceInsight,
} from '@/lib/onboarding/agreement-intelligence-insights';
import { AgreementIntelligenceReport } from '@/components/onboarding/agreement-intelligence-report';
import { OnboardingPricingPanel } from '@/components/onboarding/onboarding-pricing-panel';
import { OnboardingTemplateGallery } from '@/components/onboarding/onboarding-template-gallery';
import { OnboardingVisualHeader } from '@/components/provvypay/onboarding-visual-header';
import { ProvvypayLogoMark } from '@/components/provvypay/provvypay-logo-mark';
import { trackOnboardingActivation } from '@/lib/onboarding/onboarding-activation-analytics';
import { trackOutcomeOnce } from '@/lib/agreements/validation/agreement-intelligence-analytics';
import {
  buildDemoAgreementInsight,
  demoCreationSourceLabel,
  DEMO_AGREEMENT_NAME,
  DEMO_PARTICIPANTS,
  DEMO_USE_CASE,
} from '@/lib/onboarding/onboarding-demo-workspace';
import type { ExtractionResult, SourceType } from '@/lib/ai-extractor/extraction-types';
import { SOURCE_TYPE_LABELS } from '@/lib/ai-extractor/extraction-types';
import { onboardingDraftsFromExtraction } from '@/lib/onboarding/onboarding-participant-persist';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import {
  WORKSPACE_CURRENCIES,
  DEFAULT_WORKSPACE_CURRENCY,
} from '@/lib/currency/workspace-currencies';
import {
  OnboardingParticipantCard,
  type OnboardingDraftParticipant,
} from '@/components/onboarding/onboarding-participant-card';
import { notifyWorkspaceActivationRefresh } from '@/hooks/use-workspace-activation';
import {
  CSRF_PREPARING_LABEL,
  useClientCsrfReady,
} from '@/hooks/use-client-csrf-ready';
import { useEntitlements } from '@/hooks/use-entitlements';
import { csrfAwareFetch, getClientCsrfToken } from '@/lib/security/csrf-fetch.client';
import { logCsrfDiag } from '@/lib/security/csrf-diag.client';
import { StarterLimitAlert } from '@/components/entitlements/starter-limit-alert';
import { OnboardingPlanEntitlementSummary } from '@/components/onboarding/onboarding-plan-entitlement-summary';
import {
  isOnboardingStarterAwarenessStep,
  starterLimitMessage,
} from '@/lib/entitlements/plan-onboarding-summaries';
import { OnboardingProviderChecklist } from '@/components/onboarding/onboarding-provider-checklist';
import {
  OnboardingRecoveryPanel,
  type OnboardingRecoveryMutation,
} from '@/components/onboarding/onboarding-recovery-panel';
import {
  clearOnboardingDraft,
  loadOnboardingDraft,
  saveOnboardingDraft,
} from '@/lib/onboarding/onboarding-draft-persistence';
import { createOperationId } from '@/lib/onboarding/mutation-resilience';
import {
  startSaasCheckout,
  type SaasCheckoutPlan,
} from '@/lib/billing/start-saas-checkout.client';

const workspaceSchema = z.object({
  workspaceName: z.string().min(2, 'Workspace name is required').max(255),
  defaultCurrency: z.string().length(3),
  industry: z.string().max(120).optional(),
  teamSize: z.string().max(64).optional(),
});

const projectSchema = z.object({
  projectName: z.string().min(2, 'Project name is required').max(255),
  description: z.string().max(2000).optional(),
  estimatedValue: z.string().optional(),
  defaultCurrency: z.string().length(3),
});

const railsSchema = z.object({
  hederaAccountId: z.string().optional(),
  wiseProfileId: z.string().optional(),
});

type ProjectFormValues = z.infer<typeof projectSchema>;
type RailsFormValues = z.infer<typeof railsSchema>;

type DraftParticipant = OnboardingDraftParticipant;

const EMPTY_PARTICIPANT = (): DraftParticipant => ({
  name: '',
  email: '',
  role: 'Contractor',
});

function setOrgCookie() {
  document.cookie = 'provvypay_has_org=true; path=/; max-age=31536000';
}

const selectionCardClass = (isSelected: boolean) =>
  cn(
    'relative rounded-xl border p-5 text-left transition-all duration-200 hover:border-[rgba(124,92,255,0.25)] hover:shadow-sm',
    isSelected
      ? 'border-[rgb(124,92,255)] bg-[rgba(124,92,255,0.06)] ring-2 ring-[rgba(124,92,255,0.12)] shadow-sm'
      : 'border-[rgba(124,92,255,0.12)] bg-white'
  );

const selectionCardCompactClass = (isSelected: boolean) =>
  cn(
    'rounded-xl border p-3 text-left text-sm transition-all duration-200 hover:border-[rgba(124,92,255,0.25)]',
    isSelected
      ? 'border-[rgb(124,92,255)] bg-[rgba(124,92,255,0.06)] ring-2 ring-[rgba(124,92,255,0.12)]'
      : 'border-[rgba(124,92,255,0.12)] bg-white'
  );

const COLLECTION_ICONS = {
  invoices: FileText,
  payment_links: LinkIcon,
  manual_transfers: Banknote,
  decide_later: CalendarClock,
} as const;

export function WorkflowOnboardingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isReady: csrfReady, isPreparing: csrfPreparing } = useClientCsrfReady();
  const [step, setStep] = React.useState<OnboardingStep>('workspace');
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    logCsrfDiag('WorkflowOnboardingForm', 'isLoading-changed', { isLoading });
  }, [isLoading]);

  React.useEffect(() => {
    if (step !== 'workspace') return;

    const moduleToken = getClientCsrfToken();
    const buttonDisabled = isLoading || !csrfReady;

    logCsrfDiag('WorkflowOnboardingForm', 'workspace-button-state', {
      csrfReady,
      csrfPreparing,
      isLoading,
      hasModuleToken: moduleToken !== null,
      moduleTokenPreview: moduleToken ? `${moduleToken.slice(0, 12)}...` : null,
      buttonDisabled,
      buttonDisabledReason: isLoading
        ? 'isLoading'
        : !csrfReady
          ? '!csrfReady'
          : 'enabled',
    });
  }, [step, csrfReady, csrfPreparing, isLoading]);
  const [billingCheckoutLoading, setBillingCheckoutLoading] = React.useState(false);
  const [useCase, setUseCase] = React.useState<OnboardingUseCaseId | null>(null);
  const [selectedUseCase, setSelectedUseCase] = React.useState<OnboardingUseCaseId | null>(null);
  const [startMethod, setStartMethod] = React.useState<OnboardingStartMethodId | null>(null);
  const [selectedStartMethod, setSelectedStartMethod] = React.useState<OnboardingStartMethodId | null>(null);
  const [selectedTemplate, setSelectedTemplate] = React.useState<OnboardingTemplateId | null>(null);
  const [importSourceType, setImportSourceType] = React.useState<SourceType>('whatsapp');
  const [importRawText, setImportRawText] = React.useState('');
  const [importExtracting, setImportExtracting] = React.useState(false);
  const [_extractionResult, setExtractionResult] = React.useState<ExtractionResult | null>(null);
  const [agreementInsight, setAgreementInsight] = React.useState<AgreementIntelligenceInsight | null>(null);
  const [isExploreMode, setIsExploreMode] = React.useState(false);
  const [selectedPlanId, setSelectedPlanId] = React.useState('starter');
  const agreementReviewTrackedRef = React.useRef(false);
  const completeViewTrackedRef = React.useRef(false);
  const [organizationId, setOrganizationId] = React.useState<string | null>(null);
  const [merchantSettingsId, setMerchantSettingsId] = React.useState<string | null>(null);
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [projectName, setProjectName] = React.useState('');
  const [confirmedParticipants, setConfirmedParticipants] = React.useState<DraftParticipant[]>([]);
  const [draftParticipant, setDraftParticipant] = React.useState<DraftParticipant>(EMPTY_PARTICIPANT());
  const [collectionPreference, setCollectionPreference] = React.useState<CollectionPreferenceId | null>(
    null
  );
  const [advancedProvidersOpen, setAdvancedProvidersOpen] = React.useState(false);
  const [copilotOpen, setCopilotOpen] = React.useState(false);
  const [copilotTopic, setCopilotTopic] = React.useState<CopilotGuideTopic | null>(null);
  const [bootstrapMutation, setBootstrapMutation] =
    React.useState<OnboardingRecoveryMutation | null>(null);
  const bootstrapOperationIdRef = React.useRef<string>(createOperationId());
  const { isAllowed, pilotBypass } = useEntitlements();
  const agreementAtLimit = !pilotBypass && !isAllowed('create_agreement');
  const aiImportAtLimit = !pilotBypass && !isAllowed('ai_import');

  const isStartMethodBlocked = React.useCallback(
    (method: OnboardingStartMethodId) => {
      if (method === 'import') return agreementAtLimit || aiImportAtLimit;
      return agreementAtLimit;
    },
    [agreementAtLimit, aiImportAtLimit]
  );

  function openCopilotGuide(topic: CopilotGuideTopic) {
    setCopilotTopic(topic);
    setCopilotOpen(true);
  }

  const workspaceForm = useForm<z.infer<typeof workspaceSchema>>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: {
      workspaceName: '',
      defaultCurrency: DEFAULT_WORKSPACE_CURRENCY,
      industry: '',
      teamSize: '',
    },
  });

  const projectForm = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      projectName: '',
      description: '',
      estimatedValue: '',
      defaultCurrency: DEFAULT_WORKSPACE_CURRENCY,
    },
  });

  const railsForm = useForm<RailsFormValues>({
    resolver: zodResolver(railsSchema),
    defaultValues: {
      hederaAccountId: '',
      wiseProfileId: '',
    },
  });

  React.useEffect(() => {
    const draft = loadOnboardingDraft();
    if (draft.useCase) {
      setUseCase(draft.useCase);
      setSelectedUseCase(draft.useCase);
    }
    if (draft.project) {
      projectForm.reset({
        projectName: draft.project.projectName,
        description: draft.project.description ?? '',
        estimatedValue: draft.project.estimatedValue ?? '',
        defaultCurrency: draft.project.defaultCurrency,
      });
      setProjectName(draft.project.projectName);
    }
    if (draft.organizationId) setOrganizationId(draft.organizationId);
    if (draft.merchantSettingsId) setMerchantSettingsId(draft.merchantSettingsId);
    if (draft.projectId) setProjectId(draft.projectId);
    if (draft.participants?.length) setConfirmedParticipants(draft.participants);
    if (draft.step) setStep(normalizeOnboardingStep(draft.step, Boolean(draft.organizationId)));
    if (draft.lastOperationId) bootstrapOperationIdRef.current = draft.lastOperationId;

    (async () => {
      try {
        const res = await fetch('/api/onboarding');
        if (!res.ok) return;
        const data = (await res.json()) as {
          data?: {
            hasOrganization?: boolean;
            organizationId?: string;
            state?: {
              step?: OnboardingStep;
              workspace_name?: string;
              merchantSettingsId?: string;
              projectId?: string;
              onboarding_use_case?: OnboardingUseCaseId;
              collection_preference?: CollectionPreferenceId;
              pending_billing_plan?: SaasCheckoutPlan;
              completed?: boolean;
            };
          };
          hasOrganization?: boolean;
          organizationId?: string;
          state?: {
            step?: OnboardingStep;
            workspace_name?: string;
            merchantSettingsId?: string;
            projectId?: string;
            onboarding_use_case?: OnboardingUseCaseId;
            collection_preference?: CollectionPreferenceId;
            pending_billing_plan?: SaasCheckoutPlan;
            completed?: boolean;
          };
        };
        const payload = data.data ?? data;
        const hasOrg = Boolean(payload?.hasOrganization);
        if (payload.organizationId) {
          setOrganizationId(payload.organizationId);
          window.localStorage.setItem('provvypay.organizationId', payload.organizationId);
          setOrgCookie();
        }
        const state = payload.state;
        if (state?.workspace_name) {
          workspaceForm.setValue('workspaceName', state.workspace_name);
        }
        if (state?.onboarding_use_case) {
          setUseCase(state.onboarding_use_case);
          setSelectedUseCase(state.onboarding_use_case);
        }
        if (state?.collection_preference) {
          setCollectionPreference(state.collection_preference);
        }
        if (state?.merchantSettingsId) setMerchantSettingsId(state.merchantSettingsId);
        if (state?.projectId) setProjectId(state.projectId);
        if (state?.pending_billing_plan) {
          setSelectedPlanId(state.pending_billing_plan);
        }
        if (state?.completed) {
          setStep('complete');
        } else if (state?.step === 'complete') {
          setStep('complete');
        } else if (state?.step) {
          setStep(normalizeOnboardingStep(state.step, hasOrg));
        } else if (!hasOrg) {
          setStep('workspace');
        }
      } catch {
        /* resume optional */
      }
    })();
  }, []);

  React.useEffect(() => {
    if (searchParams?.get('billing') !== 'canceled') return;
    setStep('complete');
    toast.message('Checkout canceled. Choose a plan to continue, or select Starter to enter the app.');
  }, [searchParams]);

  const selectedUseCaseMeta = ONBOARDING_USE_CASES.find((u) => u.id === useCase);
  const isWelcomeStep = step === 'workspace' || step === 'start_method';
  const showStarterPlanSummary =
    selectedPlanId === 'starter' && isOnboardingStarterAwarenessStep(step);

  const starterPlanSummary = showStarterPlanSummary ? (
    <OnboardingPlanEntitlementSummary
      planId="starter"
      compact
      onSelectProfessional={() => setSelectedPlanId('professional')}
    />
  ) : null;

  async function bootstrapAgreementProject(
    name: string,
    description?: string,
    estimatedValue?: number
  ): Promise<string | null> {
    const currency = projectForm.getValues('defaultCurrency') || DEFAULT_WORKSPACE_CURRENCY;
    projectForm.setValue('projectName', name);
    if (description) projectForm.setValue('description', description);

    const res = await csrfAwareFetch('/api/onboarding/bootstrap-project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectName: name,
        description,
        estimatedValue,
        defaultCurrency: currency,
        onboarding_use_case: useCase ?? selectedUseCase ?? undefined,
        onboarding_context: selectedUseCaseMeta?.title,
        operationId: bootstrapOperationIdRef.current,
        existingProjectId: projectId ?? undefined,
      }),
    });

    const payload = await res.json().catch(() => ({}));
    const data = payload.data ?? payload;
    if (!res.ok || !data.organizationId || !data.projectId) {
      toast.error(payload.error || 'Failed to create agreement');
      return null;
    }

    setOrganizationId(data.organizationId);
    setMerchantSettingsId(data.merchantSettingsId ?? null);
    setProjectId(data.projectId);
    setProjectName(name);
    window.localStorage.setItem('provvypay.organizationId', data.organizationId);
    setOrgCookie();
    notifyWorkspaceActivationRefresh();
    trackOutcomeOnce('outcome_first_agreement', {
      projectId: data.projectId,
      agreementName: name,
    });
    return data.projectId as string;
  }

  async function persistParticipantsForProject(
    participants: DraftParticipant[],
    targetProjectId?: string
  ): Promise<boolean> {
    const activeProjectId = targetProjectId ?? projectId;
    if (!activeProjectId || participants.length === 0) return true;
    const res = await csrfAwareFetch('/api/onboarding/participants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: activeProjectId, participants }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || 'Failed to save agreement participants');
      return false;
    }
    setConfirmedParticipants(participants);
    return true;
  }

  async function enterAgreementReview(
    participants: DraftParticipant[],
    insight: AgreementIntelligenceInsight
  ) {
    setConfirmedParticipants(participants);
    setAgreementInsight(insight);
    agreementReviewTrackedRef.current = false;
    trackOnboardingActivation('agreement_intelligence_generated', {
      organizationId,
      projectId,
      agreementType: insight.agreementType,
      readinessScore: insight.readinessScore,
      source: insight.creationSource,
    });
    trackOnboardingActivation('agreement_created', {
      organizationId,
      projectId,
      source: insight.creationSource,
    });
    await persistState('agreement_review');
    setStep('agreement_review');
  }

  React.useEffect(() => {
    if (step !== 'agreement_review' || !agreementInsight || agreementReviewTrackedRef.current) {
      return;
    }
    agreementReviewTrackedRef.current = true;
    trackOnboardingActivation('agreement_readiness_viewed', {
      organizationId,
      projectId,
      readinessScore: agreementInsight.readinessScore,
      agreementType: agreementInsight.agreementType,
    });
  }, [step, agreementInsight, organizationId, projectId]);

  React.useEffect(() => {
    if (step !== 'complete' || completeViewTrackedRef.current) return;
    completeViewTrackedRef.current = true;
    trackOnboardingActivation('workspace_ready_viewed', { organizationId, projectId, exploreMode: isExploreMode });
    trackOnboardingActivation('plan_viewed', { organizationId, projectId });
  }, [step, organizationId, projectId, isExploreMode]);

  async function persistPendingBillingPlan(plan: SaasCheckoutPlan | null) {
    if (!organizationId) return;

    let existingState: Record<string, unknown> = {};
    try {
      const res = await fetch('/api/onboarding');
      if (res.ok) {
        const payload = (await res.json()) as { data?: { state?: Record<string, unknown> }; state?: Record<string, unknown> };
        existingState = payload.data?.state ?? payload.state ?? {};
      }
    } catch {
      /* non-blocking */
    }

    const nextState: Record<string, unknown> = {
      ...existingState,
      step: 'complete',
      completed: false,
      organizationId,
      merchantSettingsId: merchantSettingsId ?? undefined,
      projectId: projectId ?? undefined,
      onboarding_use_case: useCase ?? undefined,
      onboarding_context: selectedUseCaseMeta?.title,
      collection_preference: collectionPreference ?? undefined,
    };

    if (plan) {
      nextState.pending_billing_plan = plan;
    } else {
      delete nextState.pending_billing_plan;
    }

    await csrfAwareFetch('/api/onboarding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId,
        state: nextState,
      }),
    });
  }

  async function initiateBillingCheckout(plan: SaasCheckoutPlan) {
    if (!organizationId) {
      toast.error('Create your workspace before choosing a paid plan.');
      return;
    }

    setBillingCheckoutLoading(true);
    try {
      setSelectedPlanId(plan);
      trackOnboardingActivation('plan_selected', { organizationId, projectId, planId: plan });
      await persistPendingBillingPlan(plan);

      const result = await startSaasCheckout({ plan, context: 'onboarding' });
      if ('error' in result) {
        toast.error(result.error);
        return;
      }

      window.location.href = result.url;
    } finally {
      setBillingCheckoutLoading(false);
    }
  }

  async function handlePlanSelect(planId: string) {
    if (planId === 'professional' || planId === 'growth') {
      await initiateBillingCheckout(planId);
      return;
    }

    setSelectedPlanId(planId);
    trackOnboardingActivation('plan_selected', {
      organizationId,
      projectId,
      planId,
    });

    if (planId === 'starter' && organizationId) {
      await persistPendingBillingPlan(null);
    }
  }

  async function onWorkspaceSubmit(values: z.infer<typeof workspaceSchema>) {
    setIsLoading(true);
    try {
      const res = await csrfAwareFetch('/api/onboarding/bootstrap-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceName: values.workspaceName,
          defaultCurrency: values.defaultCurrency,
          industry: values.industry,
          teamSize: values.teamSize,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create workspace');
      }
      const payload = await res.json();
      const data = payload.data ?? payload;
      setOrganizationId(data.organizationId);
      setMerchantSettingsId(data.merchantSettingsId);
      window.localStorage.setItem('provvypay.organizationId', data.organizationId);
      setOrgCookie();
      projectForm.setValue('defaultCurrency', values.defaultCurrency);
      toast.success('Workspace created');
      await csrfAwareFetch('/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: data.organizationId,
          state: {
            step: 'start_method',
            workspace_name: values.workspaceName,
            workspace_industry: values.industry,
            workspace_team_size: values.teamSize,
            organizationId: data.organizationId,
            merchantSettingsId: data.merchantSettingsId,
          },
        }),
      });
      setStep('start_method');
      notifyWorkspaceActivationRefresh();
      trackOnboardingActivation('workspace_created', {
        organizationId: data.organizationId,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create workspace');
    } finally {
      setIsLoading(false);
    }
  }

  async function persistState(nextStep: OnboardingStep, extra?: Record<string, unknown>) {
    if (!organizationId) return;
    await csrfAwareFetch('/api/onboarding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId,
        state: {
          step: nextStep,
          onboarding_use_case: useCase ?? undefined,
          onboarding_context: selectedUseCaseMeta?.title,
          collection_preference: collectionPreference ?? undefined,
          organizationId,
          merchantSettingsId: merchantSettingsId ?? undefined,
          projectId: projectId ?? undefined,
          ...extra,
        },
      }),
    });
  }

  async function completeStarterOnboarding() {
    if (!organizationId) return;

    await csrfAwareFetch(`/api/organizations/${organizationId}/subscription`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'starter', status: 'inactive' }),
    });

    trackOnboardingActivation('plan_selected', {
      organizationId,
      projectId,
      planId: 'starter',
    });

    await csrfAwareFetch('/api/onboarding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId,
        state: {
          step: 'complete',
          completed: true,
          completedAt: new Date().toISOString(),
          onboarding_use_case: useCase ?? undefined,
          onboarding_start_method: startMethod ?? undefined,
          onboarding_context: selectedUseCaseMeta?.title,
          collection_preference: collectionPreference ?? undefined,
          organizationId,
          merchantSettingsId: merchantSettingsId ?? undefined,
          projectId: projectId ?? undefined,
        },
      }),
    });
  }

  async function finishOnboarding() {
    if (selectedPlanId === 'professional' || selectedPlanId === 'growth') {
      toast.message('Complete Stripe checkout to activate your subscription.');
      await initiateBillingCheckout(selectedPlanId);
      return;
    }

    if (selectedPlanId === 'enterprise') {
      toast.message('Contact sales to activate Enterprise.');
      return;
    }

    setIsLoading(true);
    try {
      setOrgCookie();
      await completeStarterOnboarding();
      clearOnboardingDraft();
      notifyWorkspaceActivationRefresh();
      router.push(
        projectId
          ? `/dashboard/projects/${encodeURIComponent(projectId)}`
          : '/dashboard?workspace=ready'
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to complete onboarding');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStartMethodContinue() {
    if (!selectedStartMethod) return;
    if (isStartMethodBlocked(selectedStartMethod)) {
      toast.error(
        starterLimitMessage(
          selectedStartMethod === 'import' && aiImportAtLimit ? 'ai_import' : 'create_agreement'
        )
      );
      return;
    }
    setStartMethod(selectedStartMethod);
    trackOnboardingActivation('agreement_creation_method_selected', {
      organizationId,
      method: selectedStartMethod,
    });
    saveOnboardingDraft({ step: selectedStartMethod === 'import' ? 'import_source' : selectedStartMethod === 'template' ? 'template_select' : 'project' });
    await persistState(
      selectedStartMethod === 'import'
        ? 'import_source'
        : selectedStartMethod === 'template'
          ? 'template_select'
          : 'project',
      { onboarding_start_method: selectedStartMethod }
    );

    if (selectedStartMethod === 'import') {
      setStep('import_source');
    } else if (selectedStartMethod === 'template') {
      setStep('template_select');
    } else {
      setStep('project');
    }
  }

  async function handleImportExtract() {
    if (!importRawText.trim()) {
      toast.error('Paste your commercial discussion to continue');
      return;
    }
    if (aiImportAtLimit) {
      toast.error(starterLimitMessage('ai_import'));
      return;
    }
    if (agreementAtLimit) {
      toast.error(starterLimitMessage('create_agreement'));
      return;
    }
    trackOnboardingActivation('conversation_import_started', {
      organizationId,
      source: importSourceType,
    });
    setImportExtracting(true);
    try {
      const res = await csrfAwareFetch('/api/ai-extractor/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          rawText: importRawText.trim(),
          sourceHint: SOURCE_TYPE_LABELS[importSourceType],
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? 'Extraction failed');
      }
      const result = (await res.json()) as ExtractionResult;
      setExtractionResult(result);

      const agreementName =
        result.projectName.value?.trim() ||
        result.counterparty.value?.trim() ||
        'Imported Agreement';

      const bootstrappedId = await bootstrapAgreementProject(
        agreementName,
        result.projectDescription.value ?? undefined,
        result.projectValue.value ?? undefined
      );
      if (!bootstrappedId) return;

      const extractedCurrency = result.currency.value;
      const dealForImport: RecentDeal = {
        id: bootstrappedId,
        dealName: agreementName,
        partner: agreementName,
        value: result.projectValue.value ?? 0,
        introducer: '',
        closer: '',
        status: 'Pending',
        lastUpdated: new Date().toISOString(),
        paymentStatus: 'Not Paid',
        projectValueCurrency:
          extractedCurrency === 'AUD' || extractedCurrency === 'USD' ? extractedCurrency : 'AUD',
      };

      const participants = onboardingDraftsFromExtraction(
        result,
        dealForImport,
        importSourceType,
        projectForm.getValues('defaultCurrency') || DEFAULT_WORKSPACE_CURRENCY
      );

      const saved = await persistParticipantsForProject(participants, bootstrappedId);
      if (!saved) return;

      notifyWorkspaceActivationRefresh();

      const insight = buildInsightsFromExtraction(result, participants);
      trackOnboardingActivation('conversation_import_completed', {
        organizationId,
        projectId: bootstrappedId,
        source: importSourceType,
        readinessScore: insight.readinessScore,
      });
      toast.success('Agreement Intelligence ready');
      await enterAgreementReview(participants, insight);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not analyze agreement');
    } finally {
      setImportExtracting(false);
    }
  }

  async function handleTemplateContinue() {
    if (!selectedTemplate) return;
    if (agreementAtLimit) {
      toast.error(starterLimitMessage('create_agreement'));
      return;
    }
    const template = ONBOARDING_AGREEMENT_TEMPLATES.find((t) => t.id === selectedTemplate);
    if (!template) return;

    trackOnboardingActivation('template_selected', {
      organizationId,
      templateId: selectedTemplate,
    });

    setUseCase(template.useCaseId);
    setSelectedUseCase(template.useCaseId);

    const participants: DraftParticipant[] = template.participants.map((p) => ({
      name: p.name,
      email: '',
      role: p.role,
    }));

    setIsLoading(true);
    try {
      const bootstrappedId = await bootstrapAgreementProject(template.agreementName, template.description);
      if (!bootstrappedId) return;

      const saved = await persistParticipantsForProject(participants, bootstrappedId);
      if (!saved) return;

      const insight = buildInsightsFromTemplate(selectedTemplate, participants);
      toast.success('Template agreement configured');
      await enterAgreementReview(participants, insight);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUseCaseContinue() {
    if (!selectedUseCase) return;
    setUseCase(selectedUseCase);
    trackOnboardingActivation('workflow_selected', {
      organizationId,
      projectId,
      method: selectedUseCase,
    });
    const meta = ONBOARDING_USE_CASES.find((u) => u.id === selectedUseCase);
    saveOnboardingDraft({ useCase: selectedUseCase, context: meta?.title, step: 'funding' });
    await persistState('funding');
    setStep('funding');
  }

  async function handleAgreementReviewContinue() {
    setIsLoading(true);
    try {
      if (isExploreMode) {
        setUseCase(DEMO_USE_CASE);
        setSelectedUseCase(DEMO_USE_CASE);
        setCollectionPreference('decide_later');
        await persistState('complete', {
          onboarding_use_case: DEMO_USE_CASE,
          collection_preference: 'decide_later',
        });
        setStep('complete');
        return;
      }

      await persistState('use_case');
      setStep('use_case');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSkipAndExplore() {
    if (!organizationId) {
      toast.error('Create your workspace first, then explore the demo agreement');
      return;
    }

    setIsLoading(true);
    trackOnboardingActivation('skip_and_explore_selected', { organizationId });

    try {
      setIsExploreMode(true);
      setStartMethod(null);
      setUseCase(DEMO_USE_CASE);
      setSelectedUseCase(DEMO_USE_CASE);
      setProjectName(DEMO_AGREEMENT_NAME);
      projectForm.setValue('projectName', DEMO_AGREEMENT_NAME);

      const bootstrappedId = await bootstrapAgreementProject(
        DEMO_AGREEMENT_NAME,
        'Demo revenue share agreement for exploration.'
      );
      if (!bootstrappedId) return;

      const saved = await persistParticipantsForProject(DEMO_PARTICIPANTS, bootstrappedId);
      if (!saved) return;

      trackOnboardingActivation('demo_workspace_created', {
        organizationId,
        projectId: bootstrappedId,
        exploreMode: true,
      });

      const insight = buildDemoAgreementInsight();
      toast.success('Demo agreement ready');
      await enterAgreementReview(DEMO_PARTICIPANTS, insight);
    } finally {
      setIsLoading(false);
    }
  }

  async function finishOnboardingWithProviders() {
    setIsLoading(true);
    try {
      await saveOptionalProviders(railsForm.getValues());
      await persistState('complete');
      setStep('complete');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to complete setup');
    } finally {
      setIsLoading(false);
    }
  }

  React.useEffect(() => {
    const sub = projectForm.watch((values) => {
      saveOnboardingDraft({
        step: 'project',
        useCase: useCase ?? undefined,
        project: {
          projectName: values.projectName ?? '',
          description: values.description,
          estimatedValue: values.estimatedValue,
          defaultCurrency: values.defaultCurrency ?? DEFAULT_WORKSPACE_CURRENCY,
        },
        organizationId,
        merchantSettingsId,
        projectId,
        participants: confirmedParticipants,
      });
    });
    return () => sub.unsubscribe();
  }, [projectForm, useCase, organizationId, merchantSettingsId, projectId, confirmedParticipants]);

  async function onProjectSubmit(values: ProjectFormValues) {
    if (agreementAtLimit) {
      toast.error(starterLimitMessage('create_agreement'));
      return;
    }
    setIsLoading(true);
    setBootstrapMutation(null);

    saveOnboardingDraft({
      step: 'project',
      project: {
        projectName: values.projectName,
        description: values.description,
        estimatedValue: values.estimatedValue,
        defaultCurrency: values.defaultCurrency,
      },
      useCase: useCase ?? undefined,
      lastOperationId: bootstrapOperationIdRef.current,
    });

    try {
      const estimatedValue =
        values.estimatedValue?.trim() !== ''
          ? Number.parseFloat(values.estimatedValue!)
          : undefined;

      const res = await csrfAwareFetch('/api/onboarding/bootstrap-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: values.projectName,
          description: values.description,
          estimatedValue:
            estimatedValue != null && !Number.isNaN(estimatedValue) ? estimatedValue : undefined,
          defaultCurrency: values.defaultCurrency,
          onboarding_use_case: useCase ?? undefined,
          onboarding_context: selectedUseCaseMeta?.title,
          operationId: bootstrapOperationIdRef.current,
          existingProjectId: projectId ?? undefined,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      const data = payload.data ?? payload;
      const mutation = (data.mutation ?? payload.mutation) as OnboardingRecoveryMutation | undefined;

      if (!res.ok) {
        const fallbackMutation: OnboardingRecoveryMutation = mutation ?? {
          status: 'RECOVERABLE_FAILURE',
          recoveryMessage:
            payload.error ||
            'We could not finish configuring your project yet. Your project details were preserved safely.',
          retryRecommended: true,
          safeToRetry: true,
          preservedDraft: true,
          operationReference: bootstrapOperationIdRef.current,
        };
        setBootstrapMutation(fallbackMutation);
        saveOnboardingDraft({
          lastMutationStatus: fallbackMutation.status,
          lastOperationId: bootstrapOperationIdRef.current,
        });
        return;
      }

      if (!data.organizationId || !data.projectId) {
        setBootstrapMutation({
          status: 'RECOVERABLE_FAILURE',
          recoveryMessage:
            'Your project may have been created, but the response was incomplete. Try again safely.',
          retryRecommended: true,
          safeToRetry: true,
          preservedDraft: true,
          operationReference: bootstrapOperationIdRef.current,
        });
        return;
      }

      const successMutation: OnboardingRecoveryMutation = mutation ?? {
        status: 'SUCCESS',
        recoveryMessage: 'Your project was created successfully.',
        preservedDraft: true,
        operationReference: bootstrapOperationIdRef.current,
      };

      if (successMutation.status === 'PARTIAL_SUCCESS') {
        setBootstrapMutation(successMutation);
      }

      setOrganizationId(data.organizationId);
      setMerchantSettingsId(data.merchantSettingsId ?? null);
      setProjectId(data.projectId);
      setProjectName(values.projectName);
      window.localStorage.setItem('provvypay.organizationId', data.organizationId);
      setOrgCookie();

      saveOnboardingDraft({
        organizationId: data.organizationId,
        merchantSettingsId: data.merchantSettingsId,
        projectId: data.projectId,
        step: 'participants',
        lastMutationStatus: successMutation.status,
      });

      notifyWorkspaceActivationRefresh();

      if (successMutation.status === 'PARTIAL_SUCCESS') {
        toast.message('Agreement created', {
          description: successMutation.operationalWarning,
        });
      } else {
        toast.success('Agreement created');
      }
      setStep('participants');
    } catch {
      setBootstrapMutation({
        status: 'RECOVERABLE_FAILURE',
        recoveryMessage:
          'We could not reach the server. Your project details are preserved — check your connection and try again.',
        retryRecommended: true,
        safeToRetry: true,
        preservedDraft: true,
        operationReference: bootstrapOperationIdRef.current,
      });
      saveOnboardingDraft({ lastMutationStatus: 'RECOVERABLE_FAILURE' });
    } finally {
      setIsLoading(false);
    }
  }

  function retryBootstrapProject() {
    void projectForm.handleSubmit(onProjectSubmit)();
  }

  function commitDraftParticipant() {
    if (!draftParticipant.name.trim()) {
      toast.error('Enter a participant name');
      return;
    }
    setConfirmedParticipants((prev) => [...prev, { ...draftParticipant, name: draftParticipant.name.trim() }]);
    setDraftParticipant(EMPTY_PARTICIPANT());
  }

  function allParticipantsToSubmit(): DraftParticipant[] {
    const extras =
      draftParticipant.name.trim() !== '' ? [{ ...draftParticipant, name: draftParticipant.name.trim() }] : [];
    return [...confirmedParticipants, ...extras];
  }

  async function onParticipantsContinue(skip: boolean) {
    if (!projectId) {
      toast.error('Create an agreement first');
      return;
    }
    setIsLoading(true);
    try {
      const valid = skip ? confirmedParticipants : allParticipantsToSubmit();
      if (!skip && valid.length === 0) {
        toast.error('Add at least one agreement participant');
        return;
      }

      if (valid.length > 0) {
        const saved = await persistParticipantsForProject(valid);
        if (!saved) return;
        setDraftParticipant(EMPTY_PARTICIPANT());
        toast.success(`Captured ${valid.length} participant${valid.length === 1 ? '' : 's'}`);
      }

      const insight = buildInsightsFromManual({
        agreementName: projectName || projectForm.getValues('projectName'),
        participants: valid,
        description: projectForm.getValues('description'),
        creationSource: 'manual',
      });
      await enterAgreementReview(valid, insight);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save agreement participants');
    } finally {
      setIsLoading(false);
    }
  }

  async function onFundingContinue() {
    if (!collectionPreference) {
      toast.error('Select how revenue will be collected');
      return;
    }
    setIsLoading(true);
    try {
      await persistState('payment_rails', { collection_preference: collectionPreference });
      setStep('payment_rails');
    } finally {
      setIsLoading(false);
    }
  }

  async function saveOptionalProviders(values: RailsFormValues) {
    if (!merchantSettingsId) return;
    const hasAny = values.hederaAccountId?.trim() || values.wiseProfileId?.trim();
    if (!hasAny) return;
    const res = await csrfAwareFetch(`/api/merchant-settings/${merchantSettingsId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hederaAccountId: values.hederaAccountId?.trim() || undefined,
        wiseProfileId: values.wiseProfileId?.trim() || undefined,
        wiseEnabled: Boolean(values.wiseProfileId?.trim()),
      }),
    });
    if (!res.ok) {
      throw new Error('Failed to save provider settings');
    }
    notifyWorkspaceActivationRefresh();
    toast.success('Settlement infrastructure saved');
  }

  const stepBody = (
    <>
      {step === 'workspace' && (
        <Card className="surface-elevated border-0 p-6 sm:p-8 shadow-sm">
          <Form {...workspaceForm}>
            <form
              onSubmit={workspaceForm.handleSubmit(onWorkspaceSubmit)}
              className="space-y-5"
            >
              <FormField
                control={workspaceForm.control}
                name="workspaceName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Workspace name</FormLabel>
                    <FormControl>
                      <Input className="h-11" placeholder="Island Events Co." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={workspaceForm.control}
                name="defaultCurrency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default currency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {WORKSPACE_CURRENCIES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.code} — {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={workspaceForm.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Industry (optional)</FormLabel>
                    <FormControl>
                      <Input className="h-11" placeholder="Events, agencies, marketplaces…" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={workspaceForm.control}
                name="teamSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Team size (optional)</FormLabel>
                    <FormControl>
                      <Input className="h-11" placeholder="1–5, 6–20, 20+" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full h-11" disabled={isLoading || !csrfReady}>
                {(csrfPreparing || isLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {csrfPreparing ? CSRF_PREPARING_LABEL : 'Continue'}
                {!csrfPreparing && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </form>
          </Form>
        </Card>
      )}

      {step === 'start_method' && (
        <div className="space-y-6">
          <div>
            <p className="text-muted-foreground text-sm">
              Provvypay transforms conversations into structured agreements with participants,
              obligations, and settlement readiness.
            </p>
            <p className="text-muted-foreground text-sm mt-2">
              All three paths are first-class workflows — choose the one that matches how your
              arrangement was formed.
            </p>
          </div>
          {agreementAtLimit ? <StarterLimitAlert feature="create_agreement" /> : null}
          {aiImportAtLimit ? <StarterLimitAlert feature="ai_import" /> : null}
          <div className="grid gap-3">
            {ONBOARDING_START_METHODS.map((item) => {
              const isSelected = selectedStartMethod === item.id;
              const blocked = isStartMethodBlocked(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={blocked}
                  onClick={() => setSelectedStartMethod(item.id)}
                  className={cn(selectionCardClass(isSelected), blocked && 'opacity-50 cursor-not-allowed')}
                >
                  {isSelected ? (
                    <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3 w-3" />
                    </span>
                  ) : null}
                  <p className="font-medium pr-6">{item.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                  {item.id === 'import' ? (
                    <p className="text-xs text-muted-foreground mt-2">
                      Supported sources: WhatsApp, Email, Slack, SMS, Meeting Notes, Contract Text
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={isLoading || !organizationId || !csrfReady}
              onClick={handleSkipAndExplore}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Skip Setup And Explore
            </Button>
            <Button
              type="button"
              disabled={
                !csrfReady ||
                !selectedStartMethod ||
                (selectedStartMethod ? isStartMethodBlocked(selectedStartMethod) : false)
              }
              onClick={handleStartMethodContinue}
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 'import_source' && (
        <div className="space-y-6">
          <p className="text-muted-foreground text-sm">
            Select where this commercial discussion took place. Agreement Intelligence adapts to
            each source format.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {ONBOARDING_IMPORT_SOURCES.map((source) => (
              <button
                key={source}
                type="button"
                onClick={() => setImportSourceType(source)}
                className={selectionCardCompactClass(importSourceType === source)}
              >
                {SOURCE_TYPE_LABELS[source]}
              </button>
            ))}
          </div>
          <div className="flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep('start_method')}>
              Back
            </Button>
            <Button type="button" onClick={() => setStep('import_content')}>
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 'import_content' && (
        <div className="space-y-6">
          <p className="text-muted-foreground text-sm">
            Paste your {SOURCE_TYPE_LABELS[importSourceType]} conversation, email thread, meeting
            notes, or contract text. Provvypay will extract participants, obligations, and
            commercial terms automatically.
          </p>
          {aiImportAtLimit ? <StarterLimitAlert feature="ai_import" /> : null}
          {agreementAtLimit ? <StarterLimitAlert feature="create_agreement" /> : null}
          <Textarea
            value={importRawText}
            onChange={(e) => setImportRawText(e.target.value)}
            placeholder="Paste your commercial discussion here…"
            rows={10}
          />
          <div className="flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep('import_source')}>
              Back
            </Button>
            <Button
              type="button"
              disabled={!csrfReady || importExtracting || aiImportAtLimit || agreementAtLimit}
              onClick={handleImportExtract}
            >
              {importExtracting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Analyze Agreement
              <Sparkles className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 'template_select' && (
        <div className="space-y-6">
          {agreementAtLimit ? <StarterLimitAlert feature="create_agreement" /> : null}
          <OnboardingTemplateGallery
            selectedTemplateId={selectedTemplate}
            onSelectTemplate={setSelectedTemplate}
          />
          <div className="flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep('start_method')}>
              Back
            </Button>
            <Button
              type="button"
              disabled={!csrfReady || !selectedTemplate || isLoading || agreementAtLimit}
              onClick={handleTemplateContinue}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 'use_case' && (
        <div className="space-y-6">
          <div>
            <p className="text-muted-foreground text-sm">
              Workflows determine how obligations and settlements are coordinated for this agreement.
            </p>
            <p className="text-muted-foreground text-sm mt-2">
              Choose the workflow that best matches your commercial arrangement. You can add more
              workflows later.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {ONBOARDING_USE_CASES.map((item) => {
              const isSelected = selectedUseCase === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedUseCase(item.id)}
                  className={selectionCardClass(isSelected)}
                >
                  {isSelected ? (
                    <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3 w-3" />
                    </span>
                  ) : null}
                  <p className="font-medium pr-6">{item.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                </button>
              );
            })}
          </div>
          <div className="flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep('agreement_review')}>
              Back
            </Button>
            <Button type="button" disabled={!csrfReady || !selectedUseCase} onClick={handleUseCaseContinue}>
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 'project' && (
        <div className="space-y-6">
          <p className="text-muted-foreground text-sm">
            Define the commercial arrangement you are coordinating. Agreement Intelligence will
            analyze these details before you configure settlement.
          </p>
          {agreementAtLimit ? <StarterLimitAlert feature="create_agreement" /> : null}
          <Form {...projectForm}>
            <form onSubmit={projectForm.handleSubmit(onProjectSubmit)} className="space-y-4">
              <FormField
                control={projectForm.control}
                name="projectName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agreement name</FormLabel>
                    <FormControl>
                      <Input placeholder="Coastal Promotions Revenue Share" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={projectForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Commercial terms (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe revenue structure, settlement timing, and approval requirements…"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={projectForm.control}
                  name="estimatedValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated value (optional)</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} step="0.01" placeholder="10000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Default currency: {projectForm.watch('defaultCurrency')} (set in workspace setup).
                Change it anytime under Revenue collection & settlement setup.
              </p>
              {bootstrapMutation &&
              bootstrapMutation.status !== 'SUCCESS' ? (
                <OnboardingRecoveryPanel
                  mutation={bootstrapMutation}
                  onRetry={
                    bootstrapMutation.safeToRetry !== false ? retryBootstrapProject : undefined
                  }
                  onContinueLater={() => {
                    saveOnboardingDraft({ step: 'project' });
                    toast.message('Progress saved', {
                      description: 'Return anytime to continue from this step.',
                    });
                  }}
                />
              ) : null}
              <div className="flex justify-between pt-2">
                <Button type="button" variant="ghost" onClick={() => setStep('start_method')}>
                  Back
                </Button>
                <Button type="submit" disabled={!csrfReady || isLoading || agreementAtLimit}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </form>
          </Form>
        </div>
      )}

      {step === 'participants' && (
        <div className="space-y-6">
          <p className="text-muted-foreground text-sm">
            Add the parties involved in this agreement. Banking and tax details can be captured
            later — Agreement Intelligence will identify any gaps.
          </p>

          {confirmedParticipants.length > 0 ? (
            <div className="space-y-2">
              {confirmedParticipants.map((p, index) => (
                <OnboardingParticipantCard
                  key={`${p.name}-${index}`}
                  participant={p}
                  onUpdate={(next) => {
                    setConfirmedParticipants((prev) =>
                      prev.map((row, i) => (i === index ? next : row))
                    );
                  }}
                  onRemove={() =>
                    setConfirmedParticipants(confirmedParticipants.filter((_, i) => i !== index))
                  }
                />
              ))}
            </div>
          ) : null}

          <Card className="p-4 space-y-3">
            <p className="text-sm font-medium">Agreement Participants</p>
            <Input
              placeholder="Name"
              value={draftParticipant.name}
              onChange={(e) => setDraftParticipant({ ...draftParticipant, name: e.target.value })}
            />
            <Input
              type="email"
              placeholder="Email (optional)"
              value={draftParticipant.email}
              onChange={(e) => setDraftParticipant({ ...draftParticipant, email: e.target.value })}
            />
            <Select
              value={draftParticipant.role}
              onValueChange={(v) =>
                setDraftParticipant({ ...draftParticipant, role: v as OnboardingParticipantRole })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ONBOARDING_PARTICIPANT_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {ONBOARDING_PARTICIPANT_ROLES.find((r) => r.value === draftParticipant.role)?.description}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={commitDraftParticipant}>
              <Plus className="mr-2 h-4 w-4" />
              Add participant
            </Button>
          </Card>

          <div className="flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep('project')}>
              Back
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!csrfReady || isLoading}
                onClick={() => onParticipantsContinue(true)}
              >
                Skip for now
              </Button>
              <Button
                type="button"
                disabled={!csrfReady || isLoading}
                onClick={() => onParticipantsContinue(false)}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Analyze Agreement
                <Sparkles className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === 'agreement_review' && agreementInsight ? (
        <div className="space-y-6">
          <AgreementIntelligenceReport
            insight={agreementInsight}
            analyzing={importExtracting}
            editableSection={
              <div className="space-y-3">
                {confirmedParticipants.map((p, index) => (
                  <OnboardingParticipantCard
                    key={`review-${p.name}-${index}`}
                    participant={p}
                    onUpdate={(next) => {
                      const nextParticipants = confirmedParticipants.map((row, i) =>
                        i === index ? next : row
                      );
                      setConfirmedParticipants(nextParticipants);
                      setAgreementInsight(
                        rebuildInsightFromParticipants(
                          agreementInsight,
                          nextParticipants,
                          projectForm.getValues('description')
                        )
                      );
                    }}
                    onRemove={() => {
                      const next = confirmedParticipants.filter((_, i) => i !== index);
                      setConfirmedParticipants(next);
                      setAgreementInsight(
                        rebuildInsightFromParticipants(
                          agreementInsight,
                          next,
                          projectForm.getValues('description')
                        )
                      );
                    }}
                  />
                ))}
              </div>
            }
          />
          <div className="flex justify-end">
            <Button type="button" disabled={!csrfReady || isLoading} onClick={handleAgreementReviewContinue}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {step === 'funding' && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {COLLECTION_PREFERENCES.map((item) => {
              const isSelected = collectionPreference === item.id;
              const Icon = COLLECTION_ICONS[item.id];
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCollectionPreference(item.id)}
                  className={selectionCardClass(isSelected)}
                >
                  {isSelected ? (
                    <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3 w-3" />
                    </span>
                  ) : null}
                  <Icon className="h-5 w-5 text-primary mb-2" />
                  <p className="font-medium pr-6">{item.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                </button>
              );
            })}
          </div>
          <div className="flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep('use_case')}>
              Back
            </Button>
            <Button
              type="button"
              disabled={!csrfReady || !collectionPreference || isLoading}
              onClick={onFundingContinue}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 'payment_rails' && (
        <div className="space-y-6">
          <OnboardingProviderChecklist />
          <Card className="p-5 surface-intelligence border-0">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">Stripe</p>
                    <CopilotGuideLink
                      label="What is Stripe Connect?"
                      topic="stripe"
                      onOpen={openCopilotGuide}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Coordinate card revenue collection and settlement flows with Stripe Connect.
                  </p>
                </div>
                <Button asChild className="shrink-0">
                  <Link href="/dashboard/settings/merchant?onboarding=continue#payment-rails">
                    Configure Stripe
                  </Link>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Don&apos;t have Stripe yet? Provvypay Co-Pilot can help you set it up.
              </p>
            </div>
          </Card>

          <Collapsible open={advancedProvidersOpen} onOpenChange={setAdvancedProvidersOpen}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="w-full justify-between px-0 hover:bg-transparent">
                <span className="text-sm font-medium">Other settlement infrastructure</span>
                <ChevronDown
                  className={cn('h-4 w-4 transition-transform', advancedProvidersOpen && 'rotate-180')}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-4">
              <Form {...railsForm}>
                <FormField
                  control={railsForm.control}
                  name="wiseProfileId"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between gap-2">
                        <FormLabel>Wise (optional)</FormLabel>
                        <CopilotGuideLink
                          label="How do I connect this?"
                          topic="wise"
                          onOpen={openCopilotGuide}
                        />
                      </div>
                      <FormControl>
                        <Input placeholder="Wise profile ID" {...field} />
                      </FormControl>
                      <FormDescription>International bank transfer settlement.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={railsForm.control}
                  name="hederaAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between gap-2">
                        <FormLabel>Hedera (optional)</FormLabel>
                        <CopilotGuideLink
                          label="How do I connect this?"
                          topic="hedera"
                          onOpen={openCopilotGuide}
                        />
                      </div>
                      <FormControl>
                        <Input placeholder="0.0.12345" {...field} />
                      </FormControl>
                      <FormDescription>Digital asset settlement infrastructure.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Form>
            </CollapsibleContent>
          </Collapsible>

          <p className="text-sm text-muted-foreground rounded-lg border bg-muted/30 px-4 py-3">
            You can also record manual settlements or external wallet transfers without connecting
            infrastructure now.
          </p>

          <Card className="p-4 bg-muted/20">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1">
                <p className="text-sm font-medium">Need help choosing settlement infrastructure?</p>
                <p className="text-sm text-muted-foreground">
                  Provvypay Co-Pilot can recommend settlement setups based on your workflow,
                  countries, participants, and coordination needs.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openCopilotGuide('provider_choice')}
                >
                  Ask Co-Pilot
                </Button>
              </div>
            </div>
          </Card>

          <div className="flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep('funding')}>
              Back
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!csrfReady || isLoading}
                onClick={finishOnboardingWithProviders}
              >
                Skip for now
              </Button>
              <Button
                type="button"
                disabled={!csrfReady || isLoading}
                onClick={finishOnboardingWithProviders}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === 'complete' && (
        <div className="space-y-8">
          {agreementInsight ? (
            <p className="text-sm text-muted-foreground surface-intelligence px-4 py-3">
              {demoCreationSourceLabel(agreementInsight.creationSource)}
            </p>
          ) : null}

          <div className="surface-settlement px-4 py-4 space-y-3">
            <ul className="space-y-2 text-sm">
              {[
                'Participants Identified',
                'Commercial Terms Captured',
                'Obligations Extracted',
                'Settlement Workflow Configured',
                'Agreement Intelligence Complete',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <OnboardingPricingPanel
            selectedPlanId={selectedPlanId}
            onSelectPlan={handlePlanSelect}
            checkoutLoading={billingCheckoutLoading || !csrfReady}
          />

          {selectedPlanId === 'professional' || selectedPlanId === 'growth' ? (
            <Card className="p-4 surface-intelligence border-0">
              <p className="text-sm text-muted-foreground">
                Selecting Professional or Growth redirects you to Stripe Checkout. Onboarding
                completes after payment succeeds — your workspace stays on Starter until then.
              </p>
            </Card>
          ) : null}

          <div className="flex flex-col sm:flex-row gap-3 justify-between">
            {projectId ? (
              <Button type="button" variant="outline" asChild>
                <Link href={`/dashboard/projects/${encodeURIComponent(projectId)}`}>
                  View Agreement
                </Link>
              </Button>
            ) : (
              <span />
            )}
            {selectedPlanId === 'starter' ? (
              <Button type="button" disabled={!csrfReady || isLoading} onClick={finishOnboarding}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Start Using Provvypay
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : selectedPlanId === 'professional' || selectedPlanId === 'growth' ? (
              <Button
                type="button"
                disabled={!csrfReady || billingCheckoutLoading}
                onClick={() => initiateBillingCheckout(selectedPlanId as SaasCheckoutPlan)}
              >
                {billingCheckoutLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Continue to Checkout
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
      )}

      <ProvvypayCopilotGuide
        open={copilotOpen}
        onOpenChange={setCopilotOpen}
        topic={copilotTopic}
        context={{
          useCase: useCase ?? selectedUseCase,
          collectionPreference,
        }}
      />
    </>
  );

  if (isWelcomeStep) {
    const isWorkspaceStep = step === 'workspace';

    return (
      <div className="flex w-full max-w-xl flex-col items-center space-y-5">
        {isWorkspaceStep ? (
          <div className="flex w-full flex-col items-center gap-2 text-center animate-in fade-in duration-500">
            <ProvvypayLogoMark size="sm" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[rgb(124,92,255)]">
              Welcome
            </p>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Welcome to Provvypay</h1>
            <p className="max-w-sm text-sm text-muted-foreground leading-relaxed">
              Agreement Intelligence for commercial coordination.
            </p>
          </div>
        ) : null}
        <OnboardingVisualHeader
          step={step}
          centered={isWorkspaceStep}
          compact
          showLogo={!isWorkspaceStep}
          className="w-full"
        />
        <div
          key={step}
          className={cn(
            'w-full space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-500',
            isWorkspaceStep && 'max-w-md'
          )}
        >
          {starterPlanSummary}
          {stepBody}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8">
      <OnboardingVisualHeader step={step} compact />
      <div key={step} className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-500">
        {starterPlanSummary}
        {stepBody}
      </div>
    </div>
  );
}
