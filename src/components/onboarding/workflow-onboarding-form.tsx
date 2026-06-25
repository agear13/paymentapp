'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { setStoredOrganizationId } from '@/lib/organization/organization-id.client';
import {
  Form,
  FormControl,
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
} from 'lucide-react';
import {
  ONBOARDING_USE_CASES,
  ONBOARDING_PARTICIPANT_ROLES,
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
import { OnboardingStartMethodCards } from '@/components/onboarding/onboarding-start-method-cards';
import { OnboardingTemplateGallery } from '@/components/onboarding/onboarding-template-gallery';
import { OnboardingSetupProgressPanel } from '@/components/onboarding/onboarding-setup-progress-panel';
import { OnboardingReadinessPreview } from '@/components/onboarding/onboarding-readiness-preview';
import { OnboardingVisualHeader } from '@/components/provvypay/onboarding-visual-header';
import { ProvvypayLogoMark } from '@/components/provvypay/provvypay-logo-mark';
import { trackOnboardingActivation } from '@/lib/onboarding/onboarding-activation-analytics';
import { trackOutcomeOnce } from '@/lib/agreements/validation/agreement-intelligence-analytics';
import {
  buildDemoAgreementInsight,
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
import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';
import { StarterLimitAlert } from '@/components/entitlements/starter-limit-alert';
import { OnboardingPlanEntitlementSummary } from '@/components/onboarding/onboarding-plan-entitlement-summary';
import {
  isOnboardingStarterAwarenessStep,
  starterLimitMessage,
} from '@/lib/entitlements/plan-onboarding-summaries';
import { OnboardingPaymentSetupPanel } from '@/components/onboarding/onboarding-payment-setup-panel';
import { OnboardingSuccessMoment } from '@/components/onboarding/onboarding-success-moment';
import { OnboardingMoneySetupIntro } from '@/components/onboarding/onboarding-money-setup-intro';
import { OnboardingCompletionScreen } from '@/components/onboarding/onboarding-completion-screen';
import { projectOverviewPath } from '@/lib/projects/project-routes';
import {
  deriveReadinessWinMessage,
  deriveTemplateSetupProgress,
  formatTemplateCommercialTerm,
} from '@/lib/onboarding/template-draft-state';
import { continueButtonLabel } from '@/lib/onboarding/onboarding-assistant-copy';
import { templateParticipantPlaceholderName } from '@/lib/onboarding/participant-profile-readiness';
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
  const [templateCommercialTerms, setTemplateCommercialTerms] = React.useState<string[]>([]);
  const [templateOriginalCommercialTerms, setTemplateOriginalCommercialTerms] = React.useState<string[]>(
    []
  );
  const readinessPreviousScoreRef = React.useRef<number | null>(null);
  const readinessPreviousParticipantsRef = React.useRef<DraftParticipant[]>([]);
  const [readinessWinMessage, setReadinessWinMessage] = React.useState<string | null>(null);
  const [workspaceJustCreated, setWorkspaceJustCreated] = React.useState(false);
  const [draftParticipant, setDraftParticipant] = React.useState<DraftParticipant>(EMPTY_PARTICIPANT());
  const [collectionPreference, setCollectionPreference] = React.useState<CollectionPreferenceId | null>(
    null
  );
  const [advancedProvidersOpen, setAdvancedProvidersOpen] = React.useState(false);
  // paymentProviderConnected is always false during onboarding — the real value
  // is only available from persisted server state after the wizard closes.
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
          setStoredOrganizationId(payload.organizationId);
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
    setStoredOrganizationId(data.organizationId);
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
      toast.error('Create your business before choosing a paid plan.');
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
      setStoredOrganizationId(data.organizationId);
      setOrgCookie();
      projectForm.setValue('defaultCurrency', values.defaultCurrency);
      toast.success('Business created');
      setWorkspaceJustCreated(true);
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
      toast.error(e instanceof Error ? e.message : 'Failed to create business');
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
      // Navigate to the created agreement workspace so the operator can begin
      // the Golden Path immediately. Fall back to dashboard if no project exists.
      router.push(projectId ? projectOverviewPath(projectId) : '/dashboard');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to complete onboarding');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStartMethodContinue(method?: OnboardingStartMethodId) {
    const chosen = method ?? selectedStartMethod;
    if (!chosen) return;
    if (isStartMethodBlocked(chosen)) {
      toast.error(
        starterLimitMessage(
          chosen === 'import' && aiImportAtLimit ? 'ai_import' : 'create_agreement'
        )
      );
      return;
    }
    setSelectedStartMethod(chosen);
    setStartMethod(chosen);
    trackOnboardingActivation('agreement_creation_method_selected', {
      organizationId,
      method: chosen,
    });
    saveOnboardingDraft({
      step: chosen === 'import' ? 'import_source' : chosen === 'template' ? 'template_select' : 'project',
    });
    await persistState(
      chosen === 'import'
        ? 'import_source'
        : chosen === 'template'
          ? 'template_select'
          : 'project',
      { onboarding_start_method: chosen }
    );

    if (chosen === 'import') {
      setStep('import_source');
    } else if (chosen === 'template') {
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

    const participants: DraftParticipant[] = template.participants.map((p, index) => ({
      name: templateParticipantPlaceholderName(index),
      email: '',
      role: p.role,
    }));

    setIsLoading(true);
    try {
      const bootstrappedId = await bootstrapAgreementProject(template.agreementName, template.description);
      if (!bootstrappedId) return;

      const saved = await persistParticipantsForProject(participants, bootstrappedId);
      if (!saved) return;

      const commercialTerms = [...(template.commercialTerms ?? [])];
      setConfirmedParticipants(participants);
      setTemplateCommercialTerms(commercialTerms);
      setTemplateOriginalCommercialTerms([...commercialTerms]);
      readinessPreviousParticipantsRef.current = participants;
      readinessPreviousScoreRef.current = buildInsightsFromTemplate(selectedTemplate, participants, {
        confirmed: false,
        commercialTerms,
        originalCommercialTerms: commercialTerms,
      }).readinessScore;
      setReadinessWinMessage(null);
      saveOnboardingDraft({ step: 'template_customize' });
      await persistState('template_customize');
      toast.success('Template ready — review and customise');
      setStep('template_customize');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleReviewDraft() {
    if (!selectedTemplate) return;

    setIsLoading(true);
    try {
      const saved = await persistParticipantsForProject(confirmedParticipants);
      if (!saved) return;

      const insight = buildInsightsFromTemplate(selectedTemplate, confirmedParticipants, {
        confirmed: true,
        commercialTerms: templateCommercialTerms,
        originalCommercialTerms: templateOriginalCommercialTerms,
      });
      toast.success(
        "We've reviewed your agreement — confirm participants and settlement details to continue."
      );
      await enterAgreementReview(confirmedParticipants, insight);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleReturnToTemplateDraft() {
    saveOnboardingDraft({ step: 'template_customize' });
    await persistState('template_customize');
    setStep('template_customize');
  }

  function updateTemplateParticipants(next: DraftParticipant[]) {
    if (!selectedTemplate) {
      setConfirmedParticipants(next);
      return;
    }

    const previousScore =
      readinessPreviousScoreRef.current ??
      buildInsightsFromTemplate(selectedTemplate, confirmedParticipants, {
        confirmed: false,
        commercialTerms: templateCommercialTerms,
        originalCommercialTerms: templateOriginalCommercialTerms,
      }).readinessScore;

    const nextScore = buildInsightsFromTemplate(selectedTemplate, next, {
      confirmed: false,
      commercialTerms: templateCommercialTerms,
      originalCommercialTerms: templateOriginalCommercialTerms,
    }).readinessScore;

    const win = deriveReadinessWinMessage(
      readinessPreviousParticipantsRef.current.length > 0
        ? readinessPreviousParticipantsRef.current
        : confirmedParticipants,
      next,
      previousScore,
      nextScore
    );
    if (win) setReadinessWinMessage(win);

    readinessPreviousScoreRef.current = nextScore;
    readinessPreviousParticipantsRef.current = next;
    setConfirmedParticipants(next);
  }

  function updateTemplateCommercialTerm(index: number, value: string) {
    const next = templateCommercialTerms.map((term, i) => (i === index ? value : term));
    setTemplateCommercialTerms(next);
    setReadinessWinMessage(null);
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

      setStep('money_setup_intro');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleMoneySetupIntroContinue() {
    setIsLoading(true);
    try {
      const nextStep = selectedUseCase || useCase ? 'funding' : 'use_case';
      await persistState(nextStep);
      setStep(nextStep);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSkipAndExplore() {
    if (!organizationId) {
      toast.error('Create your business first, then explore the demo agreement');
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

  async function finishOnboardingWithProviders(options?: { skipped?: boolean }) {
    setIsLoading(true);
    try {
      await saveOptionalProviders(railsForm.getValues());
      await persistState('complete');
      void options; // skipped flag reserved for future use
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
      setStoredOrganizationId(data.organizationId);
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
    toast.success('Payment options saved');
  }

  const onboardingHeaderProps = {
    titleOverride: undefined as string | undefined,
    subtextOverride: undefined as string | undefined,
    hideSubtext: false,
    showIntelligenceBadge:
      step === 'agreement_review' &&
      agreementInsight?.creationSource !== 'template' &&
      !agreementInsight?.isTemplateDraft,
  };

  if (step === 'agreement_review') {
    onboardingHeaderProps.titleOverride = "We've prepared your agreement";
    onboardingHeaderProps.hideSubtext = true;
  } else if (step === 'money_setup_intro') {
    onboardingHeaderProps.titleOverride = "Let's finish getting you ready";
    onboardingHeaderProps.hideSubtext = true;
  } else if (step === 'payment_rails') {
    onboardingHeaderProps.titleOverride = "Let's finish getting you ready";
    onboardingHeaderProps.subtextOverride =
      'Connect your payments and choose how participants get paid.';
  } else if (step === 'funding') {
    onboardingHeaderProps.titleOverride = 'How do you collect revenue?';
    onboardingHeaderProps.subtextOverride = 'Pick one — you can change this later.';
  } else if (step === 'use_case') {
    onboardingHeaderProps.titleOverride = 'How will money move?';
    onboardingHeaderProps.subtextOverride = 'Pick the workflow that best matches this arrangement.';
  } else if (step === 'complete') {
    onboardingHeaderProps.titleOverride = "You're ready to operate";
    onboardingHeaderProps.hideSubtext = true;
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
                    <FormLabel>Business name</FormLabel>
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
          {workspaceJustCreated ? (
            <OnboardingSuccessMoment message="Business created" compact />
          ) : null}
          {agreementAtLimit ? <StarterLimitAlert feature="create_agreement" /> : null}
          {aiImportAtLimit ? <StarterLimitAlert feature="ai_import" /> : null}
          <OnboardingStartMethodCards
            selectedMethod={selectedStartMethod}
            onSelectMethod={setSelectedStartMethod}
            onContinue={handleStartMethodContinue}
            isMethodBlocked={isStartMethodBlocked}
            continuing={isLoading}
            csrfReady={csrfReady}
          />
          <div className="flex flex-col items-center gap-2 pt-2 border-t border-[rgba(124,92,255,0.08)]">
            <p className="text-sm text-muted-foreground">Just looking around?</p>
            <Button
              type="button"
              variant="ghost"
              className="w-full sm:w-auto"
              disabled={isLoading || !organizationId || !csrfReady}
              onClick={handleSkipAndExplore}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Skip for now
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
              Review Agreement
              <ArrowRight className="ml-2 h-4 w-4" />
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

      {step === 'template_customize' && selectedTemplate ? (
        <div className="space-y-6">
          {(() => {
            const template = ONBOARDING_AGREEMENT_TEMPLATES.find((t) => t.id === selectedTemplate);
            const previewInsight = buildInsightsFromTemplate(
              selectedTemplate,
              confirmedParticipants,
              {
                confirmed: false,
                commercialTerms: templateCommercialTerms,
                originalCommercialTerms: templateOriginalCommercialTerms,
              }
            );
            const setupProgress = deriveTemplateSetupProgress({
              participants: confirmedParticipants,
              commercialTerms: templateCommercialTerms,
              originalCommercialTerms: templateOriginalCommercialTerms,
            });
            const previousScore = readinessPreviousScoreRef.current ?? previewInsight.readinessScore;

            return (
              <>
                <OnboardingSetupProgressPanel
                  templateTitle={template?.title ?? 'Agreement Template'}
                  setupTimeMinutes={template?.setupTimeMinutes}
                  progress={setupProgress}
                />
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Participants
                  </p>
                  {confirmedParticipants.map((p, index) => (
                    <OnboardingParticipantCard
                      key={`template-${index}-${p.name}`}
                      participant={p}
                      livePreview
                      onUpdate={(next) => {
                        updateTemplateParticipants(
                          confirmedParticipants.map((row, i) => (i === index ? next : row))
                        );
                      }}
                      onRemove={() => {
                        updateTemplateParticipants(
                          confirmedParticipants.filter((_, i) => i !== index)
                        );
                      }}
                    />
                  ))}
                </div>
                {templateOriginalCommercialTerms.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Commercial terms
                    </p>
                    <div className="space-y-2">
                      {templateCommercialTerms.map((term, index) => {
                        const original = templateOriginalCommercialTerms[index] ?? term;
                        const { isUntouchedDefault } = formatTemplateCommercialTerm(original, term);
                        return (
                          <Input
                            key={`term-${index}-${original}`}
                            value={term}
                            onChange={(e) => updateTemplateCommercialTerm(index, e.target.value)}
                            className={cn(
                              isUntouchedDefault &&
                                'border-dashed border-[rgba(124,92,255,0.2)] bg-muted/30 text-muted-foreground'
                            )}
                            aria-label={`Commercial term ${index + 1}`}
                          />
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Edit any term to make this agreement yours — defaults are removed once changed.
                    </p>
                  </div>
                ) : null}
                <OnboardingReadinessPreview
                  score={previewInsight.readinessScore}
                  previousScore={previousScore}
                  explanation={previewInsight.readinessExplanation}
                  winMessage={readinessWinMessage}
                />
              </>
            );
          })()}
          <div className="flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep('template_select')}>
              Back
            </Button>
            <Button
              type="button"
              disabled={!csrfReady || isLoading || confirmedParticipants.length === 0}
              onClick={handleReviewDraft}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Review Draft
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {step === 'money_setup_intro' ? (
        <OnboardingMoneySetupIntro
          onContinue={handleMoneySetupIntroContinue}
          isLoading={isLoading}
          disabled={!csrfReady}
        />
      ) : null}

      {step === 'use_case' && (
        <div className="space-y-6">
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
            <Button type="button" variant="ghost" onClick={() => setStep('money_setup_intro')}>
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
                Default currency: {projectForm.watch('defaultCurrency')} (set in business setup).
                Change it anytime under payment settings.
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
                Review Agreement
                <ArrowRight className="ml-2 h-4 w-4" />
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
            hideConfidence
            assistantMode
            reviewMode={agreementInsight.creationSource === 'template'}
            onEditDraft={
              agreementInsight.creationSource === 'template'
                ? handleReturnToTemplateDraft
                : undefined
            }
            editableSection={
              agreementInsight.creationSource === 'template' ? undefined : (
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
              )
            }
          />
          <div className="flex justify-end">
            <Button type="button" disabled={!csrfReady || isLoading} onClick={handleAgreementReviewContinue}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {continueButtonLabel('Set up payments')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {step === 'funding' && (
        <div className="space-y-6">
          {collectionPreference ? (
            <OnboardingSuccessMoment message="Collection method selected" compact />
          ) : null}
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
          <OnboardingPaymentSetupPanel />

          <Card className="p-5 border border-border/40 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-semibold">Stripe</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Accept card payments and pay participants automatically.
                </p>
              </div>
              <Button asChild className="shrink-0" variant="outline">
                <Link href="/dashboard/settings/merchant?onboarding=continue#payment-rails">
                  Connect Stripe
                </Link>
              </Button>
            </div>
          </Card>

          <Collapsible open={advancedProvidersOpen} onOpenChange={setAdvancedProvidersOpen}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="w-full justify-between px-0 hover:bg-transparent">
                <span className="text-sm font-medium">Other payout options</span>
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
                      <FormLabel>Wise (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Wise profile ID" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={railsForm.control}
                  name="hederaAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stablecoin wallet (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="0.0.12345" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Form>
            </CollapsibleContent>
          </Collapsible>

          <OnboardingSuccessMoment message="Payment setup complete" compact />

          <div className="flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep('funding')}>
              Back
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!csrfReady || isLoading}
                onClick={() => finishOnboardingWithProviders({ skipped: true })}
              >
                Skip for now
              </Button>
              <Button
                type="button"
                disabled={!csrfReady || isLoading}
                onClick={() => finishOnboardingWithProviders()}
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
        <OnboardingCompletionScreen
          projectId={projectId}
          selectedPlanId={selectedPlanId}
          onSelectPlan={handlePlanSelect}
          onGoToDashboard={finishOnboarding}
          onCreateAnother={() => {
            setWorkspaceJustCreated(false);
            setStep('start_method');
          }}
          checkoutLoading={billingCheckoutLoading}
          csrfReady={csrfReady}
          isLoading={isLoading}
          onCheckout={() => initiateBillingCheckout(selectedPlanId as SaasCheckoutPlan)}
          paymentProviderConnected={false}
          participantsInvited={confirmedParticipants.length > 0}
          collectionConfigured={
            collectionPreference !== null && collectionPreference !== 'decide_later'
          }
        />
      )}

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
              Set up agreements and payments in minutes.
            </p>
          </div>
        ) : null}
        <OnboardingVisualHeader
          step={step}
          centered={isWorkspaceStep}
          compact
          showLogo={!isWorkspaceStep}
          className="w-full"
          titleOverride={onboardingHeaderProps.titleOverride}
          subtextOverride={onboardingHeaderProps.subtextOverride}
          hideSubtext={onboardingHeaderProps.hideSubtext}
          showIntelligenceBadge={onboardingHeaderProps.showIntelligenceBadge}
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
      <OnboardingVisualHeader
        step={step}
        compact
        titleOverride={onboardingHeaderProps.titleOverride}
        subtextOverride={onboardingHeaderProps.subtextOverride}
        showIntelligenceBadge={onboardingHeaderProps.showIntelligenceBadge}
        hideSubtext={onboardingHeaderProps.hideSubtext}
      />
      <div key={step} className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-500">
        {starterPlanSummary}
        {stepBody}
      </div>
    </div>
  );
}
