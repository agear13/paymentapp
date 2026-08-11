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
  FileText,
  Landmark,
  Loader2,
  Send,
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
  isPaymentRailConfiguredForMerchant,
  toPaymentLinkRailSnapshot,
  type PaymentLinkRailSetupStatus,
} from '@/lib/payment-links/setup-status';
import type { PaymentMethod } from '@prisma/client';
import { isValidShortCode } from '@/lib/short-code';
import { CommercialOsNextStepBanner } from '@/components/journey/lovable/commercial-os-next-step-banner';
import { AccountingFirstInvoiceBanner } from '@/components/journey/lovable/accounting-first-invoice-banner';
import { CreateInvoicePreviewSidebar } from '@/components/journey/lovable/create-invoice-preview-sidebar';
import {
  CREATE_INVOICE_INPUT_CLS,
  CreateInvoiceFieldLabel,
  CreateInvoiceFormCard,
  CreateInvoiceFormSkeleton,
  CreateInvoicePaymentMethodOption,
  CreateInvoiceWorkflowProgress,
} from '@/components/journey/lovable/create-invoice-ui';
import {
  computeCreateInvoiceWorkflowProgress,
  validateCreateInvoiceSubmitReadiness,
  validateCreateInvoicePaymentRailReadiness,
} from '@/lib/commercial-os/create-invoice-progress';
import {
  CRYPTO_UNAVAILABLE_REASON,
  fetchMerchantDedicatedRailDefaults,
  MANUAL_BANK_UNAVAILABLE_REASON,
  type MerchantDedicatedRailDefaults,
} from '@/lib/payment-links/merchant-dedicated-rail-defaults';

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

const PAYMENTS_SETTINGS_HREF = `${COMMERCIAL_OS_ROUTES.payments}?from=invoice`;

type InvoicePaymentMethodOptionView = ReturnType<typeof buildInvoicePaymentMethodOptions>[number] & {
  configured: boolean;
};

function isCreateInvoicePaymentMethodConfigured(
  value: PaymentMethod,
  railSetup: ReturnType<typeof computePaymentLinkRailSetup>,
  railDefaults: MerchantDedicatedRailDefaults
): boolean {
  if (value === 'MANUAL_BANK') return Boolean(railDefaults.manualBank);
  if (value === 'CRYPTO') return Boolean(railDefaults.crypto);
  return isPaymentRailConfiguredForMerchant(value, railSetup);
}

function paymentSettingsHref(method: string): string {
  return `${PAYMENTS_SETTINGS_HREF}&method=${encodeURIComponent(method)}`;
}

const inputCls = CREATE_INVOICE_INPUT_CLS;

function toDateInputValue(d: Date | undefined): string {
  if (!d || Number.isNaN(d.getTime())) return '';
  return format(d, 'yyyy-MM-dd');
}

