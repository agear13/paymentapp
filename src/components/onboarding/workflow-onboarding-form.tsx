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
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  Loader2,
  Plus,
  Trash2,
  Wallet,
  Link as LinkIcon,
} from 'lucide-react';
import {
  ONBOARDING_USE_CASES,
  ONBOARDING_STEP_ORDER,
  onboardingStepIndex,
  onboardingStepLabel,
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
  stripeAccountId: z.string().optional(),
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

export function WorkflowOnboardingForm() {
  const router = useRouter();
  const [step, setStep] = React.useState<OnboardingStep>('use_case');
  const [isLoading, setIsLoading] = React.useState(false);
  const [useCase, setUseCase] = React.useState<OnboardingUseCaseId | null>(null);
  const [organizationId, setOrganizationId] = React.useState<string | null>(null);
  const [merchantSettingsId, setMerchantSettingsId] = React.useState<string | null>(null);
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [participants, setParticipants] = React.useState<DraftParticipant[]>([
    { name: '', email: '', role: 'Contributor' },
  ]);

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
      stripeAccountId: '',
      hederaAccountId: '',
      wiseProfileId: '',
    },
  });

  React.useEffect(() => {
    const draft = loadDraft();
    if (draft.useCase) setUseCase(draft.useCase);

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
  const stepNumber = onboardingStepIndex(step) + 1;
  const totalSteps = ONBOARDING_STEP_ORDER.length;

  async function persistState(
    nextStep: OnboardingStep,
    extra?: Record<string, unknown>
  ) {
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
    router.push('/dashboard');
    router.refresh();
  }

  function handleUseCaseSelect(id: OnboardingUseCaseId) {
    setUseCase(id);
    const meta = ONBOARDING_USE_CASES.find((u) => u.id === id);
    saveDraft({ useCase: id, context: meta?.title });
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

  async function onParticipantsContinue(skip: boolean) {
    if (!projectId) {
      toast.error('Create a project first');
      return;
    }
    setIsLoading(true);
    try {
      if (!skip) {
        const valid = participants.filter((p) => p.name.trim() && p.email.trim());
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
        const hasAny =
          values.stripeAccountId?.trim() ||
          values.hederaAccountId?.trim() ||
          values.wiseProfileId?.trim();
        if (hasAny) {
          const res = await fetch(`/api/merchant-settings/${merchantSettingsId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stripeAccountId: values.stripeAccountId?.trim() || undefined,
              hederaAccountId: values.hederaAccountId?.trim() || undefined,
              wiseProfileId: values.wiseProfileId?.trim() || undefined,
              wiseEnabled: Boolean(values.wiseProfileId?.trim()),
            }),
          });
          if (!res.ok) {
            throw new Error('Failed to save payment methods');
          }
          toast.success('Payment methods saved');
        }
      }
      await finishOnboarding();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save payment methods');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
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

      {step === 'use_case' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold">What are you coordinating?</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Provvypay helps coordinate payments, obligations, commissions, and payouts safely.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {ONBOARDING_USE_CASES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleUseCaseSelect(item.id)}
                className={cn(
                  'rounded-lg border p-4 text-left transition-colors hover:bg-accent/60',
                  useCase === item.id && 'border-primary bg-primary/5'
                )}
              >
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'project' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Create your first project</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Projects are where you coordinate participants, payments, obligations, and payouts.
              {selectedUseCaseMeta ? (
                <span className="block mt-1 text-foreground/80">
                  Starting with: <strong>{selectedUseCaseMeta.title}</strong>
                </span>
              ) : null}
            </p>
          </div>
          <Form {...projectForm}>
            <form onSubmit={projectForm.handleSubmit(onProjectSubmit)} className="space-y-4">
              <FormField
                control={projectForm.control}
                name="projectName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project name</FormLabel>
                    <FormControl>
                      <Input placeholder="Q2 contractor settlement" {...field} />
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
          <div>
            <h2 className="text-xl font-semibold">Who needs to get paid?</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Invite participants, contributors, contractors, or referrers into your project. No
              banking or KYC required yet.
            </p>
          </div>
          <div className="space-y-4">
            {participants.map((p, index) => (
              <Card key={index} className="p-4 space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1 space-y-3">
                    <Input
                      placeholder="Name"
                      value={p.name}
                      onChange={(e) => {
                        const next = [...participants];
                        next[index] = { ...next[index], name: e.target.value };
                        setParticipants(next);
                      }}
                    />
                    <Input
                      type="email"
                      placeholder="Email"
                      value={p.email}
                      onChange={(e) => {
                        const next = [...participants];
                        next[index] = { ...next[index], email: e.target.value };
                        setParticipants(next);
                      }}
                    />
                    <Select
                      value={p.role}
                      onValueChange={(v) => {
                        const next = [...participants];
                        next[index] = { ...next[index], role: v as OnboardingParticipantRole };
                        setParticipants(next);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(['Contributor', 'Contractor', 'Referrer', 'Partner'] as const).map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {participants.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setParticipants(participants.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </Card>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setParticipants([...participants, { name: '', email: '', role: 'Contributor' }])
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Add another
            </Button>
          </div>
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
          <div>
            <h2 className="text-xl font-semibold">How will funds enter the system?</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Create your first invoice or payment link to start collecting funds for this project.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link href="/dashboard/payment-links?action=create">
              <Card className="p-6 h-full hover:bg-accent/50 transition-colors cursor-pointer">
                <LinkIcon className="h-6 w-6 text-primary mb-3" />
                <p className="font-semibold">Create invoice</p>
                <CardDescription className="mt-1">
                  Send a branded invoice with payment options.
                </CardDescription>
              </Card>
            </Link>
            <Link href="/dashboard/payment-links?action=create">
              <Card className="p-6 h-full hover:bg-accent/50 transition-colors cursor-pointer">
                <Wallet className="h-6 w-6 text-primary mb-3" />
                <p className="font-semibold">Create payment link</p>
                <CardDescription className="mt-1">
                  Share a link for quick customer payment.
                </CardDescription>
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
          <div>
            <h2 className="text-xl font-semibold">Connect payment methods</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Connect providers when you are ready to collect funds and settle payouts. You can
              configure these later in Settings.
            </p>
          </div>
          <Form {...railsForm}>
            <form onSubmit={railsForm.handleSubmit(onRailsSubmit)} className="space-y-4">
              <FormField
                control={railsForm.control}
                name="stripeAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stripe (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="acct_xxxxxxxxxxxxx" {...field} />
                    </FormControl>
                    <FormDescription>Card payments via Stripe Connect.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={railsForm.control}
                name="wiseProfileId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Wise profile ID (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Wise profile ID" {...field} />
                    </FormControl>
                    <FormDescription>Bank transfer and international payouts.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={railsForm.control}
                name="hederaAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hedera account (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="0.0.12345" {...field} />
                    </FormControl>
                    <FormDescription>Crypto settlement rail.</FormDescription>
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
                    Finish setup
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </div>
      )}
    </div>
  );
}
