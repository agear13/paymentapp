'use client';

/**
 * Xero Account Mapping Component
 * Maps Provvypay accounts to Xero Chart of Accounts with recommended defaults.
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { formatMappingIssue } from '@/lib/xero/xero-customer-messages';
import { Loader2, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import {
  RECOMMENDED_SETUP_BANNER,
  RECOMMENDED_STANDARD_MAPPINGS,
  type RecommendedClearingAccountConfig,
  type RecommendedStandardMappingConfig,
  type XeroMappingField,
} from '@/lib/accounting/recommended-accounting-config';
import {
  buildRecommendedMappings,
  buildStandardRecommendedMappings,
  getMissingRecommendedClearingAccounts,
  hasStandardRecommendedMappingAvailable,
  mergeRecommendedMappingsIntoEmptyFields,
  type RecommendedMappings,
} from '@/lib/accounting/recommended-clearing-accounts-service';
import {
  XERO_MAPPING_FIELD_LABELS,
  XERO_ACCOUNT_SECTION_COPY,
  getXeroFieldCustomerCopy,
  type MerchantPaymentRails,
} from '@/lib/xero/xero-setup-guidance';
import {
  mappingStateBadgeLabel,
  buildMappingFieldStates,
  type MappingDisplayState,
} from '@/lib/commercial-os/xero-invoice-readiness';
import type { XeroReadinessMappingsPayload } from '@/lib/commercial-os/xero-readiness';
import { getSettlementAccountsForUi } from '@/lib/accounting/settlement-account-ui';
import type { SettlementUiAccountDefinition } from '@/lib/accounting/settlement-account-ui';
import {
  resolvePaymentAccountRecommendation,
} from '@/lib/accounting/payment-account-recommendations';
import { PaymentAccountsSetupSection } from '@/components/xero/payment-accounts-setup-section';
import type { CryptoSettlementStrategy } from '@/lib/accounting/settlement-account-types';
import { validateXeroMappingDuplicates } from '@/lib/accounting/validate-xero-mapping-duplicates';
import { normalizeMerchantPaymentRails } from '@/lib/commercial-os/merchant-payment-rails';
import { csrfAwareFetch } from '@/lib/security/csrf-fetch.client';
import { redirectIfStepUpRequired } from '@/lib/auth/step-up.client';
import { useCommercialReadinessOptional } from '@/hooks/use-commercial-readiness';
import {
  computePaymentLinkRailSetup,
  toPaymentLinkRailSnapshot,
} from '@/lib/payment-links/setup-status';
import {
  deriveMerchantPaymentCapabilities,
  type MerchantPaymentCapabilities,
} from '@/lib/accounting/merchant-payment-capabilities';

function applyMappingError(raw: string, setError: (value: string | null) => void) {
  const customer = formatMappingIssue(raw);
  setError(`${customer.message} ${customer.action}`);
  toast.error(customer.message, { description: customer.action });
}

interface XeroAccountMappingProps {
  organizationId: string;
  stablecoinSettlementsEnabled?: boolean;
  merchantRails?: MerchantPaymentRails;
  showContextualHelp?: boolean;
  showGuidedSectionIds?: boolean;
  commercialOs?: boolean;
  layout?: 'legacy' | 'progressive';
}

interface XeroAccount {
  accountID: string;
  code: string;
  name: string;
  type: string;
  taxType?: string;
  status: string;
  class?: string;
}

type AccountMappings = Partial<Record<XeroMappingField, string>> & {
  crypto_settlement_strategy?: CryptoSettlementStrategy | null;
};

const DEFAULT_ACCOUNT_ORDER = 999;

const ACCOUNT_TYPE_ORDER: Record<string, number> = {
  SALES: 1,
  REVENUE: 2,
  BANK: 3,
  CURRENT: 4,
  CURRLIAB: 5,
  EXPENSE: 6,
  OVERHEADS: 7,
};

export function XeroAccountMapping({
  organizationId,
  stablecoinSettlementsEnabled = false,
  merchantRails,
  showGuidedSectionIds = false,
  layout = 'legacy',
}: XeroAccountMappingProps) {
  const readiness = useCommercialReadinessOptional();
  const searchParams = useSearchParams();
  const progressive = layout === 'progressive';
  const [invoiceDetailsOpen, setInvoiceDetailsOpen] = React.useState(false);
  const [optionalDetailsOpen, setOptionalDetailsOpen] = React.useState(false);
  const [editConfiguredInvoice, setEditConfiguredInvoice] = React.useState(false);
  const [accounts, setAccounts] = React.useState<XeroAccount[]>([]);
  const [mappings, setMappings] = React.useState<Partial<AccountMappings>>({});
  const [persistedMappings, setPersistedMappings] = React.useState<Partial<AccountMappings>>({});
  const [dirty, setDirty] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [creatingAccounts, setCreatingAccounts] = React.useState(false);
  const [applyingRecommended, setApplyingRecommended] = React.useState(false);
  const [refreshingAccounts, setRefreshingAccounts] = React.useState(false);
  const [localCapabilities, setLocalCapabilities] =
    React.useState<MerchantPaymentCapabilities | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [connectionReady, setConnectionReady] = React.useState(false);
  const [connectionStale, setConnectionStale] = React.useState(false);

  const rails: MerchantPaymentRails = React.useMemo(() => {
    if (merchantRails) {
      return normalizeMerchantPaymentRails(merchantRails);
    }
    return normalizeMerchantPaymentRails({
      stripeEnabled: true,
      wiseEnabled: false,
      stablecoinSettlementsEnabled,
      manualBankEnabled: false,
    });
  }, [merchantRails, stablecoinSettlementsEnabled]);

  const merchantCapabilities =
    readiness?.merchantPaymentCapabilities ??
    localCapabilities ?? {
      hederaConfigured: false,
      evmConfigured: false,
      enabledSettlementTokens: [],
    };

  React.useEffect(() => {
    if (readiness?.merchantPaymentCapabilities) {
      return;
    }

    let cancelled = false;

    async function loadCapabilities() {
      try {
        const response = await fetch(
          `/api/merchant-settings?organizationId=${encodeURIComponent(organizationId)}`,
          { cache: 'no-store' }
        );
        if (!response.ok || cancelled) {
          return;
        }

        const rows = (await response.json()) as Array<{
          stripe_account_id?: string | null;
          hedera_account_id?: string | null;
          wise_enabled?: boolean | null;
          wise_profile_id?: string | null;
          evm_wallet_enabled?: boolean | null;
          evm_wallet_address?: string | null;
          evm_supported_networks?: string[] | null;
          evm_supported_tokens?: string[] | null;
          _features?: {
            wiseGloballyEnabled?: boolean;
            evmGloballyEnabled?: boolean;
          };
        }>;
        const settings = rows[0];
        if (!settings || cancelled) {
          return;
        }

        const snapshot = toPaymentLinkRailSnapshot({
          stripeAccountId: settings.stripe_account_id,
          hederaAccountId: settings.hedera_account_id,
          wiseEnabled: settings.wise_enabled ?? false,
          wiseProfileId: settings.wise_profile_id,
          evmWalletEnabled: settings.evm_wallet_enabled,
          evmWalletAddress: settings.evm_wallet_address,
          evmSupportedNetworks: settings.evm_supported_networks,
          evmSupportedTokens: settings.evm_supported_tokens,
        });
        const railSetup = computePaymentLinkRailSetup(snapshot, {
          // Feature flags come from GET /api/merchant-settings `_features` (server-resolved).
          wisePayments: settings._features?.wiseGloballyEnabled ?? false,
          evmWalletPayments: settings._features?.evmGloballyEnabled ?? false,
        });

        if (!cancelled) {
          setLocalCapabilities(
            deriveMerchantPaymentCapabilities({
              railSetup,
              evmSupportedTokens: settings.evm_supported_tokens,
            })
          );
        }
      } catch {
        // Optional fallback — readiness provider is preferred.
      }
    }

    void loadCapabilities();

    return () => {
      cancelled = true;
    };
  }, [organizationId, readiness?.merchantPaymentCapabilities]);

  const chartAccountCodes = React.useMemo(
    () => new Set(accounts.map((account) => account.code).filter(Boolean)),
    [accounts]
  );

  const localFieldStates = React.useMemo(
    () =>
      buildMappingFieldStates(
        mappings as XeroReadinessMappingsPayload,
        connectionReady && accounts.length > 0,
        chartAccountCodes,
        rails,
        merchantCapabilities
      ),
    [mappings, connectionReady, accounts.length, chartAccountCodes, rails, merchantCapabilities]
  );

  const settlementAccountsForUi = React.useMemo(
    () => getSettlementAccountsForUi(mappings, rails, merchantCapabilities),
    [mappings, rails, merchantCapabilities]
  );

  const railSettlementAccounts = React.useMemo(
    () => settlementAccountsForUi.filter((definition) => definition.kind === 'rail'),
    [settlementAccountsForUi]
  );

  const digitalSettlementAccounts = React.useMemo(
    () => settlementAccountsForUi.filter((definition) => definition.kind !== 'rail'),
    [settlementAccountsForUi]
  );

  const showStripeFeeMapping = rails.stripeEnabled;
  const showRailMappings = railSettlementAccounts.length > 0;
  const showCryptoMappings = digitalSettlementAccounts.length > 0;

  const showPaymentSection =
    settlementAccountsForUi.length > 0 || showStripeFeeMapping;

  const missingClearingAccounts = React.useMemo(
    () =>
      getMissingRecommendedClearingAccounts(
        accounts,
        digitalSettlementAccounts.map((definition) => ({
          rail: definition.paymentAsset ?? 'Digital Asset',
          accountName: definition.accountName,
          accountType: 'CURRENT' as const,
          xeroClass: 'ASSET' as const,
          mappingField: definition.mappingField,
          suggestedCode: definition.suggestedCode,
          description: definition.helperText ?? definition.title,
          summaryLabel: definition.title,
        }))
      ),
    [accounts, digitalSettlementAccounts]
  );

  const showStandardRecommendedBanner = React.useMemo(
    () =>
      hasStandardRecommendedMappingAvailable(accounts, persistedMappings as RecommendedMappings),
    [accounts, persistedMappings]
  );

  const checkConnectionAndLoad = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const statusRes = await fetch(
        `/api/xero/status?organization_id=${encodeURIComponent(organizationId)}`,
        { cache: 'no-store' }
      );
      const status = await statusRes.json();

      if (!statusRes.ok || !status.connected) {
        setConnectionReady(false);
        setConnectionStale(false);
        setAccounts([]);
        return;
      }

      setConnectionReady(true);
      setConnectionStale(Boolean(status.stale));
      if (status.stale) {
        setAccounts([]);
        setError(null);
        return;
      }

      await fetchAccounts();
    } catch (err) {
      applyMappingError(
        err instanceof Error ? err.message : 'Could not check Xero connection',
        setError
      );
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  React.useEffect(() => {
    checkConnectionAndLoad();
    fetchMappings();
    setPersistedMappings({});
    setMappings({});
    setDirty(false);
  }, [organizationId, checkConnectionAndLoad]);

  React.useEffect(() => {
    if (searchParams?.get('xero_success') === 'connected') {
      checkConnectionAndLoad();
      fetchMappings();
    }
  }, [searchParams, checkConnectionAndLoad]);

  async function fetchAccounts() {
    try {
      setError(null);

      const response = await fetch(
        `/api/xero/accounts?organization_id=${encodeURIComponent(organizationId)}`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch Xero accounts');
      }

      const { data } = await response.json();
      setAccounts(data);
    } catch (err) {
      applyMappingError(
        err instanceof Error ? err.message : 'Could not load Xero accounts',
        setError
      );
    }
  }

  async function handleRefreshAccounts() {
    try {
      setRefreshingAccounts(true);
      setError(null);
      await fetchAccounts();
      toast.success('Xero accounts refreshed');
    } catch (err) {
      applyMappingError(
        err instanceof Error ? err.message : 'Could not refresh Xero accounts',
        setError
      );
    } finally {
      setRefreshingAccounts(false);
    }
  }

  async function fetchMappings() {
    try {
      const response = await fetch(
        `/api/settings/xero-mappings?organization_id=${organizationId}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch mappings');
      }

      const { data } = await response.json();
      const next = data ?? {};
      setMappings(next);
      setPersistedMappings(next);
      setDirty(false);
    } catch (err) {
      console.error('Error fetching mappings:', err);
    }
  }

  async function persistMappings(nextMappings: Partial<AccountMappings>, successMessage: string) {
    const validation = validateMappings(nextMappings);
    if (!validation.valid) {
      setError(validation.error!);
      toast.error(validation.error!);
      return false;
    }

    const response = await csrfAwareFetch('/api/settings/xero-mappings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId,
        ...nextMappings,
      }),
    });

    if (await redirectIfStepUpRequired(response)) {
      return false;
    }

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to save mappings');
    }

    toast.success(successMessage);
    setPersistedMappings(nextMappings);
    setMappings(nextMappings);
    setDirty(false);
    void readiness?.refresh();
    return true;
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      await persistMappings(mappings, 'Xero account mappings saved successfully');
    } catch (err) {
      applyMappingError(
        err instanceof Error ? err.message : 'Failed to save mappings',
        setError
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleApplyStandardRecommended() {
    try {
      setApplyingRecommended(true);
      setError(null);

      const recommended = buildStandardRecommendedMappings(
        accounts,
        mappings as RecommendedMappings
      );
      const merged = mergeRecommendedMappingsIntoEmptyFields(
        mappings as RecommendedMappings,
        recommended
      );

      if (Object.keys(recommended).length === 0) {
        toast.info('Suggested invoice accounts are already set');
        return;
      }

      setMappings(merged);
      await persistMappings(merged, 'Invoice accounts updated');
    } catch (err) {
      applyMappingError(
        err instanceof Error ? err.message : 'Failed to apply suggested accounts',
        setError
      );
    } finally {
      setApplyingRecommended(false);
    }
  }

  async function handleCreateClearingAccounts() {
    try {
      setCreatingAccounts(true);
      setError(null);

      const response = await csrfAwareFetch('/api/xero/accounts/create-recommended-clearing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      });

      if (await redirectIfStepUpRequired(response)) {
        return;
      }

      const payload = await response.json();
      if (!response.ok) {
        const detail =
          typeof payload.details === 'string' && payload.details.trim()
            ? payload.details
            : payload.error;
        throw new Error(detail || 'Failed to create clearing accounts');
      }

      const { created, existing, failed, accounts: refreshedAccounts } = payload.data;
      setAccounts(refreshedAccounts);

      const nextMappings = { ...mappings };
      for (const item of [...created, ...existing]) {
        const field = item.mappingField as XeroMappingField;
        if (!nextMappings[field]) {
          nextMappings[field] = item.account.code;
        }
      }
      setMappings(nextMappings);

      if (created.length > 0) {
        const saved = await persistMappings(
          nextMappings,
          `Created ${created.length} recommended clearing account${created.length === 1 ? '' : 's'} in Xero`
        );
        if (!saved) setDirty(true);
      } else if (existing.length > 0) {
        const saved = await persistMappings(
          nextMappings,
          'Linked existing clearing accounts from your Xero chart'
        );
        if (!saved) {
          setDirty(true);
          toast.info('Clearing accounts exist in Xero — save mappings to finish linking them');
        }
      }

      if (failed?.length) {
        const customer = formatMappingIssue(
          failed[0]?.error ?? 'Could not create holding accounts in Xero'
        );
        toast.error(
          `${failed.length} holding account${failed.length === 1 ? '' : 's'} could not be added in Xero`,
          { description: customer.action }
        );
        setError(`${customer.message} ${customer.action}`);
      }

      void readiness?.refresh();
    } catch (err) {
      applyMappingError(
        err instanceof Error ? err.message : 'Failed to create holding accounts',
        setError
      );
    } finally {
      setCreatingAccounts(false);
    }
  }

  function handleReset() {
    const recommended = buildRecommendedMappings(accounts, {}, {
      includeStablecoinRails: rails.stablecoinSettlementsEnabled,
    });
    setMappings(recommended);
    setDirty(true);
    toast.info('Mappings reset to recommended defaults');
  }

  function updateMapping(field: XeroMappingField, value: string) {
    setMappings((current) => ({ ...current, [field]: value }));
    setDirty(true);
  }

  function updateCryptoStrategy(strategy: CryptoSettlementStrategy) {
    setMappings((current) => ({ ...current, crypto_settlement_strategy: strategy }));
    setDirty(true);
  }

  function fieldState(field: XeroMappingField): MappingDisplayState {
    return localFieldStates[field] ?? 'recommended';
  }

  function shouldShowMappingField(field: XeroMappingField, section: 'invoice' | 'optional'): boolean {
    const state = fieldState(field);
    if (!progressive) return true;
    if (section === 'invoice') {
      if (state === 'configured' && !editConfiguredInvoice) return false;
      return true;
    }
    return state !== 'configured';
  }

  React.useEffect(() => {
    if (!progressive) return;
    if (
      searchParams?.get('xero_success') === 'connected' ||
      readiness?.invoiceAccountsNeedAction
    ) {
      setInvoiceDetailsOpen(true);
      setEditConfiguredInvoice(true);
    }
    if (readiness?.settlementAccountsNeedAction) {
      setOptionalDetailsOpen(true);
      requestAnimationFrame(() => {
        document.getElementById('payment-reconciliation')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    }
  }, [
    progressive,
    searchParams,
    readiness?.invoiceAccountsNeedAction,
    readiness?.settlementAccountsNeedAction,
  ]);

  async function handleApplyAllPaymentRecommendations() {
    try {
      setApplyingRecommended(true);
      setError(null);

      const settings = mappings;
      const allDefinitions = getSettlementAccountsForUi(settings, rails, merchantCapabilities);
      const nextMappings = { ...mappings };

      for (const definition of allDefinitions) {
        if (nextMappings[definition.mappingField]) continue;
        const recommendation = resolvePaymentAccountRecommendation(
          accounts,
          definition,
          nextMappings[definition.mappingField]
        );
        if (recommendation.recommendedAccount?.code) {
          nextMappings[definition.mappingField] = recommendation.recommendedAccount.code;
        }
      }

      if (JSON.stringify(nextMappings) === JSON.stringify(mappings)) {
        toast.info('Recommended payment accounts are already linked');
        return;
      }

      setMappings(nextMappings);
      await persistMappings(nextMappings, 'Payment accounts linked');
    } catch (err) {
      applyMappingError(
        err instanceof Error ? err.message : 'Failed to link recommended payment accounts',
        setError
      );
    } finally {
      setApplyingRecommended(false);
    }
  }

  const invoiceSummary = (() => {
    if (readiness?.invoiceAccountsNeedAction) {
      const count = readiness.invoiceAccountActionCount;
      return XERO_ACCOUNT_SECTION_COPY.invoiceSummaryRequired(count);
    }
    return XERO_ACCOUNT_SECTION_COPY.invoiceSummaryDone;
  })();

  const paymentSectionSummary = (() => {
    if (readiness?.settlementAccountsNeedAction) {
      const count = readiness.settlementAccountActionCount;
      return XERO_ACCOUNT_SECTION_COPY.paymentSummaryRequired(count);
    }
    const optionalCount = readiness?.optionalRecommendedCount ?? 0;
    if (optionalCount > 0) {
      return XERO_ACCOUNT_SECTION_COPY.paymentSummaryWithOptional(optionalCount);
    }
    return XERO_ACCOUNT_SECTION_COPY.paymentSummaryDone;
  })();

  const saveBar = (
    <div className="flex gap-3 pt-4 border-t">
      {dirty ? (
        <Button onClick={handleSave} disabled={saving || loading} className="min-w-[120px]">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Save choices
            </>
          )}
        </Button>
      ) : null}
      {!progressive ? (
        <Button onClick={handleReset} disabled={saving || loading} variant="outline">
          Reset to Defaults
        </Button>
      ) : null}
    </div>
  );

  const errorAlert = error ? (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        {(() => {
          const customer = formatMappingIssue(error);
          return (
            <>
              <p>{customer.message}</p>
              <p className="mt-2">{customer.action}</p>
            </>
          );
        })()}
      </AlertDescription>
    </Alert>
  ) : null;

  const invoiceFields = RECOMMENDED_STANDARD_MAPPINGS.filter((config) =>
    ['xero_revenue_account_id', 'xero_receivable_account_id'].includes(config.mappingField)
  );

  const renderMappingField = (
    config: RecommendedStandardMappingConfig | RecommendedClearingAccountConfig,
    section: 'invoice' | 'optional'
  ) => {
    if (!shouldShowMappingField(config.mappingField, section)) return null;
    const state = fieldState(config.mappingField);
    const customerCopy = getXeroFieldCustomerCopy(config.mappingField);
    const label =
      customerCopy?.label ??
      XERO_MAPPING_FIELD_LABELS[config.mappingField] ??
      ('uiLabel' in config ? config.uiLabel : undefined) ??
      ('label' in config ? config.label : config.accountName);
    const helperText =
      customerCopy?.helper ??
      ('description' in config ? config.description : undefined) ??
      ('helperText' in config ? config.helperText : undefined);
    const learnMore = customerCopy?.learnMore;

    return (
      <MappingFieldRow
        key={config.mappingField}
        label={label}
        helperText={helperText}
        learnMore={learnMore}
        accounts={getAccountOptions(
          accounts,
          ('preferredAccountTypes' in config ? config.preferredAccountTypes : undefined) ?? [
            'CURRENT',
          ]
        )}
        value={mappings[config.mappingField] || ''}
        onChange={(value) => updateMapping(config.mappingField, value)}
        displayState={state}
        sectionId={
          showGuidedSectionIds && config.mappingField === 'xero_revenue_account_id'
            ? 'guided-xero-revenue'
            : showGuidedSectionIds && config.mappingField === 'xero_receivable_account_id'
              ? 'guided-xero-receivable'
              : showGuidedSectionIds && config.mappingField === 'xero_fee_expense_account_id'
                ? 'guided-xero-processor-fees'
                : undefined
        }
      />
    );
  };

  const renderSettlementField = (
    definition: SettlementUiAccountDefinition,
    section: 'invoice' | 'optional'
  ) => {
    if (!shouldShowMappingField(definition.mappingField, section)) return null;
    const state = fieldState(definition.mappingField);

    const customerCopy = getXeroFieldCustomerCopy(definition.mappingField);
    const learnMore =
      customerCopy?.learnMore ??
      'A holding account is a temporary place in Xero for money that is on its way to you.';

    return (
      <MappingFieldRow
        key={definition.id}
        label={definition.title}
        helperText={definition.helperText ?? customerCopy?.helper}
        learnMore={learnMore}
        accounts={getAccountOptions(accounts, ['BANK', 'CURRENT', 'CURRLIAB'])}
        value={mappings[definition.mappingField] || ''}
        onChange={(value) => updateMapping(definition.mappingField, value)}
        displayState={state}
      />
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading Xero accounts...</span>
      </div>
    );
  }

  if (!connectionReady) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        Connect Xero above to choose accounts.
      </p>
    );
  }

  if (connectionStale) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        Reconnect Xero above to load accounts.
      </p>
    );
  }

  if (error && accounts.length === 0) {
    const customer = formatMappingIssue(error);
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <p>{customer.message}</p>
          <p className="mt-2">{customer.action}</p>
        </AlertDescription>
      </Alert>
    );
  }

  if (progressive) {
    return (
      <div className="space-y-3">
        {errorAlert}
        <details
          id="invoice-accounts"
          className="rounded-lg border border-border bg-card"
          open={invoiceDetailsOpen}
          onToggle={(event) => setInvoiceDetailsOpen((event.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer px-6 py-4 text-sm font-medium">{invoiceSummary}</summary>
          <div className="space-y-4 border-t px-6 pb-6 pt-4">
            <p className="text-sm text-muted-foreground">{XERO_ACCOUNT_SECTION_COPY.invoiceIntro}</p>
            {invoiceFields.map((config) => renderMappingField(config, 'invoice'))}
            {showStandardRecommendedBanner && readiness?.invoiceAccountsNeedAction ? (
              <Button
                size="sm"
                variant="outline"
                onClick={handleApplyStandardRecommended}
                disabled={applyingRecommended || saving || creatingAccounts}
              >
                {applyingRecommended ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Use Provvy&apos;s suggestions
                  </>
                )}
              </Button>
            ) : null}
            {readiness?.allInvoiceAccountsConfigured &&
            !readiness.invoiceAccountsNeedAction &&
            !editConfiguredInvoice ? (
              <button
                type="button"
                className="text-sm text-primary hover:underline"
                onClick={() => {
                  setEditConfiguredInvoice(true);
                  setInvoiceDetailsOpen(true);
                }}
              >
                Change invoice accounts
              </button>
            ) : null}
            {saveBar}
          </div>
        </details>
        {(showPaymentSection) && (
          <details
            id="payment-reconciliation"
            className={`rounded-lg border bg-card ${
              readiness?.settlementAccountsNeedAction
                ? 'border-amber-500/50 ring-1 ring-amber-500/20'
                : 'border-border'
            }`}
            open={optionalDetailsOpen}
            onToggle={(event) => setOptionalDetailsOpen((event.target as HTMLDetailsElement).open)}
          >
            <summary className="cursor-pointer px-6 py-4 text-sm font-medium">{paymentSectionSummary}</summary>
            <div className="space-y-4 border-t px-6 pb-6 pt-4">
              <p className="text-sm text-muted-foreground">{XERO_ACCOUNT_SECTION_COPY.paymentIntro}</p>
              <PaymentAccountsSetupSection
                accounts={accounts}
                mappings={mappings}
                onMappingChange={updateMapping}
                onStrategyChange={updateCryptoStrategy}
                fieldState={fieldState}
                merchantRails={rails}
                merchantCapabilities={merchantCapabilities}
                applyingRecommended={applyingRecommended}
                onApplyAllRecommendations={() => void handleApplyAllPaymentRecommendations()}
                onRefreshAccounts={() => void handleRefreshAccounts()}
                refreshingAccounts={refreshingAccounts}
              />
              {showStripeFeeMapping
                ? RECOMMENDED_STANDARD_MAPPINGS.filter(
                    (config) => config.mappingField === 'xero_fee_expense_account_id'
                  ).map((config) => renderMappingField(config, 'optional'))
                : null}
              {showCryptoMappings && missingClearingAccounts.length > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCreateClearingAccounts}
                  disabled={creatingAccounts || saving || applyingRecommended}
                  id={showGuidedSectionIds ? 'guided-xero-clearing-accounts' : undefined}
                >
                  {creatingAccounts ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding accounts...
                    </>
                  ) : (
                    RECOMMENDED_SETUP_BANNER.createButtonLabel
                  )}
                </Button>
              ) : null}
              {saveBar}
            </div>
          </details>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {errorAlert}
      <div className="space-y-4">
        {invoiceFields.map((config) => renderMappingField(config, 'invoice'))}
        {showRailMappings
          ? railSettlementAccounts.map((definition) =>
              renderSettlementField(definition, 'optional')
            )
          : null}
        {showStripeFeeMapping
          ? RECOMMENDED_STANDARD_MAPPINGS.filter(
              (config) => config.mappingField === 'xero_fee_expense_account_id'
            ).map((config) => renderMappingField(config, 'optional'))
          : null}
        {showCryptoMappings
          ? digitalSettlementAccounts.map((definition) =>
              renderSettlementField(definition, 'optional')
            )
          : null}
      </div>
      {saveBar}
    </div>
  );
}

function MappingFieldRow({
  label,
  helperText,
  learnMore,
  accounts,
  value,
  onChange,
  displayState,
  sectionId,
}: {
  label: string;
  helperText?: string;
  learnMore?: string;
  accounts: XeroAccount[];
  value: string;
  onChange: (value: string) => void;
  displayState: MappingDisplayState;
  sectionId?: string;
}) {
  const selectValue =
    displayState === 'needs_review' ? undefined : value || undefined;

  return (
    <div className="space-y-2" id={sectionId}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm font-medium">{label}</label>
        <Badge
          variant={
            displayState === 'required' || displayState === 'needs_review'
              ? 'outline'
              : 'secondary'
          }
          className={
            displayState === 'required'
              ? 'border-destructive/40 text-destructive'
              : displayState === 'needs_review'
                ? 'border-amber-500/50 text-amber-800'
                : undefined
          }
        >
          {mappingStateBadgeLabel(displayState)}
        </Badge>
      </div>
      {helperText ? <p className="text-sm text-muted-foreground">{helperText}</p> : null}
      <Select value={selectValue} onValueChange={onChange}>
        <SelectTrigger className="w-full bg-background text-foreground">
          <SelectValue placeholder={XERO_ACCOUNT_SECTION_COPY.selectPlaceholder} />
        </SelectTrigger>
        <SelectContent className="bg-popover text-popover-foreground">
          {accounts.length === 0 ? (
            <SelectItem value="_none" disabled>
              No accounts available
            </SelectItem>
          ) : (
            accounts.map((account) => (
              <SelectItem key={account.accountID} value={account.code}>
                {account.code} - {account.name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      {displayState === 'needs_review' ? (
        <p className="text-xs text-amber-800">
          This account is no longer in your Xero chart — please choose a current one.
        </p>
      ) : null}
      {learnMore ? (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">
            {XERO_ACCOUNT_SECTION_COPY.learnMore}
          </summary>
          <p className="mt-1 pl-0">{learnMore}</p>
        </details>
      ) : null}
    </div>
  );
}

function validateMappings(mappings: Partial<AccountMappings>): {
  valid: boolean;
  error?: string;
} {
  if (!mappings.xero_revenue_account_id) {
    return {
      valid: false,
      error: 'Revenue Account is required. Please select an account.',
    };
  }

  return validateXeroMappingDuplicates(mappings);
}

function getAccountOptions(accounts: XeroAccount[], preferredTypes: readonly string[]): XeroAccount[] {
  const preferred = new Set(preferredTypes);
  return [...accounts].sort((a, b) => {
    const aBucket = preferred.has(a.type) ? 0 : 1;
    const bBucket = preferred.has(b.type) ? 0 : 1;
    if (aBucket !== bBucket) {
      return aBucket - bBucket;
    }

    const aOrder = ACCOUNT_TYPE_ORDER[a.type] ?? DEFAULT_ACCOUNT_ORDER;
    const bOrder = ACCOUNT_TYPE_ORDER[b.type] ?? DEFAULT_ACCOUNT_ORDER;
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    return `${a.code} ${a.name}`.localeCompare(`${b.code} ${b.name}`);
  });
}
