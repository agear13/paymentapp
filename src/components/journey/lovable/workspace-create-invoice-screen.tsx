'use client';

import '@/components/journey/lovable/lovable-journey.css';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  CreditCard,
  ExternalLink,
  FileText,
  Landmark,
  Loader2,
  Sparkles,
  User,
} from 'lucide-react';
import { CurrencySelect } from '@/components/payment-links/currency-select';
import { usePaymentLinkUrl } from '@/components/operational/customer-facing-origin-provider';
import { useOrganization } from '@/hooks/use-organization';
import { useToast } from '@/hooks/use-toast';
import {
  defaultCommercialDealDraft,
  type CommercialDealDraft,
} from '@/lib/commercial-os/commercial-deal-draft';
import { formatCurrency } from '@/lib/formatters/format-currency';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import {
  createPaymentLinkFromDraft,
  type CreatePaymentLinkResult,
} from '@/lib/payment-links/create-payment-link-from-draft';
import {
  invoicePublicReference,
} from '@/lib/payment-links/invoice-display-status';
import {
  buildInvoicePaymentMethodOptions,
  computePaymentLinkRailSetup,
  guardrailKindForUnconfiguredPaymentMethod,
  toPaymentLinkRailSnapshot,
} from '@/lib/payment-links/setup-status';
import { isValidShortCode } from '@/lib/short-code';

type MerchantSettingsSnapshot = {
  stripeAccountId?: string | null;
  hederaAccountId?: string | null;
  evmWalletEnabled?: boolean;
  evmWalletAddress?: string | null;
  wiseEnabled?: boolean;
  wiseProfileId?: string | null;
  wiseCurrency?: string | null;
  wiseGloballyEnabled?: boolean;
  evmGloballyEnabled?: boolean;
  defaultCurrency?: string | null;
};

type ConnectedSystemCard = {
  name: string;
  detail: string;
};

const WORKFLOW_STEPS = ['Invoice', 'Payment', 'Settlement', 'Ledger'] as const;

function toDateInputValue(d: Date | undefined): string {
  if (!d || Number.isNaN(d.getTime())) return '';
  return format(d, 'yyyy-MM-dd');
}

function parseDateInput(value: string): Date | undefined {
  if (!value.trim()) return undefined;
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function FormCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <div className="mb-5 flex items-center gap-2.5">
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-secondary text-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-[12px] font-medium text-foreground">
      {children}
      {required ? <span className="text-destructive"> *</span> : null}
    </label>
  );
}

const inputCls =
  'mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[14px] text-foreground outline-none transition-colors placeholder:text-ink-soft focus:border-primary focus:ring-2 focus:ring-primary/20';

