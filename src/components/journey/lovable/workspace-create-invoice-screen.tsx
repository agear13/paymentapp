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
  EntitlementRequiredError,
  type CreatePaymentLinkResult,
} from '@/lib/payment-links/create-payment-link-from-draft';
import { useEntitlements } from '@/hooks/use-entitlements';
import { EntitlementUpgradePanel } from '@/components/entitlements/entitlement-upgrade-panel';
import { StripeConnectReadinessSummary } from '@/components/commercial-os/stripe-connect-readiness-summary';
import { EntitlementLoading } from '@/components/entitlements/entitlement-loading';
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
  merchantCreateInvoicePaymentLabel,
} from '@/components/journey/lovable/create-invoice-ui';
import {
  areCreateInvoiceFieldsSubmittable,
  computeCreateInvoiceWorkflowProgress,
  deriveCreateInvoiceFooterMessage,
  pickDefaultCreateInvoicePaymentMethod,
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
  wiseAutoSettlementAvailable?: boolean;
  evmGloballyEnabled?: boolean;
  defaultCurrency?: string | null;
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
  const {
    loading: entitlementsLoading,
    isAllowed,
    pilotBypass,
  } = useEntitlements();

  const [draft, setDraft] = useState<CommercialDealDraft>(() => defaultCommercialDealDraft());
  const [merchantSettings, setMerchantSettings] = useState<MerchantSettingsSnapshot | null>(null);
  const [merchantSettingsLoaded, setMerchantSettingsLoaded] = useState(false);
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
  const [invoiceNumberHint, setInvoiceNumberHint] = useState<{
    source: 'xero' | 'provvy' | 'manual';
    suggestionLabel?: string;
    ambiguousReason?: string;
  } | null>(null);
  const [invoiceReferenceEdited, setInvoiceReferenceEdited] = useState(false);
  const [invoiceReferenceLoading, setInvoiceReferenceLoading] = useState(false);

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
            wiseAutoSettlementAvailable:
              (settings._features as { wiseAutoSettlementAvailable?: boolean } | undefined)
                ?.wiseAutoSettlementAvailable ?? false,
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

    const loadInvoiceNumberSuggestion = async () => {
      setInvoiceReferenceLoading(true);
      try {
        const response = await fetch(
          `/api/payment-links/next-reference?organizationId=${organizationId}`
        );
        if (!response.ok) return;
        const json = (await response.json()) as {
          data?: {
            invoiceReference?: string | null;
            source?: 'xero' | 'provvy' | 'manual';
            suggestionLabel?: string;
            ambiguousReason?: string;
          };
        };
        if (cancelled) return;
        const data = json.data;
        if (!data) return;

        setInvoiceNumberHint({
          source: data.source ?? 'provvy',
          suggestionLabel: data.suggestionLabel,
          ambiguousReason: data.ambiguousReason,
        });

        const suggested = data.invoiceReference?.trim();
        if (!suggested) return;
        setDraft((prev) =>
          invoiceReferenceEdited || prev.invoiceReference.trim()
            ? prev
            : { ...prev, invoiceReference: suggested }
        );
      } catch {
        // Non-blocking
      } finally {
        if (!cancelled) setInvoiceReferenceLoading(false);
      }
    };

    void loadInvoiceNumberSuggestion();

    return () => {
      cancelled = true;
    };
  }, [organizationId, invoiceReferenceEdited]);

  const platformFeatures = useMemo(
    () => ({
      wisePayments: merchantSettings?.wiseGloballyEnabled ?? false,
      evmWalletPayments: merchantSettings?.evmGloballyEnabled ?? false,
      wiseAutoSettlementAvailable: merchantSettings?.wiseAutoSettlementAvailable ?? false,
    }),
    [
      merchantSettings?.wiseGloballyEnabled,
      merchantSettings?.evmGloballyEnabled,
      merchantSettings?.wiseAutoSettlementAvailable,
    ]
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
    const defaultMethod = pickDefaultCreateInvoicePaymentMethod(paymentMethodOptions);
    if (defaultMethod) {
      patchDraft({
        paymentMethod: defaultMethod as CommercialDealDraft['paymentMethod'],
      });
    }
  }, [
    merchantSettingsLoaded,
    railDefaultsLoaded,
    draft.paymentMethod,
    paymentMethodOptions,
    patchDraft,
  ]);

  useEffect(() => {
    if (!railDefaultsLoaded || !merchantSettingsLoaded || !draft.paymentMethod) return;
    const selected = paymentMethodOptions.find((opt) => opt.value === draft.paymentMethod);
    if (selected && !selected.available) {
      const fallback = pickDefaultCreateInvoicePaymentMethod(paymentMethodOptions);
      patchDraft({
        paymentMethod: fallback as CommercialDealDraft['paymentMethod'] | undefined,
      });
    }
  }, [railDefaultsLoaded, merchantSettingsLoaded, draft.paymentMethod, paymentMethodOptions, patchDraft]);

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
    if (draft.paymentMethod === 'MANUAL_BANK' && !railDefaults.manualBank) {
      return 'Add your business bank account in Payment settings before using bank transfer.';
    }
    if (draft.paymentMethod === 'CRYPTO' && !railDefaults.crypto) {
      return 'Add your crypto wallet in Payment settings before using crypto payments.';
    }
    return 'Review the preview, then create your invoice.';
  }, [draft, railDefaults]);

  const hasPreviewAmount = typeof draft.amount === 'number' && draft.amount > 0;
  const previewAmount = hasPreviewAmount
    ? formatCurrency(draft.amount!, draft.currency)
    : 'Add amount';

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
      if (error instanceof EntitlementRequiredError) {
        setSubmitError(error.userMessage);
        return;
      }
      const message =
        error instanceof Error ? error.message : 'Failed to create invoice. Please try again.';
      if (message === 'feature_gated') {
        setSubmitError('Payment Links are available on Professional. Upgrade your plan to create invoices.');
        return;
      }
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

  if (entitlementsLoading) {
    return <EntitlementLoading label="Checking plan access…" className="min-h-[40vh]" />;
  }

  const canCreatePaymentLinks = pilotBypass || isAllowed('payment_links');

  if (!canCreatePaymentLinks) {
    return (
      <EntitlementUpgradePanel
        feature="payment_links"
        pageTitle="Create invoices and collect payments"
        footer={<StripeConnectReadinessSummary className="mt-2" />}
      />
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
      paymentMethodOptions={paymentMethodOptions}
      railDefaults={railDefaults}
      railDefaultsLoaded={railDefaultsLoaded}
      merchantSettingsLoaded={merchantSettingsLoaded}
      railSetup={railSetup}
      previewAmount={previewAmount}
      hasPreviewAmount={hasPreviewAmount}
      aiPrompt={aiPrompt}
      setAiPrompt={setAiPrompt}
      handleAiGenerate={handleAiGenerate}
      invoiceNumberHint={invoiceNumberHint}
      invoiceReferenceLoading={invoiceReferenceLoading}
      onInvoiceReferenceEdited={() => setInvoiceReferenceEdited(true)}
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
  paymentMethodOptions,
  railDefaults,
  railDefaultsLoaded,
  merchantSettingsLoaded,
  railSetup,
  previewAmount,
  hasPreviewAmount,
  aiPrompt,
  setAiPrompt,
  handleAiGenerate,
  invoiceNumberHint,
  invoiceReferenceLoading,
  onInvoiceReferenceEdited,
}: {
  draft: CommercialDealDraft;
  patchDraft: (patch: Partial<CommercialDealDraft>) => void;
  guidance: string;
  submitError: string | null;
  isSubmitting: boolean;
  handleSubmit: () => void;
  router: ReturnType<typeof useRouter>;
  paymentMethodOptions: InvoicePaymentMethodOptionView[];
  railDefaults: MerchantDedicatedRailDefaults;
  railDefaultsLoaded: boolean;
  merchantSettingsLoaded: boolean;
  railSetup: PaymentLinkRailSetupStatus;
  previewAmount: string;
  hasPreviewAmount: boolean;
  aiPrompt: string;
  setAiPrompt: (value: string) => void;
  handleAiGenerate: () => void;
  invoiceNumberHint: {
    source: 'xero' | 'provvy' | 'manual';
    suggestionLabel?: string;
    ambiguousReason?: string;
  } | null;
  invoiceReferenceLoading: boolean;
  onInvoiceReferenceEdited: () => void;
}) {
  const [showValidation, setShowValidation] = useState(false);
  const [formInteracted, setFormInteracted] = useState(false);
  const updateDraft = useCallback(
    (patch: Partial<CommercialDealDraft>) => {
      setFormInteracted(true);
      patchDraft(patch);
    },
    [patchDraft]
  );
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
  const { readyPaymentOptions, setupPaymentOptions } = useMemo(() => {
    const ready = paymentMethodOptions.filter((opt) => opt.configured && opt.available);
    const setup = paymentMethodOptions.filter((opt) => !(opt.configured && opt.available));
    return { readyPaymentOptions: ready, setupPaymentOptions: setup };
  }, [paymentMethodOptions]);
  const selectedPaymentLabel = draft.paymentMethod
    ? merchantCreateInvoicePaymentLabel(draft.paymentMethod).title
    : undefined;
  const showFieldErrors = showValidation || formInteracted;
  const canSubmit = validation.isSubmittable && !formLoading;
  const footerMessage = deriveCreateInvoiceFooterMessage({
    validation,
    formLoading,
    readyPaymentOptionCount: readyPaymentOptions.length,
    showFieldErrors,
    progressiveGuidance: guidance,
  });
  const setupSectionExpanded = readyPaymentOptions.length === 0;

  const onCreateClick = () => {
    if (!validation.isSubmittable) {
      setShowValidation(true);
      setFormInteracted(true);
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

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {formLoading ? (
            <CreateInvoiceFormSkeleton />
          ) : (
            <>
          <CreateInvoiceFormCard
            title="Customer"
            icon={User}
            incomplete={showFieldErrors && !validation.customer}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <CreateInvoiceFieldLabel
                  required
                  invalid={showFieldErrors && !validation.customer}
                >
                  Name
                </CreateInvoiceFieldLabel>
                <input
                  type="text"
                  value={draft.customerName}
                  onChange={(e) => updateDraft({ customerName: e.target.value })}
                  placeholder="Beth's Bakery"
                  className={inputCls}
                  aria-invalid={showFieldErrors && !validation.customer}
                />
              </div>
              <div>
                <CreateInvoiceFieldLabel>Email</CreateInvoiceFieldLabel>
                <input
                  type="email"
                  value={draft.customerEmail}
                  onChange={(e) => updateDraft({ customerEmail: e.target.value })}
                  placeholder="beth@example.com"
                  className={inputCls}
                />
              </div>
              <div>
                <CreateInvoiceFieldLabel>Phone</CreateInvoiceFieldLabel>
                <input
                  type="tel"
                  value={draft.customerPhone}
                  onChange={(e) => updateDraft({ customerPhone: e.target.value })}
                  placeholder="0412 345 678 (optional)"
                  className={inputCls}
                />
              </div>
            </div>
            {showFieldErrors && !validation.customer ? (
              <p className="mt-3 text-[12.5px] text-amber-700 dark:text-amber-400">
                Add a customer name or email address.
              </p>
            ) : null}
          </CreateInvoiceFormCard>

          <CreateInvoiceFormCard
            title="Invoice details"
            icon={FileText}
            incomplete={showFieldErrors && !validation.description}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <CreateInvoiceFieldLabel
                  required
                  invalid={showFieldErrors && !validation.description}
                >
                  Description
                </CreateInvoiceFieldLabel>
                <textarea
                  value={draft.description}
                  onChange={(e) => updateDraft({ description: e.target.value })}
                  placeholder="Marketing campaign — March 2026"
                  rows={2}
                  className={`${inputCls} resize-none`}
                  aria-invalid={showFieldErrors && !validation.description}
                />
              </div>
              <div>
                <CreateInvoiceFieldLabel>
                  {invoiceNumberHint?.source === 'xero' ? 'Invoice number' : 'Invoice reference'}
                </CreateInvoiceFieldLabel>
                <input
                  type="text"
                  value={draft.invoiceReference}
                  onChange={(e) => {
                    onInvoiceReferenceEdited();
                    updateDraft({ invoiceReference: e.target.value });
                  }}
                  placeholder={invoiceNumberHint?.source === 'xero' ? 'INV-00484' : 'INV-0042'}
                  className={inputCls}
                />
                {invoiceReferenceLoading ? (
                  <p className="mt-1.5 text-[12px] text-ink-soft">Loading invoice number suggestion…</p>
                ) : invoiceNumberHint?.source === 'xero' && invoiceNumberHint.suggestionLabel ? (
                  <p className="mt-1.5 text-[12px] text-ink-soft">{invoiceNumberHint.suggestionLabel}</p>
                ) : invoiceNumberHint?.ambiguousReason ? (
                  <p className="mt-1.5 text-[12px] text-amber-700 dark:text-amber-400">
                    {invoiceNumberHint.ambiguousReason}
                  </p>
                ) : invoiceNumberHint?.source === 'provvy' ? (
                  <p className="mt-1.5 text-[12px] text-ink-soft">
                    Auto-generated for this workspace. Edit if needed.
                  </p>
                ) : null}
              </div>
              <div>
                <CreateInvoiceFieldLabel>Issue date</CreateInvoiceFieldLabel>
                <input
                  type="date"
                  value={toDateInputValue(draft.invoiceDate)}
                  onChange={(e) => {
                    const parsed = parseDateInput(e.target.value);
                    if (parsed) updateDraft({ invoiceDate: parsed });
                  }}
                  className={inputCls}
                />
              </div>
              <div>
                <CreateInvoiceFieldLabel>Due date</CreateInvoiceFieldLabel>
                <input
                  type="date"
                  value={toDateInputValue(draft.dueDate)}
                  onChange={(e) => updateDraft({ dueDate: parseDateInput(e.target.value) })}
                  className={inputCls}
                />
              </div>
            </div>
            {showFieldErrors && !validation.description ? (
              <p className="mt-3 text-[12.5px] text-amber-700 dark:text-amber-400">
                Add a description for this invoice.
              </p>
            ) : null}
          </CreateInvoiceFormCard>

          <CreateInvoiceFormCard
            title="Amount"
            icon={CreditCard}
            incomplete={showFieldErrors && !validation.amount}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <CreateInvoiceFieldLabel required invalid={showFieldErrors && !validation.amount}>
                  Amount
                </CreateInvoiceFieldLabel>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.amount ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    updateDraft({ amount: raw === '' ? undefined : Number.parseFloat(raw) });
                  }}
                  placeholder="0.00"
                  className={inputCls}
                  aria-invalid={showFieldErrors && !validation.amount}
                />
              </div>
              <div>
                <CreateInvoiceFieldLabel required>Currency</CreateInvoiceFieldLabel>
                <div className="mt-1.5">
                  <CurrencySelect
                    value={draft.currency}
                    onValueChange={(currency) => updateDraft({ currency })}
                    commercialInvoiceMode
                  />
                </div>
              </div>
            </div>
            {showFieldErrors && !validation.amount ? (
              <p className="mt-3 text-[12.5px] text-amber-700 dark:text-amber-400">
                Enter an amount greater than zero.
              </p>
            ) : null}
          </CreateInvoiceFormCard>

          <CreateInvoiceFormCard
            title="Payment method"
            icon={Landmark}
            incomplete={showFieldErrors && !validation.paymentMethod}
          >
            {readyPaymentOptions.length === 0 ? (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
                <p className="text-[13.5px] font-medium">No payment method is ready yet.</p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
                  Set up at least one payment method before creating an invoice.
                </p>
                <Link
                  href={PAYMENTS_SETTINGS_HREF}
                  className="mt-3 inline-flex text-[12.5px] font-medium text-primary hover:underline"
                >
                  Open Payment settings
                </Link>
              </div>
            ) : null}
            <fieldset className="space-y-3">
              <legend className="sr-only">Payment method</legend>
              {readyPaymentOptions.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
                    Available
                  </p>
                  {readyPaymentOptions.map((opt) => (
                    <CreateInvoicePaymentMethodOption
                      key={opt.value}
                      value={opt.value as NonNullable<CommercialDealDraft['paymentMethod']>}
                      label={opt.label}
                      selected={draft.paymentMethod === opt.value}
                      available={opt.available}
                      configured={opt.configured}
                      unavailableReason={opt.unavailableReason}
                      onSelect={() =>
                        updateDraft({
                          paymentMethod: opt.value as CommercialDealDraft['paymentMethod'],
                        })
                      }
                    />
                  ))}
                </div>
              ) : null}
              {setupPaymentOptions.length > 0 ? (
                <details
                  open={setupSectionExpanded}
                  className="group rounded-xl border border-border/80 bg-secondary/20"
                >
                  <summary className="cursor-pointer list-none px-4 py-3 text-[12.5px] font-medium text-ink-soft marker:content-none">
                    <span className="flex items-center justify-between gap-2">
                      Requires setup
                      <span className="text-[11px] font-normal uppercase tracking-wider opacity-80">
                        {setupPaymentOptions.length} option
                        {setupPaymentOptions.length === 1 ? '' : 's'}
                      </span>
                    </span>
                  </summary>
                  <div className="space-y-2 border-t border-border/60 px-3 pb-3 pt-2">
                    {setupPaymentOptions.map((opt) => (
                      <CreateInvoicePaymentMethodOption
                        key={opt.value}
                        value={opt.value as NonNullable<CommercialDealDraft['paymentMethod']>}
                        label={opt.label}
                        selected={draft.paymentMethod === opt.value}
                        available={opt.available}
                        configured={opt.configured}
                        unavailableReason={opt.unavailableReason}
                        subdued
                        onSelect={() =>
                          updateDraft({
                            paymentMethod: opt.value as CommercialDealDraft['paymentMethod'],
                          })
                        }
                      />
                    ))}
                  </div>
                </details>
              ) : null}
            </fieldset>
            {showFieldErrors && !validation.paymentMethod ? (
              <p className="mt-3 text-[12.5px] text-amber-700 dark:text-amber-400">
                Choose how your customer will pay.
              </p>
            ) : null}
            <p className="mt-4 text-[12.5px] leading-relaxed text-ink-soft">
              Configure card, bank transfer, or crypto in{' '}
              <Link href={PAYMENTS_SETTINGS_HREF} className="font-medium text-primary hover:underline">
                Payment settings
              </Link>
              .
            </p>
          </CreateInvoiceFormCard>

          <details className="rounded-xl border border-border/80 bg-card/50 p-4">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-[13px] font-medium marker:content-none">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden />
              Start with AI
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ink-soft">
                Coming soon
              </span>
            </summary>
            <p className="mt-3 text-[12.5px] text-ink-soft">
              Describe what you are billing and Provvy will draft customer, description, amount, and due
              date for you to review.
            </p>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder={`"Marketing campaign for Beth — $2,500, due in 14 days."`}
              rows={2}
              className={`${inputCls} mt-3 resize-none`}
            />
            <button
              type="button"
              onClick={handleAiGenerate}
              className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-border px-4 text-[12.5px] font-medium transition-colors hover:bg-secondary"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Generate invoice
            </button>
          </details>
            </>
          )}
        </div>

        <div>
          <CreateInvoicePreviewSidebar
            draft={draft}
            previewAmount={previewAmount}
            hasPreviewAmount={hasPreviewAmount}
            paymentMethodLabel={selectedPaymentLabel}
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
            ) : (
              <p
                className={`truncate text-[13px] ${
                  showFieldErrors &&
                  (!areCreateInvoiceFieldsSubmittable(validation) ||
                    (areCreateInvoiceFieldsSubmittable(validation) && !validation.railReady))
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-ink-soft'
                }`}
                role="status"
              >
                {footerMessage}
              </p>
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
              disabled={isSubmitting || formLoading || !canSubmit}
              onClick={onCreateClick}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-purple px-6 text-[14px] font-semibold text-primary-foreground shadow-glow transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
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