function parseDateInput(value: string): Date | undefined {
  if (!value.trim()) return undefined;
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

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
  const sendHref = `${detailHref}?send=1`;

  return (
    <div className="animate-fade-up mx-auto max-w-2xl space-y-8 pb-24 pt-4">
      <div className="text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <Check className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-[-0.03em]">Invoice created</h1>
        <p className="mt-3 text-[15px] text-ink-soft">
          {reference} is ready to send
          {created.amount != null && created.currency
            ? ` · ${formatCurrency(Number(created.amount), created.currency)}`
            : ''}
          .
        </p>
      </div>

      <CommercialOsNextStepBanner
        title="Next recommended action"
        message="Send this invoice to your customer so they can view details and pay."
        action={
          <Link
            href={sendHref}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-purple px-5 text-[13.5px] font-semibold text-primary-foreground shadow-glow transition-all hover:brightness-110"
          >
            <Send className="h-4 w-4" />
            Send invoice
          </Link>
        }
      />

      <AccountingFirstInvoiceBanner returnTo={detailHref} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          href={detailHref}
          className="inline-flex h-12 flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-card px-4 text-[13px] font-semibold transition-colors hover:bg-secondary"
        >
          <FileText className="h-4 w-4" />
          Open invoice
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
          href={COMMERCIAL_OS_ROUTES.workspace}
          className="inline-flex h-12 flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-card px-4 text-[13px] font-semibold transition-colors hover:bg-secondary"
        >
          <ArrowRight className="h-4 w-4" />
          Return to workspace
        </Link>
      </div>
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
  const [railDefaults, setRailDefaults] = useState<MerchantDedicatedRailDefaults>({
    manualBank: null,
    crypto: null,
  });
  const [railDefaultsLoaded, setRailDefaultsLoaded] = useState(false);

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
    if (!organizationId) {
      setRailDefaults({ manualBank: null, crypto: null });
      setRailDefaultsLoaded(false);
      return;
    }

    let cancelled = false;
    setRailDefaultsLoaded(false);

    void (async () => {
      try {
        const defaults = await fetchMerchantDedicatedRailDefaults(organizationId);
        if (!cancelled) setRailDefaults(defaults);
      } catch {
        if (!cancelled) setRailDefaults({ manualBank: null, crypto: null });
      } finally {
        if (!cancelled) setRailDefaultsLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

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

  const paymentMethodOptions = useMemo((): InvoicePaymentMethodOptionView[] => {
    const base = buildInvoicePaymentMethodOptions({
      setup: railSetup,
      features: platformFeatures,
    });

    return base.map((opt) => {
      if (opt.value === 'MANUAL_BANK') {
        const ready = Boolean(railDefaults.manualBank);
        return {
          ...opt,
          available: ready,
          configured: ready,
          unavailableReason: ready ? undefined : MANUAL_BANK_UNAVAILABLE_REASON,
        };
      }
      if (opt.value === 'CRYPTO') {
        const ready = Boolean(railDefaults.crypto);
        return {
          ...opt,
          available: ready,
          configured: ready,
          unavailableReason: ready ? undefined : CRYPTO_UNAVAILABLE_REASON,
        };
      }
      return {
        ...opt,
        configured: isCreateInvoicePaymentMethodConfigured(opt.value, railSetup, railDefaults),
      };
    });
  }, [railSetup, platformFeatures, railDefaults]);

  useEffect(() => {
    if (!merchantSettingsLoaded || !railDefaultsLoaded || draft.paymentMethod) return;
    const firstAvailable = paymentMethodOptions.find((opt) => opt.available)?.value;
    if (firstAvailable) {
      patchDraft({ paymentMethod: firstAvailable });
    }
  }, [
    merchantSettingsLoaded,
    railDefaultsLoaded,
    draft.paymentMethod,
    paymentMethodOptions,
    patchDraft,
  ]);

  useEffect(() => {
    if (!railDefaultsLoaded || !draft.paymentMethod) return;
    const selected = paymentMethodOptions.find((opt) => opt.value === draft.paymentMethod);
    if (selected && !selected.available) {
      const fallback = paymentMethodOptions.find((opt) => opt.available)?.value;
      patchDraft({ paymentMethod: fallback });
    }
  }, [railDefaultsLoaded, draft.paymentMethod, paymentMethodOptions, patchDraft]);

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
    if (draft.paymentMethod === 'MANUAL_BANK' && !railDefaults.manualBank) {
      return 'Add your business bank account in Payment Settings before using manual bank transfer.';
    }
    if (draft.paymentMethod === 'CRYPTO' && !railDefaults.crypto) {
      return 'Add your crypto wallet in Payment Settings before using crypto payments.';
    }
    return 'Review the preview, then create your invoice.';
  }, [draft, railSetup.anyRailConfigured, railDefaults]);

  const hasXeroConnected = useMemo(
    () => (connectedSystems ?? []).some((s) => s.name === 'Xero'),
    [connectedSystems]
  );

  const showPaymentRailGuidance =
    hasXeroConnected &&
    !railSetup.anyRailConfigured &&
    merchantSettingsLoaded &&
    railDefaultsLoaded &&
    (Boolean(railDefaults.manualBank) || Boolean(railDefaults.crypto));

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
    const railReadiness = validateCreateInvoicePaymentRailReadiness(draft, {
      railSetup,
      manualBankReady: Boolean(railDefaults.manualBank),
      cryptoReady: Boolean(railDefaults.crypto),
    });
    if (!railReadiness.ready && railReadiness.blockMessage) {
      setSubmitError(railReadiness.blockMessage);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createPaymentLinkFromDraft(organizationId, draft, {
        manualBank: railDefaults.manualBank,
        crypto: railDefaults.crypto,
      });
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
    <CreateInvoiceForm
      draft={draft}
      patchDraft={patchDraft}
      guidance={guidance}
      submitError={submitError}
      isSubmitting={isSubmitting}
      handleSubmit={handleSubmit}
      router={router}
      showPaymentRailGuidance={showPaymentRailGuidance}
      paymentMethodOptions={paymentMethodOptions}
      railDefaults={railDefaults}
      railDefaultsLoaded={railDefaultsLoaded}
      merchantSettingsLoaded={merchantSettingsLoaded}
      railSetup={railSetup}
      anyRailConfigured={railSetup.anyRailConfigured}
      previewAmount={previewAmount}
      connectedSystems={connectedSystems}
      aiPrompt={aiPrompt}
      setAiPrompt={setAiPrompt}
      handleAiGenerate={handleAiGenerate}
    />
  );
}

function CreateInvoiceForm({
  draft,
  patchDraft,
  guidance,
  submitError,
  isSubmitting,
  handleSubmit,
  router,
  showPaymentRailGuidance,
  paymentMethodOptions,
  railDefaults,
  railDefaultsLoaded,
  merchantSettingsLoaded,
  railSetup,
  anyRailConfigured,
  previewAmount,
  connectedSystems,
  aiPrompt,
  setAiPrompt,
  handleAiGenerate,
}: {
  draft: CommercialDealDraft;
  patchDraft: (patch: Partial<CommercialDealDraft>) => void;
  guidance: string;
  submitError: string | null;
  isSubmitting: boolean;
  handleSubmit: () => void;
  router: ReturnType<typeof useRouter>;
  showPaymentRailGuidance: boolean;
  paymentMethodOptions: InvoicePaymentMethodOptionView[];
  railDefaults: MerchantDedicatedRailDefaults;
  railDefaultsLoaded: boolean;
  merchantSettingsLoaded: boolean;
  railSetup: PaymentLinkRailSetupStatus;
  anyRailConfigured: boolean;
  previewAmount: string;
  connectedSystems: ConnectedSystemCard[] | null;
  aiPrompt: string;
  setAiPrompt: (value: string) => void;
  handleAiGenerate: () => void;
}) {
  const [showValidation, setShowValidation] = useState(false);
  const validation = useMemo(
    () =>
      validateCreateInvoiceSubmitReadiness(draft, {
        railSetup,
        manualBankReady: Boolean(railDefaults.manualBank),
        cryptoReady: Boolean(railDefaults.crypto),
      }),
    [draft, railSetup, railDefaults.manualBank, railDefaults.crypto]
  );
  const workflowSteps = useMemo(() => computeCreateInvoiceWorkflowProgress(draft), [draft]);
  const formLoading = !merchantSettingsLoaded || !railDefaultsLoaded;

  const onCreateClick = () => {
    if (!validation.isSubmittable) {
      setShowValidation(true);
      return;
    }
    void handleSubmit();
  };

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

        <CreateInvoiceWorkflowProgress steps={workflowSteps} />
      </header>

      <AccountingFirstInvoiceBanner returnTo={COMMERCIAL_OS_ROUTES.createInvoice} />

      {showPaymentRailGuidance ? (
        <CommercialOsNextStepBanner
          tone="info"
          title="Payment options"
          message={
            <>
              You can invoice today using your saved{' '}
              {railDefaults.manualBank && railDefaults.crypto
                ? 'bank transfer and crypto wallet details'
                : railDefaults.manualBank
                  ? 'bank transfer details'
                  : 'crypto wallet details'}
              . Connect Stripe in{' '}
              <Link href={COMMERCIAL_OS_ROUTES.connected} className="font-medium text-primary hover:underline">
                Connected Systems
              </Link>{' '}
              if you want to accept card payments too.
            </>
          }
        />
      ) : null}

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
        <div className="order-2 space-y-6 lg:order-1">
          {formLoading ? (
            <CreateInvoiceFormSkeleton />
          ) : (
            <>
          <CreateInvoiceFormCard
            title="Customer"
            icon={User}
            incomplete={showValidation && !validation.customer}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <CreateInvoiceFieldLabel
                  required
                  invalid={showValidation && !validation.customer}
                >
                  Name
                </CreateInvoiceFieldLabel>
                <input
                  type="text"
                  value={draft.customerName}
                  onChange={(e) => patchDraft({ customerName: e.target.value })}
                  placeholder="Beth's Bakery"
                  className={inputCls}
                  aria-invalid={showValidation && !validation.customer}
                />
              </div>
              <div>
                <CreateInvoiceFieldLabel>Email</CreateInvoiceFieldLabel>
                <input
                  type="email"
                  value={draft.customerEmail}
                  onChange={(e) => patchDraft({ customerEmail: e.target.value })}
                  placeholder="beth@example.com"
                  className={inputCls}
                />
              </div>
              <div>
                <CreateInvoiceFieldLabel>Phone</CreateInvoiceFieldLabel>
                <input
                  type="tel"
                  value={draft.customerPhone}
                  onChange={(e) => patchDraft({ customerPhone: e.target.value })}
                  placeholder="Optional"
                  className={inputCls}
                />
              </div>
            </div>
            {showValidation && !validation.customer ? (
              <p className="mt-3 text-[12.5px] text-amber-700 dark:text-amber-400">
                Add a customer name or email address.
              </p>
            ) : null}
          </CreateInvoiceFormCard>

          <CreateInvoiceFormCard
            title="Invoice details"
            icon={FileText}
            incomplete={showValidation && !validation.description}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <CreateInvoiceFieldLabel
                  required
                  invalid={showValidation && !validation.description}
                >
                  Description
                </CreateInvoiceFieldLabel>
                <textarea
                  value={draft.description}
                  onChange={(e) => patchDraft({ description: e.target.value })}
                  placeholder="Marketing campaign — March 2026"
                  rows={2}
                  className={`${inputCls} resize-none`}
                  aria-invalid={showValidation && !validation.description}
                />
              </div>
              <div>
                <CreateInvoiceFieldLabel>Invoice reference</CreateInvoiceFieldLabel>
                <input
                  type="text"
                  value={draft.invoiceReference}
                  onChange={(e) => patchDraft({ invoiceReference: e.target.value })}
                  placeholder="INV-0042"
                  className={inputCls}
                />
              </div>
              <div>
                <CreateInvoiceFieldLabel>Issue date</CreateInvoiceFieldLabel>
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
                <CreateInvoiceFieldLabel>Due date</CreateInvoiceFieldLabel>
                <input
                  type="date"
                  value={toDateInputValue(draft.dueDate)}
                  onChange={(e) => patchDraft({ dueDate: parseDateInput(e.target.value) })}
                  className={inputCls}
                />
              </div>
            </div>
          </CreateInvoiceFormCard>

          <CreateInvoiceFormCard
            title="Amount"
            icon={CreditCard}
            incomplete={showValidation && !validation.amount}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <CreateInvoiceFieldLabel required invalid={showValidation && !validation.amount}>
                  Amount
                </CreateInvoiceFieldLabel>
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
                  aria-invalid={showValidation && !validation.amount}
                />
              </div>
              <div>
                <CreateInvoiceFieldLabel required>Currency</CreateInvoiceFieldLabel>
                <div className="mt-1.5">
                  <CurrencySelect
                    value={draft.currency}
                    onValueChange={(currency) => patchDraft({ currency })}
                    commercialInvoiceMode
                  />
                </div>
              </div>
            </div>
          </CreateInvoiceFormCard>

          <CreateInvoiceFormCard
            title="Payment method"
            icon={Landmark}
            incomplete={showValidation && !validation.paymentMethod}
          >
            <fieldset className="space-y-2">
              <legend className="sr-only">Payment method</legend>
              {paymentMethodOptions.map((opt) => (
                <CreateInvoicePaymentMethodOption
                  key={opt.value}
                  value={opt.value as NonNullable<CommercialDealDraft['paymentMethod']>}
                  label={opt.label}
                  selected={draft.paymentMethod === opt.value}
                  available={opt.available}
                  configured={opt.configured}
                  unavailableReason={opt.unavailableReason}
                  onSelect={() =>
                    patchDraft({
                      paymentMethod: opt.value as CommercialDealDraft['paymentMethod'],
                    })
                  }
                />
              ))}
            </fieldset>
            {!anyRailConfigured ? (
              <p className="mt-4 text-[12.5px] leading-relaxed text-ink-soft">
                Connect Stripe or Wise in{' '}
                <Link href={COMMERCIAL_OS_ROUTES.connected} className="font-medium text-primary hover:underline">
                  Connected Systems
                </Link>{' '}
                for card and international bank payments.
              </p>
            ) : null}
            {railDefaultsLoaded && !railDefaults.manualBank ? (
              <p className="mt-3 text-[12.5px] leading-relaxed text-ink-soft">
                {MANUAL_BANK_UNAVAILABLE_REASON}{' '}
                <Link href={paymentSettingsHref('Manual Bank Transfer')} className="font-medium text-primary hover:underline">
                  Open Payment Settings
                </Link>
              </p>
            ) : null}
            {railDefaultsLoaded && !railDefaults.crypto ? (
              <p className="mt-3 text-[12.5px] leading-relaxed text-ink-soft">
                {CRYPTO_UNAVAILABLE_REASON}{' '}
                <Link href={paymentSettingsHref('Crypto Payments')} className="font-medium text-primary hover:underline">
                  Open Payment Settings
                </Link>
              </p>
            ) : null}
            {railDefaults.manualBank ? (
              <p className="mt-4 text-[12.5px] text-ink-soft">
                Bank transfer details from your Payment Settings will appear on this invoice automatically.
              </p>
            ) : null}
            {railDefaults.crypto ? (
              <p className="mt-2 text-[12.5px] text-ink-soft">
                Crypto wallet details from your Payment Settings will appear on this invoice automatically.
              </p>
            ) : null}
          </CreateInvoiceFormCard>
            </>
          )}
        </div>

        <div className="order-1 lg:order-2">
          <CreateInvoicePreviewSidebar
            draft={draft}
            previewAmount={previewAmount}
            guidance={guidance}
            paymentMethodOptions={paymentMethodOptions}
            connectedSystems={connectedSystems}
            loading={formLoading}
          />
        </div>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex w-[min(1280px,calc(100%-2rem))] flex-wrap items-center justify-between gap-4 py-4">
          <div className="min-w-0 flex-1">
            {submitError ? (
              <p className="text-[13px] text-destructive" role="alert">
                {submitError}
              </p>
            ) : showValidation && validation.submitBlockMessage ? (
              <p className="text-[13px] text-amber-700 dark:text-amber-400" role="status">
                {validation.submitBlockMessage}
              </p>
            ) : showValidation && !validation.isSubmittable ? (
              <p className="text-[13px] text-amber-700 dark:text-amber-400" role="status">
                Complete required fields: {validation.missingLabels.join(', ')}.
              </p>
            ) : formLoading ? (
              <p className="truncate text-[13px] text-ink-soft">Loading payment settings…</p>
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
              disabled={isSubmitting || formLoading}
              onClick={onCreateClick}
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
