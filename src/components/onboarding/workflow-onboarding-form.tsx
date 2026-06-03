'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { Badge } from '@/components/ui/badge';
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
  ONBOARDING_STEP_ORDER,
  ONBOARDING_PARTICIPANT_ROLES,
  COLLECTION_PREFERENCES,
  onboardingStepIndex,
  onboardingStepLabel,
  onboardingStepTitle,
  onboardingStepSubtext,
  normalizeOnboardingStep,
  type OnboardingStep,
  type OnboardingUseCaseId,
  type OnboardingParticipantRole,
  type CollectionPreferenceId,
} from '@/lib/onboarding/operator-onboarding-types';
import {
  WORKSPACE_CURRENCIES,
  DEFAULT_WORKSPACE_CURRENCY,
} from '@/lib/currency/workspace-currencies';
import {
  OnboardingParticipantCard,
  type OnboardingDraftParticipant,
} from '@/components/onboarding/onboarding-participant-card';
import { notifyWorkspaceActivationRefresh } from '@/hooks/use-workspace-activation';
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
import { CreateFromConversationButton } from '@/components/ai-extractor/create-from-conversation-button';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  logOnboardingPipelineDemoParticipants,
  logOnboardingPipelineDrafts,
} from '@/lib/ai-extractor/onboarding-pipeline-instrumentation';
import { mapDemoParticipantToOnboardingDraft } from '@/lib/onboarding/onboarding-participant-persist';

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

function OnboardingProgress({ step }: { step: OnboardingStep }) {
  const stepNumber = onboardingStepIndex(step) + 1;
  const totalSteps = ONBOARDING_STEP_ORDER.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <Badge variant="secondary">
          Step {stepNumber} of {totalSteps}
        </Badge>
        <span className="text-sm text-muted-foreground">{onboardingStepLabel(step)}</span>
      </div>
      <div className="flex gap-1">
        {ONBOARDING_STEP_ORDER.map((s, i) => (
          <div
            key={s}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              i <= onboardingStepIndex(step) ? 'bg-primary' : 'bg-muted'
            )}
          />
        ))}
      </div>
    </div>
  );
}

const COLLECTION_ICONS = {
  invoices: FileText,
  payment_links: LinkIcon,
  manual_transfers: Banknote,
  decide_later: CalendarClock,
} as const;

function CompactOnboardingHeader({ step }: { step: OnboardingStep }) {
  const subtext = onboardingStepSubtext(step);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">P</span>
          </div>
          <span className="text-lg font-bold">Provvypay</span>
        </Link>
      </div>
      <OnboardingProgress step={step} />
      <div>
        <h2 className="text-xl font-semibold">{onboardingStepTitle(step)}</h2>
        {subtext ? <p className="text-sm text-muted-foreground mt-1">{subtext}</p> : null}
      </div>
    </div>
  );
}