function CreateInvoiceSuccess({
  created,
  onCopyLink,
  copied,
}: {
  created: CreatePaymentLinkResult;
  onCopyLink: () => void;
  copied: boolean;
}) {
  const reference = invoicePublicReference(created);
  const detailHref = COMMERCIAL_OS_ROUTES.invoiceDetail(reference, { id: created.id });

  return (
    <div className="animate-fade-up mx-auto max-w-2xl space-y-8 pb-24 pt-4 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <Check className="h-8 w-8" />
      </div>
      <div>
        <h1 className="text-3xl font-semibold tracking-[-0.03em]">Invoice created</h1>
        <p className="mt-3 text-[15px] text-ink-soft">
          {reference} is ready to send
          {created.amount != null && created.currency
            ? ` · ${formatCurrency(Number(created.amount), created.currency)}`
            : ''}
          .
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          href={detailHref}
          className="inline-flex h-12 flex-col items-center justify-center gap-1 rounded-2xl border border-primary/25 bg-accent/30 px-4 text-[13px] font-semibold transition-colors hover:bg-accent/50"
        >
          <FileText className="h-4 w-4 text-primary" />
          View invoice
        </Link>
        <button
          type="button"
          onClick={onCopyLink}
          className="inline-flex h-12 flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-card px-4 text-[13px] font-semibold transition-colors hover:bg-secondary"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied' : 'Copy payment link'}
        </button>
        <Link
          href={COMMERCIAL_OS_ROUTES.receivables}
          className="inline-flex h-12 flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-card px-4 text-[13px] font-semibold transition-colors hover:bg-secondary"
        >
          <ArrowRight className="h-4 w-4" />
          Back to receivables
        </Link>
      </div>

      <Link
        href={detailHref}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
      >
        Open invoice workspace
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

export function WorkspaceCreateInvoiceScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const { organizationId, isLoading: isOrgLoading } = useOrganization();

  const [draft, setDraft] = useState<CommercialDealDraft>(() => defaultCommercialDealDraft());
  const [merchantSettings, setMerchantSettings] = useState<MerchantSettingsSnapshot | null>(null);
  const [merchantSettingsLoaded, setMerchantSettingsLoaded] = useState(false);
  const [connectedSystems, setConnectedSystems] = useState<ConnectedSystemCard[] | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatePaymentLinkResult | null>(null);
  const [copied, setCopied] = useState(false);

  const payCode = created?.shortCode?.trim() ?? '';
  const paymentUrl = usePaymentLinkUrl(isValidShortCode(payCode) ? payCode : null);

  const patchDraft = useCallback((patch: Partial<CommercialDealDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => {
    if (!organizationId) {
      setMerchantSettings(null);
      setMerchantSettingsLoaded(false);
      return;
    }

    let cancelled = false;
    setMerchantSettingsLoaded(false);

    void (async () => {
      try {
        const response = await fetch(`/api/merchant-settings?organizationId=${organizationId}`);
        if (!response.ok) {
          if (!cancelled) setMerchantSettings(null);
          return;
        }
        const data = (await response.json()) as Array<Record<string, unknown>>;
        if (cancelled) return;
        if (data.length > 0) {
          const settings = data[0];
          setMerchantSettings({
            stripeAccountId: settings.stripe_account_id as string | null | undefined,
            hederaAccountId: settings.hedera_account_id as string | null | undefined,
            evmWalletEnabled: settings.evm_wallet_enabled as boolean | undefined,
            evmWalletAddress: settings.evm_wallet_address as string | null | undefined,
            wiseEnabled: settings.wise_enabled as boolean | undefined,
            wiseProfileId: settings.wise_profile_id as string | null | undefined,
            wiseCurrency: (settings.wise_currency as string | null) ?? null,
            wiseGloballyEnabled:
              (settings._features as { wiseGloballyEnabled?: boolean } | undefined)?.wiseGloballyEnabled ??
              false,
            evmGloballyEnabled:
              (settings._features as { evmGloballyEnabled?: boolean } | undefined)?.evmGloballyEnabled ??
              false,
            defaultCurrency: (settings.default_currency as string | null) ?? null,
          });
        } else {
          setMerchantSettings(null);
        }
      } catch {
        if (!cancelled) setMerchantSettings(null);
      } finally {
        if (!cancelled) setMerchantSettingsLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId || !merchantSettingsLoaded) return;
    const acct = merchantSettings?.defaultCurrency?.trim().toUpperCase().slice(0, 3);
    if (acct && acct.length === 3) {
      setDraft((prev) => (prev.currency === 'AUD' ? { ...prev, currency: acct } : prev));
    }
  }, [organizationId, merchantSettingsLoaded, merchantSettings?.defaultCurrency]);

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(
          `/api/payment-links/next-reference?organizationId=${organizationId}`
        );
        if (!response.ok) return;
        const json = (await response.json()) as { data?: { invoiceReference?: string } };
        const suggested = json.data?.invoiceReference?.trim();
        if (cancelled || !suggested) return;
        setDraft((prev) =>
          prev.invoiceReference.trim() ? prev : { ...prev, invoiceReference: suggested }
        );
      } catch {
        // Non-blocking
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) {
      setConnectedSystems(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      const cards: ConnectedSystemCard[] = [];
      const [xeroRes, merchantRes] = await Promise.all([
        fetch(`/api/xero/status?organization_id=${encodeURIComponent(organizationId)}`, {
          cache: 'no-store',
        }),
        fetch(`/api/merchant-settings?organizationId=${encodeURIComponent(organizationId)}`, {
          cache: 'no-store',
        }),
      ]);

      if (!cancelled && xeroRes.ok) {
        const xeroStatus = (await xeroRes.json()) as { connected?: boolean };
        if (xeroStatus.connected) {
          cards.push({ name: 'Xero', detail: 'Accounting · connected' });
        }
      }

      if (!cancelled && merchantRes.ok) {
        const settingsData = (await merchantRes.json()) as Array<{
          stripe_account_id?: string | null;
          wise_enabled?: boolean | null;
          hedera_account_id?: string | null;
        }>;
        const s = settingsData[0];
        if (s?.stripe_account_id) {
          cards.push({ name: 'Stripe', detail: 'Card payments · connected' });
        }
        if (s?.wise_enabled) {
          cards.push({ name: 'Wise', detail: 'International transfers · connected' });
        }
        if (s?.hedera_account_id) {
          cards.push({ name: 'Hedera', detail: 'Crypto payments · connected' });
        }
      }

      if (!cancelled) setConnectedSystems(cards);
    })();

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const platformFeatures = useMemo(
    () => ({
      wisePayments: merchantSettings?.wiseGloballyEnabled ?? false,
      evmWalletPayments: merchantSettings?.evmGloballyEnabled ?? false,
    }),
    [merchantSettings?.wiseGloballyEnabled, merchantSettings?.evmGloballyEnabled]
  );

  const railSetup = useMemo(
    () =>
      computePaymentLinkRailSetup(
        toPaymentLinkRailSnapshot(merchantSettings),
        platformFeatures
      ),
    [merchantSettings, platformFeatures]
  );

  const paymentMethodOptions = useMemo(
    () =>
      buildInvoicePaymentMethodOptions({
        setup: railSetup,
        features: platformFeatures,
      }),
    [railSetup, platformFeatures]
  );

  useEffect(() => {
    if (!merchantSettingsLoaded || draft.paymentMethod) return;
    const firstAvailable =
      paymentMethodOptions.find((opt) => opt.available)?.value ??
      paymentMethodOptions[0]?.value;
    if (firstAvailable) {
      patchDraft({ paymentMethod: firstAvailable });
    }
  }, [merchantSettingsLoaded, draft.paymentMethod, paymentMethodOptions, patchDraft]);

  const guidance = useMemo(() => {
    if (!draft.customerName.trim() && !draft.customerEmail.trim()) {
      return 'Start with who you are billing.';
    }
    if (!draft.description.trim()) {
      return 'Add a clear description so your customer knows what they are paying for.';
    }
    if (!draft.amount || draft.amount <= 0) {
      return 'Enter the amount you are charging.';
    }
    if (!draft.paymentMethod) {
      return 'Choose how your customer will pay.';
    }
    if (!railSetup.anyRailConfigured && draft.paymentMethod !== 'CRYPTO' && draft.paymentMethod !== 'MANUAL_BANK') {
      return 'Connect a payment method in Connected Systems before sending.';
    }
    return 'Review the preview, then create your invoice.';
  }, [draft, railSetup.anyRailConfigured]);

  const previewAmount =
    draft.amount && draft.amount > 0
      ? formatCurrency(draft.amount, draft.currency)
      : formatCurrency(0, draft.currency);

  const handleAiGenerate = () => {
    toast({
      title: 'Coming soon',
      description: 'AI invoice generation will fill customer, description, amount, and due date for you.',
    });
  };

  const handleCopyLink = async () => {
    if (!paymentUrl) {
      toast({
        title: 'Payment link unavailable',
        description: 'Open the invoice to copy the payment link.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(paymentUrl);
      setCopied(true);
      toast({ title: 'Payment link copied' });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: 'Could not copy',
        description: 'Copy the link from the invoice detail page instead.',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async () => {
    if (!organizationId) return;
    setSubmitError(null);

    if (!merchantSettingsLoaded) {
      setSubmitError('Merchant settings are still loading. Please wait a moment.');
      return;
    }

    const pm = draft.paymentMethod;
    if (pm && pm !== 'CRYPTO' && pm !== 'MANUAL_BANK') {
      if (!railSetup.anyRailConfigured) {
        setSubmitError('Connect Stripe, Wise, or another payment method before creating invoices.');
        return;
      }
      const guardrailKind = guardrailKindForUnconfiguredPaymentMethod(pm, railSetup);
      if (guardrailKind) {
        setSubmitError('The selected payment method is not fully set up yet. Check Connected Systems.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const result = await createPaymentLinkFromDraft(organizationId, draft);
      setCreated(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create invoice. Please try again.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isOrgLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center pb-24">
        <Loader2 className="h-6 w-6 animate-spin text-ink-soft" />
      </div>
    );
  }

  if (!organizationId) {
    return (
      <div className="animate-fade-up pb-24">
        <p className="text-[15px] text-ink-soft">Sign in to create an invoice.</p>
      </div>
    );
  }

  if (created) {
    return (
      <CreateInvoiceSuccess created={created} onCopyLink={() => void handleCopyLink()} copied={copied} />
    );
  }

  return (
    <div className="animate-fade-up pb-32">
      <Link
        href={COMMERCIAL_OS_ROUTES.receivables}
        className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-ink-soft transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Receivables
      </Link>

      <header className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">Create Invoice</h1>
          <p className="mt-3 max-w-xl text-[16px] text-ink-soft">
            Issue a payment request without leaving your workspace.
          </p>
        </div>

        <nav
          aria-label="Commercial workflow"
          className="flex flex-wrap items-center gap-2 text-[12px] text-ink-soft"
        >
          {WORKFLOW_STEPS.map((step, i) => (
            <span key={step} className="inline-flex items-center gap-2">
              {i > 0 ? <span className="text-border">→</span> : null}
              <span
                className={
                  i === 0
                    ? 'rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary'
                    : 'rounded-full px-2.5 py-1'
                }
              >
                {step}
              </span>
            </span>
          ))}
        </nav>
      </header>

      <section className="mt-8 rounded-2xl border border-primary/25 bg-gradient-to-br from-accent/40 to-card p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-purple text-primary-foreground shadow-glow">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold">Start with AI</h2>
              <p className="text-[13px] text-ink-soft">Describe what you are billing.</p>
            </div>
          </div>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-ink-soft">
            Coming soon
          </span>
        </div>

        <textarea
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          placeholder={`"I ran a marketing campaign for Beth.\nIt was $2,500 plus GST.\nDue in 14 days."`}
          rows={3}
          className={`${inputCls} mt-4 resize-none`}
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleAiGenerate}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-purple px-5 text-[13.5px] font-semibold text-primary-foreground shadow-glow transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Sparkles className="h-4 w-4" />
            Generate Invoice
          </button>
          <p className="text-[12.5px] text-ink-soft">
            Will fill customer, description, amount, and due date — then you review.
          </p>
        </div>
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <FormCard title="Customer" icon={User}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FieldLabel required>Name</FieldLabel>
                <input
                  type="text"
                  value={draft.customerName}
                  onChange={(e) => patchDraft({ customerName: e.target.value })}
                  placeholder="Beth's Bakery"
                  className={inputCls}
                />
              </div>
              <div>
                <FieldLabel>Email</FieldLabel>
                <input
                  type="email"
                  value={draft.customerEmail}
                  onChange={(e) => patchDraft({ customerEmail: e.target.value })}
                  placeholder="beth@example.com"
                  className={inputCls}
                />
              </div>
              <div>
                <FieldLabel>Phone</FieldLabel>
                <input
                  type="tel"
                  value={draft.customerPhone}
                  onChange={(e) => patchDraft({ customerPhone: e.target.value })}
                  placeholder="Optional"
                  className={inputCls}
                />
              </div>
            </div>
          </FormCard>

          <FormCard title="Invoice details" icon={FileText}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FieldLabel required>Description</FieldLabel>
                <textarea
                  value={draft.description}
                  onChange={(e) => patchDraft({ description: e.target.value })}
                  placeholder="Marketing campaign — March 2026"
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
              </div>
              <div>
                <FieldLabel>Invoice reference</FieldLabel>
                <input
                  type="text"
                  value={draft.invoiceReference}
                  onChange={(e) => patchDraft({ invoiceReference: e.target.value })}
                  placeholder="INV-0042"
                  className={inputCls}
                />
              </div>
              <div>
                <FieldLabel>Issue date</FieldLabel>
                <input
                  type="date"
                  value={toDateInputValue(draft.invoiceDate)}
                  onChange={(e) => {
                    const parsed = parseDateInput(e.target.value);
                    if (parsed) patchDraft({ invoiceDate: parsed });
                  }}
                  className={inputCls}
                />
              </div>
              <div>
                <FieldLabel>Due date</FieldLabel>
                <input
                  type="date"
                  value={toDateInputValue(draft.dueDate)}
                  onChange={(e) => patchDraft({ dueDate: parseDateInput(e.target.value) })}
                  className={inputCls}
                />
              </div>
            </div>
          </FormCard>

          <FormCard title="Amount" icon={CreditCard}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel required>Amount</FieldLabel>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.amount ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    patchDraft({ amount: raw === '' ? undefined : Number.parseFloat(raw) });
                  }}
                  placeholder="0.00"
                  className={inputCls}
                />
              </div>
              <div>
                <FieldLabel required>Currency</FieldLabel>
                <div className="mt-1.5">
                  <CurrencySelect
                    value={draft.currency}
                    onValueChange={(currency) => patchDraft({ currency })}
                    commercialInvoiceMode
                  />
                </div>
              </div>
            </div>
          </FormCard>

          <FormCard title="Payment method" icon={Landmark}>
            <fieldset className="space-y-2">
              <legend className="sr-only">Payment method</legend>
              {paymentMethodOptions.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
                    draft.paymentMethod === opt.value
                      ? 'border-primary/40 bg-accent/30'
                      : 'border-border hover:bg-secondary/40'
                  } ${!opt.available ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={opt.value}
                    checked={draft.paymentMethod === opt.value}
                    disabled={!opt.available}
                    onChange={() => patchDraft({ paymentMethod: opt.value as CommercialDealDraft['paymentMethod'] })}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-[13.5px] font-medium">{opt.label}</span>
                    {!opt.available && opt.unavailableReason ? (
                      <span className="mt-0.5 block text-[12px] text-ink-soft">{opt.unavailableReason}</span>
                    ) : null}
                  </span>
                </label>
              ))}
            </fieldset>
            {!railSetup.anyRailConfigured ? (
              <p className="mt-4 text-[12.5px] text-ink-soft">
                No payment rails connected yet.{' '}
                <Link href={COMMERCIAL_OS_ROUTES.connected} className="font-medium text-primary hover:underline">
                  Set up in Connected Systems
                </Link>
                .
              </p>
            ) : null}
          </FormCard>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">Live preview</div>
            <div className="mt-4 space-y-3">
              <div>
                <div className="text-[11px] text-ink-soft">Customer</div>
                <div className="text-[14px] font-medium">
                  {draft.customerName.trim() || draft.customerEmail.trim() || '—'}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-ink-soft">Description</div>
                <div className="text-[14px]">{draft.description.trim() || '—'}</div>
              </div>
              <div className="flex items-end justify-between gap-3 border-t border-border pt-3">
                <div>
                  <div className="text-[11px] text-ink-soft">Total due</div>
                  <div className="text-2xl font-semibold tracking-tight">{previewAmount}</div>
                </div>
                {draft.dueDate ? (
                  <div className="text-right text-[12px] text-ink-soft">
                    Due {format(draft.dueDate, 'd MMM yyyy')}
                  </div>
                ) : null}
              </div>
              {draft.paymentMethod ? (
                <div className="text-[12px] text-ink-soft">
                  Pay via{' '}
                  {paymentMethodOptions.find((o) => o.value === draft.paymentMethod)?.label ??
                    draft.paymentMethod}
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-primary/20 bg-card p-5 shadow-card">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-purple text-primary-foreground shadow-glow">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="text-[14px] font-semibold tracking-tight">Provvy AI</div>
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-foreground">{guidance}</p>
          </div>

          {connectedSystems && connectedSystems.length > 0 ? (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
                Connected systems
              </div>
              <ul className="mt-3 space-y-2">
                {connectedSystems.map((sys) => (
                  <li key={sys.name} className="flex items-center justify-between text-[13px]">
                    <span className="font-medium">{sys.name}</span>
                    <span className="text-ink-soft">{sys.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex w-[min(1280px,calc(100%-2rem))] flex-wrap items-center justify-between gap-4 py-4">
          <div className="min-w-0 flex-1">
            {submitError ? (
              <p className="text-[13px] text-destructive" role="alert">
                {submitError}
              </p>
            ) : (
              <p className="truncate text-[13px] text-ink-soft">{guidance}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => router.push(COMMERCIAL_OS_ROUTES.receivables)}
              className="inline-flex h-11 items-center rounded-xl px-4 text-[13.5px] font-medium text-ink-soft transition-colors hover:bg-secondary hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleSubmit()}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-purple px-6 text-[14px] font-semibold text-primary-foreground shadow-glow transition-all hover:brightness-110 disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create Invoice
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
