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
import { Card, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  Check,
  ChevronDown,
  FileText,
  Link as LinkIcon,
  Loader2,
  Plus,
} from 'lucide-react';
import {
  ONBOARDING_USE_CASES,
  ONBOARDING_STEP_ORDER,
  ONBOARDING_PARTICIPANT_ROLES,
  onboardingStepIndex,
  onboardingStepLabel,
  onboardingStepTitle,
  type OnboardingStep,
  type OnboardingUseCaseId,
  type OnboardingParticipantRole,
} from '@/lib/onboarding/operator-onboarding-types';

const STORAGE_KEY = 'provvypay.onboarding.draft';

const currencies = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'CAD', name: 'Canadian Dollar' },
];

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

type DraftParticipant = {
  name: string;
  email: string;
  role: OnboardingParticipantRole;
};

const EMPTY_PARTICIPANT = (): DraftParticipant => ({
  name: '',
  email: '',
  role: 'Contractor',
});

function setOrgCookie() {
  document.cookie = 'provvypay_has_org=true; path=/; max-age=31536000';
}

function loadDraft(): {
  useCase?: OnboardingUseCaseId;
  context?: string;
} {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as { useCase?: OnboardingUseCaseId; context?: string };
  } catch {
    return {};
  }
}

function saveDraft(draft: { useCase?: OnboardingUseCaseId; context?: string }) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* ignore */
  }
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

function CompactOnboardingHeader({ step }: { step: OnboardingStep }) {
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
      </div>
    </div>
  );
}

