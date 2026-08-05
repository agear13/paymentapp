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
  getClearingAccountsForUi,
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
  type MerchantPaymentRails,
} from '@/lib/xero/xero-setup-guidance';
import {
  mappingStateBadgeLabel,
  type MappingDisplayState,
} from '@/lib/commercial-os/xero-invoice-readiness';
import { useCommercialReadinessOptional } from '@/hooks/use-commercial-readiness';

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

type AccountMappings = Record<XeroMappingField, string>;

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
  const [error, setError] = React.useState<string | null>(null);
  const [connectionReady, setConnectionReady] = React.useState(false);

  const rails: MerchantPaymentRails = merchantRails ?? {
    stripeEnabled: true,
    wiseEnabled: false,
    stablecoinSettlementsEnabled,
  };

  const clearingAccountsForUi = React.useMemo(() => {
    let configs = getClearingAccountsForUi(rails.stablecoinSettlementsEnabled);
    if (!rails.stripeEnabled) {
      configs = configs.filter((config) => config.rail !== 'Stripe');
    }
    return configs;
  }, [rails.stripeEnabled, rails.stablecoinSettlementsEnabled]);

  const stripeClearingConfig = React.useMemo(
    () => clearingAccountsForUi.find((config) => config.rail === 'Stripe'),
    [clearingAccountsForUi]
  );

  const cryptoClearingConfigs = React.useMemo(
    () => clearingAccountsForUi.filter((config) => config.requiresStablecoinRail),
    [clearingAccountsForUi]
  );

  const showStripeMappings = rails.stripeEnabled;
  const showCryptoMappings = rails.stablecoinSettlementsEnabled && cryptoClearingConfigs.length > 0;

  const missingClearingAccounts = React.useMemo(
    () => getMissingRecommendedClearingAccounts(accounts, clearingAccountsForUi),
    [accounts, clearingAccountsForUi]
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
        setAccounts([]);
        return;
      }

      setConnectionReady(true);
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

    const response = await fetch('/api/settings/xero-mappings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId,
        ...nextMappings,
      }),
    });

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

      const response = await fetch('/api/xero/accounts/create-recommended-clearing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      });

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

  function fieldState(field: XeroMappingField): MappingDisplayState {
    return readiness?.fieldStates[field] ?? 'recommended';
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
  }, [progressive, searchParams, readiness?.invoiceAccountsNeedAction]);

  const invoiceSummary = (() => {
    if (readiness?.invoiceAccountsNeedAction) {
      const count = readiness.invoiceAccountActionCount;
      return count === 1 ? 'Invoice accounts — 1 to choose' : `Invoice accounts — ${count} to choose`;
    }
    return 'Invoice accounts — Configured';
  })();

  const optionalSummary =
    (readiness?.optionalRecommendedCount ?? 0) > 0
      ? `Payment & reconciliation (optional) — ${readiness?.optionalRecommendedCount} recommended`
      : 'Payment & reconciliation (optional)';

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
              Save
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
    const label =
      XERO_MAPPING_FIELD_LABELS[config.mappingField] ??
      ('uiLabel' in config ? config.uiLabel : undefined) ??
      ('label' in config ? config.label : config.accountName);

    return (
      <MappingFieldRow
        key={config.mappingField}
        label={label}
        accounts={getAccountOptions(
          accounts,
          'preferredAccountTypes' in config
            ? config.preferredAccountTypes
            : config.preferredAccountTypes ?? ['CURRENT']
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
        Connect Xero above to configure account mapping.
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
                    Use suggested invoice accounts
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
        {(showStripeMappings || showCryptoMappings) && (
          <details
            id="payment-reconciliation"
            className="rounded-lg border border-border bg-card"
            open={optionalDetailsOpen}
            onToggle={(event) => setOptionalDetailsOpen((event.target as HTMLDetailsElement).open)}
          >
            <summary className="cursor-pointer px-6 py-4 text-sm font-medium">{optionalSummary}</summary>
            <div className="space-y-4 border-t px-6 pb-6 pt-4">
              {showStripeMappings && stripeClearingConfig
                ? renderMappingField(stripeClearingConfig, 'optional')
                : null}
              {showStripeMappings
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
              {showCryptoMappings
                ? cryptoClearingConfigs.map((config) => renderMappingField(config, 'optional'))
                : null}
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
        {showStripeMappings && stripeClearingConfig
          ? renderMappingField(stripeClearingConfig, 'optional')
          : null}
        {showStripeMappings
          ? RECOMMENDED_STANDARD_MAPPINGS.filter(
              (config) => config.mappingField === 'xero_fee_expense_account_id'
            ).map((config) => renderMappingField(config, 'optional'))
          : null}
        {showCryptoMappings
          ? cryptoClearingConfigs.map((config) => renderMappingField(config, 'optional'))
          : null}
      </div>
      {saveBar}
    </div>
  );
}

function MappingFieldRow({
  label,
  accounts,
  value,
  onChange,
  displayState,
  sectionId,
}: {
  label: string;
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
      <Select value={selectValue} onValueChange={onChange}>
        <SelectTrigger className="w-full bg-background text-foreground">
          <SelectValue placeholder="Select an account" />
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
        <p className="text-xs text-amber-800">Pick an account from your current Xero chart.</p>
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

  const cryptoAccounts = [
    mappings.xero_stripe_clearing_account_id,
    mappings.xero_hbar_clearing_account_id,
    mappings.xero_usdc_clearing_account_id,
    mappings.xero_usdt_clearing_account_id,
    mappings.xero_audd_clearing_account_id,
  ].filter(Boolean);

  const uniqueCryptoAccounts = new Set(cryptoAccounts);
  if (uniqueCryptoAccounts.size !== cryptoAccounts.length) {
    return {
      valid: false,
      error: 'Each clearing account must be mapped to a different Xero account',
    };
  }

  return { valid: true };
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