export function WorkflowOnboardingForm() {
  const router = useRouter();
  const [step, setStep] = React.useState<OnboardingStep>('workspace');
  const [isLoading, setIsLoading] = React.useState(false);
  const [useCase, setUseCase] = React.useState<OnboardingUseCaseId | null>(null);
  const [selectedUseCase, setSelectedUseCase] = React.useState<OnboardingUseCaseId | null>(null);
  const [organizationId, setOrganizationId] = React.useState<string | null>(null);
  const [merchantSettingsId, setMerchantSettingsId] = React.useState<string | null>(null);
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [projectName, setProjectName] = React.useState('');
  const [confirmedParticipants, setConfirmedParticipants] = React.useState<DraftParticipant[]>([]);
  const [participantInputMode, setParticipantInputMode] = React.useState<'conversation' | 'manual'>('conversation');
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
    if (draft.step) setStep(normalizeOnboardingStep(draft.step));
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
              merchantSettingsId?: string;
              projectId?: string;
              onboarding_use_case?: OnboardingUseCaseId;
              collection_preference?: CollectionPreferenceId;
            };
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
        if (state?.step && state.step !== 'complete') {
          setStep(normalizeOnboardingStep(state.step, hasOrg));
        } else if (!hasOrg) {
          setStep('workspace');
        }
      } catch {
        /* resume optional */
      }
    })();
  }, []);

  const selectedUseCaseMeta = ONBOARDING_USE_CASES.find((u) => u.id === useCase);
  const isWelcomeStep = step === 'workspace' || step === 'use_case';

  async function onWorkspaceSubmit(values: z.infer<typeof workspaceSchema>) {
    setIsLoading(true);
    try {
      const res = await fetch('/api/onboarding/bootstrap-workspace', {
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
      await fetch('/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: data.organizationId,
          state: {
            step: 'use_case',
            workspace_name: values.workspaceName,
            workspace_industry: values.industry,
            workspace_team_size: values.teamSize,
            organizationId: data.organizationId,
            merchantSettingsId: data.merchantSettingsId,
          },
        }),
      });
      setStep('use_case');
      notifyWorkspaceActivationRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create workspace');
    } finally {
      setIsLoading(false);
    }
  }

  async function persistState(nextStep: OnboardingStep, extra?: Record<string, unknown>) {
    if (!organizationId) return;
    await fetch('/api/onboarding', {
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

  async function finishOnboarding() {
    setOrgCookie();
    if (organizationId) {
      await fetch('/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          state: {
            step: 'complete',
            completed: true,
            completedAt: new Date().toISOString(),
            onboarding_use_case: useCase ?? undefined,
            onboarding_context: selectedUseCaseMeta?.title,
            collection_preference: collectionPreference ?? undefined,
            organizationId,
            merchantSettingsId: merchantSettingsId ?? undefined,
            projectId: projectId ?? undefined,
          },
        }),
      });
    }
    clearOnboardingDraft();
    const params = new URLSearchParams({ workspace: 'ready' });
    if (projectName.trim()) params.set('project', projectName.trim());
    notifyWorkspaceActivationRefresh();
    router.push(`/dashboard?${params.toString()}`);
    router.refresh();
  }

  async function handleUseCaseContinue() {
    if (!selectedUseCase) return;
    setUseCase(selectedUseCase);
    const meta = ONBOARDING_USE_CASES.find((u) => u.id === selectedUseCase);
    saveOnboardingDraft({ useCase: selectedUseCase, context: meta?.title, step: 'project' });
    await persistState('project');
    setStep('project');
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

      const res = await fetch('/api/onboarding/bootstrap-project', {
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
        toast.message('Project created', {
          description: successMutation.operationalWarning,
        });
      } else {
        toast.success('Project created');
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
      toast.error('Create a project first');
      return;
    }
    setIsLoading(true);
    try {
      if (!skip) {
        const valid = allParticipantsToSubmit();
        if (valid.length > 0) {
          const postBody = { projectId, participants: valid };
          logOnboardingPipelineDrafts('clientPostPayload', valid, { projectId });
          const res = await fetch('/api/onboarding/participants', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(postBody),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to add participants');
          }
          setConfirmedParticipants(valid);
          setDraftParticipant(EMPTY_PARTICIPANT());
          toast.success(`Added ${valid.length} participant${valid.length === 1 ? '' : 's'}`);
        }
      }
      await persistState('funding');
      setStep('funding');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save participants');
    } finally {
      setIsLoading(false);
    }
  }

  async function onFundingContinue() {
    if (!collectionPreference) {
      toast.error('Select how you usually collect money');
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
    const res = await fetch(`/api/merchant-settings/${merchantSettingsId}`, {
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
    toast.success('Provider settings saved');
  }

  async function finishOnboardingWithProviders() {
    setIsLoading(true);
    try {
      await saveOptionalProviders(railsForm.getValues());
      await finishOnboarding();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to complete setup');
      setIsLoading(false);
    }
  }

  const stepBody = (
    <>
      {step === 'workspace' && (
        <div className="space-y-6">
          <p className="text-muted-foreground text-sm">
            This workspace coordinates revenue, obligations, approvals, and payouts across your
            projects. You can create additional projects later.
          </p>
          <Form {...workspaceForm}>
            <form
              onSubmit={workspaceForm.handleSubmit(onWorkspaceSubmit)}
              className="space-y-4"
            >
              <FormField
                control={workspaceForm.control}
                name="workspaceName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Workspace name</FormLabel>
                    <FormControl>
                      <Input placeholder="Island Events Co." {...field} />
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
                        <SelectTrigger>
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
                      <Input placeholder="Events, agencies, marketplaces…" {...field} />
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
                      <Input placeholder="1–5, 6–20, 20+" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </form>
          </Form>
        </div>
      )}

      {step === 'use_case' && (
        <div className="space-y-6">
          <div>
            <p className="text-muted-foreground text-sm">
              Provvypay helps coordinate revenue, obligations, approvals, and payouts across
              multiple parties.
            </p>
            <p className="text-muted-foreground text-sm mt-2">
              Choose your primary workflow. You can create additional workflows later.
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
                  className={cn(
                    'relative rounded-lg border p-4 text-left transition-colors hover:bg-accent/40',
                    isSelected && 'border-primary bg-primary/5 ring-1 ring-primary/20'
                  )}
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
          <div className="flex justify-end">
            <Button type="button" disabled={!selectedUseCase} onClick={handleUseCaseContinue}>
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 'project' && (
        <div className="space-y-6">
          <p className="text-muted-foreground text-sm">
            Projects are where you coordinate participants, obligations, revenue, and payouts.
            {selectedUseCaseMeta ? (
              <span className="block mt-1 text-foreground/80">
                Starting with: <strong>{selectedUseCaseMeta.title}</strong>
              </span>
            ) : null}
          </p>
          <Form {...projectForm}>
            <form onSubmit={projectForm.handleSubmit(onProjectSubmit)} className="space-y-4">
              <FormField
                control={projectForm.control}
                name="projectName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project name</FormLabel>
                    <FormControl>
                      <Input placeholder="Saturday Beach Event" {...field} />
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
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="What is this project coordinating?" rows={3} {...field} />
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
                Change it anytime under Collection & settlement setup.
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
                <Button type="button" variant="ghost" onClick={() => setStep('use_case')}>
                  Back
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create project
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
            Add promoters, suppliers, contractors, and other payout parties to your project. No
            banking or KYC required yet.
          </p>

          {/* Input mode choice */}
          <div className="space-y-2">
            <p className="text-sm font-medium">How was this arrangement made?</p>
            <div className="space-y-2">
              {([
                { value: 'conversation', label: 'Create From Conversation', description: 'Paste a WhatsApp, email, or other message and Provvypay extracts who gets paid.' },
                { value: 'manual', label: 'Add Participants Manually', description: 'Enter participant details one by one.' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setParticipantInputMode(opt.value)}
                  className={cn(
                    'w-full rounded-lg border p-4 text-left transition-colors hover:bg-accent/40',
                    participantInputMode === opt.value && 'border-primary bg-primary/5 ring-1 ring-primary/20'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className={cn(
                      'mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border',
                      participantInputMode === opt.value ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                    )}>
                      {participantInputMode === opt.value && (
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Conversation import */}
          {participantInputMode === 'conversation' && (
            <div className="flex flex-col items-start gap-3">
              <CreateFromConversationButton
                entryPoint="onboarding"
                existingDeal={projectId ? { id: projectId, dealName: projectName, partner: '', value: 0, introducer: '', closer: '', status: 'Pending', lastUpdated: new Date().toISOString(), paymentStatus: 'Not Paid' } : undefined}
                onComplete={(_dealId, participants) => {
                  if (participants && participants.length > 0) {
                    logOnboardingPipelineDemoParticipants('onCompletePayload', participants, {
                      caller: 'workflow-onboarding-form.onComplete',
                    });
                    const asDraft: DraftParticipant[] = participants.map((p) =>
                      mapDemoParticipantToOnboardingDraft(p)
                    );
                    setConfirmedParticipants((prev) => [...prev, ...asDraft]);
                    setParticipantInputMode('manual');
                  }
                }}
                size="lg"
              />
              {confirmedParticipants.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Or{' '}
                  <button type="button" className="underline hover:text-foreground" onClick={() => setParticipantInputMode('manual')}>
                    add participants manually instead
                  </button>
                </p>
              )}
            </div>
          )}

          {/* Confirmed participants list — shown in both modes */}
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

          {/* Manual entry form — shown when mode is manual */}
          {participantInputMode === 'manual' && (
            <Card className="p-4 space-y-3">
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
          )}

          <div className="flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep('project')}>
              Back
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isLoading}
                onClick={() => onParticipantsContinue(true)}
              >
                Skip for now
              </Button>
              <Button type="button" disabled={isLoading} onClick={() => onParticipantsContinue(false)}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Continue
              </Button>
            </div>
          </div>
        </div>
      )}

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
                  className={cn(
                    'relative rounded-lg border p-4 text-left transition-colors hover:bg-accent/40',
                    isSelected && 'border-primary bg-primary/5 ring-1 ring-primary/20'
                  )}
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
            <Button type="button" variant="ghost" onClick={() => setStep('participants')}>
              Back
            </Button>
            <Button type="button" disabled={!collectionPreference || isLoading} onClick={onFundingContinue}>
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
          <Card className="p-5 border-primary/20 bg-primary/[0.03]">
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
                    Accept card payments and coordinate payout flows with Stripe Connect.
                  </p>
                </div>
                <Button asChild className="shrink-0">
                  <Link href="/dashboard/settings/merchant?onboarding=continue#payment-rails">
                    Connect Stripe
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
                <span className="text-sm font-medium">Other ways to collect and settle funds</span>
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
                      <FormDescription>International bank transfer payouts.</FormDescription>
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
            You can also record manual bank transfers or wallet payments without connecting a
            provider.
          </p>

          <Card className="p-4 bg-muted/20">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1">
                <p className="text-sm font-medium">Need help choosing providers?</p>
                <p className="text-sm text-muted-foreground">
                  Provvypay Co-Pilot can recommend payout setups based on your workflow, countries,
                  contractors, and settlement needs.
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
                disabled={isLoading}
                onClick={finishOnboardingWithProviders}
              >
                Skip for now
              </Button>
              <Button type="button" disabled={isLoading} onClick={finishOnboardingWithProviders}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Go to workspace
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
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
    return (
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Welcome to Provvypay</h1>
          <p className="mt-2 text-muted-foreground max-w-lg mx-auto">
            Set up your workspace for coordinating revenue, obligations, and payouts across
            multiple parties in a few guided steps.
          </p>
        </div>
        <OnboardingProgress step={step} />
        <div>
          <h2 className="text-xl font-semibold mb-4">{onboardingStepTitle(step)}</h2>
          {stepBody}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl space-y-6">
      <CompactOnboardingHeader step={step} />
      {stepBody}
    </div>
  );
}