export function WorkflowOnboardingForm() {
  const router = useRouter();
  const [step, setStep] = React.useState<OnboardingStep>('use_case');
  const [isLoading, setIsLoading] = React.useState(false);
  const [useCase, setUseCase] = React.useState<OnboardingUseCaseId | null>(null);
  const [selectedUseCase, setSelectedUseCase] = React.useState<OnboardingUseCaseId | null>(null);
  const [organizationId, setOrganizationId] = React.useState<string | null>(null);
  const [merchantSettingsId, setMerchantSettingsId] = React.useState<string | null>(null);
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [projectName, setProjectName] = React.useState('');
  const [confirmedParticipants, setConfirmedParticipants] = React.useState<DraftParticipant[]>([]);
  const [draftParticipant, setDraftParticipant] = React.useState<DraftParticipant>(EMPTY_PARTICIPANT());
  const [advancedRailsOpen, setAdvancedRailsOpen] = React.useState(false);

  const projectForm = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      projectName: '',
      description: '',
      estimatedValue: '',
      defaultCurrency: 'USD',
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
    const draft = loadDraft();
    if (draft.useCase) {
      setUseCase(draft.useCase);
      setSelectedUseCase(draft.useCase);
    }

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
            };
          };
        };
        const payload = data.data ?? data;
        if (!payload?.hasOrganization) return;

        if (payload.organizationId) {
          setOrganizationId(payload.organizationId);
          window.localStorage.setItem('provvypay.organizationId', payload.organizationId);
          setOrgCookie();
        }
        const state = payload.state;
        if (state?.onboarding_use_case) {
          setUseCase(state.onboarding_use_case);
          setSelectedUseCase(state.onboarding_use_case);
        }
        if (state?.merchantSettingsId) setMerchantSettingsId(state.merchantSettingsId);
        if (state?.projectId) setProjectId(state.projectId);
        if (state?.step && state.step !== 'complete') {
          setStep(state.step);
        }
      } catch {
        /* resume optional */
      }
    })();
  }, []);

  const selectedUseCaseMeta = ONBOARDING_USE_CASES.find((u) => u.id === useCase);
  const isWelcomeStep = step === 'use_case';

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
            organizationId,
            merchantSettingsId: merchantSettingsId ?? undefined,
            projectId: projectId ?? undefined,
          },
        }),
      });
    }
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    const params = new URLSearchParams({ workspace: 'ready' });
    if (projectName.trim()) params.set('project', projectName.trim());
    router.push(`/dashboard?${params.toString()}`);
    router.refresh();
  }

  function handleUseCaseContinue() {
    if (!selectedUseCase) return;
    setUseCase(selectedUseCase);
    const meta = ONBOARDING_USE_CASES.find((u) => u.id === selectedUseCase);
    saveDraft({ useCase: selectedUseCase, context: meta?.title });
    setStep('project');
  }

  async function onProjectSubmit(values: ProjectFormValues) {
    setIsLoading(true);
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
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create project');
      }

      const payload = await res.json();
      const data = payload.data ?? payload;
      setOrganizationId(data.organizationId);
      setMerchantSettingsId(data.merchantSettingsId);
      setProjectId(data.projectId);
      setProjectName(values.projectName);
      window.localStorage.setItem('provvypay.organizationId', data.organizationId);
      setOrgCookie();
      toast.success('Project created');
      setStep('participants');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create project');
    } finally {
      setIsLoading(false);
    }
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
          const res = await fetch('/api/onboarding/participants', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, participants: valid }),
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
    await persistState('payment_rails');
    setStep('payment_rails');
  }

  async function onRailsSubmit(values: RailsFormValues) {
    setIsLoading(true);
    try {
      if (merchantSettingsId) {
        const hasAny = values.hederaAccountId?.trim() || values.wiseProfileId?.trim();
        if (hasAny) {
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
            throw new Error('Failed to save payout rails');
          }
          toast.success('Additional payout rails saved');
        }
      }
      await finishOnboarding();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save payout rails');
    } finally {
      setIsLoading(false);
    }
  }

  const stepBody = (
    <>
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
                <FormField
                  control={projectForm.control}
                  name="defaultCurrency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default currency</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {currencies.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.code} — {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Currency can be changed later per invoice or payment.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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

          {confirmedParticipants.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {confirmedParticipants.map((p, index) => (
                <Badge key={`${p.name}-${index}`} variant="secondary" className="gap-2 py-1.5 px-3">
                  <span>
                    {p.name} — {p.role}
                  </span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      setConfirmedParticipants(confirmedParticipants.filter((_, i) => i !== index))
                    }
                    aria-label={`Remove ${p.name}`}
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          ) : null}

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
          <p className="text-muted-foreground text-sm">
            Choose how revenue enters this project. You can set up both paths later.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link href="/dashboard/payment-links?action=create">
              <Card className="p-6 h-full hover:bg-accent/50 transition-colors cursor-pointer">
                <FileText className="h-6 w-6 text-primary mb-3" />
                <p className="font-semibold">Send invoices</p>
                <CardDescription className="mt-1">
                  Request payment from clients or partners with branded invoices.
                </CardDescription>
                <p className="text-xs text-muted-foreground mt-3">
                  Best for agencies, suppliers, contractors, and settlements.
                </p>
              </Card>
            </Link>
            <Link href="/dashboard/payment-links?action=create">
              <Card className="p-6 h-full hover:bg-accent/50 transition-colors cursor-pointer">
                <LinkIcon className="h-6 w-6 text-primary mb-3" />
                <p className="font-semibold">Share payment links</p>
                <CardDescription className="mt-1">
                  Collect payments instantly with a shareable checkout link or QR code.
                </CardDescription>
                <p className="text-xs text-muted-foreground mt-3">
                  Best for ticketing, bookings, deposits, and sponsorships.
                </p>
              </Card>
            </Link>
          </div>
          <div className="flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep('participants')}>
              Back
            </Button>
            <Button type="button" onClick={onFundingContinue}>
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 'payment_rails' && (
        <div className="space-y-6">
          <p className="text-muted-foreground text-sm">
            Connect providers when you are ready to collect and settle. You can configure these
            anytime in Settings.
          </p>

          <Card className="p-5 border-primary/20 bg-primary/[0.03]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">Stripe</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Accept card payments and manage payout flows with Stripe Connect.
                </p>
              </div>
              <Button asChild>
                <Link href="/dashboard/settings/merchant">Connect Stripe</Link>
              </Button>
            </div>
          </Card>

          <Collapsible open={advancedRailsOpen} onOpenChange={setAdvancedRailsOpen}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="w-full justify-between px-0 hover:bg-transparent">
                <span className="text-sm font-medium">Additional payout rails (optional)</span>
                <ChevronDown
                  className={cn('h-4 w-4 transition-transform', advancedRailsOpen && 'rotate-180')}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <Form {...railsForm}>
                <form onSubmit={railsForm.handleSubmit(onRailsSubmit)} className="space-y-4">
                  <FormField
                    control={railsForm.control}
                    name="wiseProfileId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Wise (optional)</FormLabel>
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
                        <FormLabel>Hedera (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="0.0.12345" {...field} />
                        </FormControl>
                        <FormDescription>Digital asset settlement infrastructure.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-between pt-2">
                    <Button type="button" variant="ghost" onClick={() => setStep('funding')}>
                      Back
                    </Button>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" disabled={isLoading} onClick={finishOnboarding}>
                        Skip for now
                      </Button>
                      <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Go to workspace
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </form>
              </Form>
            </CollapsibleContent>
          </Collapsible>

          {!advancedRailsOpen ? (
            <div className="flex justify-between">
              <Button type="button" variant="ghost" onClick={() => setStep('funding')}>
                Back
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" disabled={isLoading} onClick={finishOnboarding}>
                  Skip for now
                </Button>
                <Button type="button" disabled={isLoading} onClick={finishOnboarding}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Go to workspace
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </>
  );

  if (isWelcomeStep) {
    return (
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Welcome to Provvypay</h1>
          <p className="mt-2 text-muted-foreground max-w-lg mx-auto">
            Set up your workspace for coordinating revenue, obligations, and payouts across
            multiple parties — in a few guided steps.
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
