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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import {
  ADVANCED_SETTLEMENT_SECTION_COPY,
  getClearingAccountsForUi,
  getSummaryClearingAccounts,
  RECOMMENDED_SETUP_BANNER,
  RECOMMENDED_STANDARD_MAPPINGS,
  type RecommendedClearingAccountConfig,
  type RecommendedStandardMappingConfig,
  type XeroMappingField,
} from '@/lib/accounting/recommended-accounting-config';
import {
  buildRecommendedMappings,
  getMissingRecommendedClearingAccounts,
  hasStandardRecommendedMappingAvailable,
  mergeRecommendedMappingsIntoEmptyFields,
  type RecommendedMappings,
} from '@/lib/accounting/recommended-clearing-accounts-service';
import {
  CLEARING_ACCOUNTS_EXPLANATION,
  MAPPING_SUMMARY_FRIENDLY_LABELS,
  MAPPING_SUMMARY_INTRO,
  XERO_MAPPING_GUIDANCE,
  type MerchantPaymentRails,
} from '@/lib/xero/xero-setup-guidance';
import { ContextualHelp } from '@/components/commercial-os/setup-assistant';
import {
  XERO_CONTEXTUAL_HELP,
  XERO_GUIDED_SECTION_IDS,
} from '@/lib/xero/xero-guided-setup-config';
import { useCommercialReadinessOptional } from '@/hooks/use-commercial-readiness';

interface XeroAccountMappingProps {
  organizationId: string;
  stablecoinSettlementsEnabled?: boolean;
  merchantRails?: MerchantPaymentRails;
  showContextualHelp?: boolean;
  showGuidedSectionIds?: boolean;
  commercialOs?: boolean;
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
  showContextualHelp = false,
  showGuidedSectionIds = false,
  commercialOs = false,
}: XeroAccountMappingProps) {
  const readiness = useCommercialReadinessOptional();
  const searchParams = useSearchParams();
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
  const [accountsLoaded, setAccountsLoaded] = React.useState(false);
  const [mappingsLoaded, setMappingsLoaded] = React.useState(false);

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

  const missingClearingAccountFields = React.useMemo(
    () => new Set(missingClearingAccounts.map((config) => config.mappingField)),
    [missingClearingAccounts]
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
        setAccountsLoaded(false);
        return;
      }

      setConnectionReady(true);
      await fetchAccounts();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
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
      setAccountsLoaded(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      toast.error(errorMessage);
      setAccountsLoaded(false);
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
      setMappingsLoaded(true);
    } catch (err) {
      console.error('Error fetching mappings:', err);
      setMappingsLoaded(true);
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
      const errorMessage = err instanceof Error ? err.message : 'Failed to save mappings';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  }

  async function handleApplyRecommended() {
    try {
      setApplyingRecommended(true);
      setError(null);

      const recommended = buildRecommendedMappings(accounts, mappings as RecommendedMappings, {
        includeStablecoinRails: rails.stablecoinSettlementsEnabled,
      });
      const merged = mergeRecommendedMappingsIntoEmptyFields(
        mappings as RecommendedMappings,
        recommended
      );

      if (Object.keys(recommended).length === 0) {
        toast.info('All recommended mappings are already configured');
        return;
      }

      setMappings(merged);

      const saved = await persistMappings(
        merged,
        'Recommended accounting mappings applied'
      );
      if (saved) {
        setMappings(merged);
      } else {
        setDirty(true);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to apply recommended mappings';
      setError(errorMessage);
      toast.error(errorMessage);
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
      setAccountsLoaded(true);

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
        const summary = failed
          .map(
            (item: { config: { accountName: string }; error: string }) =>
              `${item.config.accountName}: ${item.error}`
          )
          .join(' · ');
        toast.error(
          `${failed.length} holding account${failed.length === 1 ? '' : 's'} could not be created in Xero`,
          { description: summary }
        );
        setError(summary);
      }

      void readiness?.refresh();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to create clearing accounts';
      setError(errorMessage);
      toast.error(errorMessage);
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

  const hasPersistedCoreMappings = Boolean(
    persistedMappings.xero_revenue_account_id?.trim() &&
      persistedMappings.xero_receivable_account_id?.trim()
  );

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
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error}
          {error.includes('No active Xero connection') && (
            <span className="block mt-2">Connect to Xero using the button above.</span>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">
          {commercialOs ? 'Choose which Xero accounts to use' : 'Advanced Accounting Settings'}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {hasPersistedCoreMappings
            ? commercialOs
              ? 'Review the accounts Provvy uses when sending invoices and payments to Xero.'
              : 'Review the accounts Provvy uses when syncing invoices and payments to Xero. Change these only if your accountant advises, your chart of accounts changes, or you enable stablecoin settlements.'
            : commercialOs
              ? 'Choose which Xero accounts Provvy should use. Use suggested accounts or pick from your Xero accounts, then save.'
              : 'Choose which Xero accounts Provvy should use for invoices and payments. Apply recommended mappings or select accounts manually, then save.'}
        </p>
      </div>

      {showStandardRecommendedBanner ? (
        <Alert className="border-emerald-200 bg-emerald-50/80">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertTitle className="text-emerald-900">Suggested accounts</AlertTitle>
          <AlertDescription className="space-y-3 text-emerald-900/90">
            <p>
              Match sales, unpaid invoices, and card fees to common names in your Xero accounts.
              This saves your choices in Provvy — it does not create new accounts in Xero.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={handleApplyRecommended}
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
                    {RECOMMENDED_SETUP_BANNER.applyButtonLabel}
                  </>
                )}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {missingClearingAccounts.length > 0 ? (
        <div id={showGuidedSectionIds ? XERO_GUIDED_SECTION_IDS.clearingAccounts : undefined}>
        <Alert className="border-amber-200 bg-amber-50/70">
          <AlertCircle className="h-4 w-4 text-amber-700" />
          <AlertTitle className="text-amber-900">{CLEARING_ACCOUNTS_EXPLANATION.title}</AlertTitle>
          <AlertDescription className="space-y-3 text-amber-900/90">
            <p>{CLEARING_ACCOUNTS_EXPLANATION.body}</p>
            <p>{CLEARING_ACCOUNTS_EXPLANATION.action}</p>
            <p className="text-sm">{CLEARING_ACCOUNTS_EXPLANATION.reassurance}</p>
            <ul className="list-disc pl-5 text-sm space-y-1">
              {missingClearingAccounts.map((config) => (
                <li key={config.mappingField}>
                  <span className="font-medium">{config.accountName}</span>
                </li>
              ))}
            </ul>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-300 bg-white hover:bg-amber-50"
              onClick={handleCreateClearingAccounts}
              disabled={creatingAccounts || saving || applyingRecommended}
            >
              {creatingAccounts ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating accounts...
                </>
              ) : (
                RECOMMENDED_SETUP_BANNER.createButtonLabel
              )}
            </Button>
          </AlertDescription>
        </Alert>
        </div>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-4">
        <div className="space-y-1">
          <h4 className="text-sm font-medium">Required for invoices</h4>
          <p className="text-xs text-muted-foreground">
            Provvy needs these accounts before invoices can sync to Xero.
          </p>
        </div>

        {RECOMMENDED_STANDARD_MAPPINGS.filter(
          (config) => config.mappingField === 'xero_revenue_account_id'
        ).map((config) => (
          <div
            key={config.mappingField}
            id={showGuidedSectionIds ? XERO_GUIDED_SECTION_IDS.revenue : undefined}
          >
            <StandardMappingField
              config={config}
              accounts={accounts}
              value={mappings[config.mappingField] || ''}
              onChange={(value) => updateMapping(config.mappingField, value)}
              showContextualHelp={showContextualHelp}
              contextualHelpText={XERO_CONTEXTUAL_HELP.revenue}
            />
          </div>
        ))}

        {RECOMMENDED_STANDARD_MAPPINGS.filter(
          (config) => config.mappingField === 'xero_receivable_account_id'
        ).map((config) => (
          <div
            key={config.mappingField}
            id={showGuidedSectionIds ? XERO_GUIDED_SECTION_IDS.receivable : undefined}
          >
            <StandardMappingField
              config={config}
              accounts={accounts}
              value={mappings[config.mappingField] || ''}
              onChange={(value) => updateMapping(config.mappingField, value)}
              showContextualHelp={showContextualHelp}
              contextualHelpText={XERO_CONTEXTUAL_HELP.receivable}
            />
          </div>
        ))}

        {showStripeMappings || showCryptoMappings ? (
          <div
            id={showGuidedSectionIds ? XERO_GUIDED_SECTION_IDS.paymentRails : undefined}
            className="space-y-4"
          >
        {showStripeMappings && stripeClearingConfig ? (
          <div className="space-y-4 rounded-lg border bg-muted/10 p-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-medium">Stripe</h4>
                {showContextualHelp ? (
                  <ContextualHelp
                    text={XERO_CONTEXTUAL_HELP.paymentRails}
                  />
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Map how Stripe card payments appear in your Xero books.
              </p>
            </div>
            <ClearingMappingField
              config={stripeClearingConfig}
              accounts={accounts}
              value={mappings[stripeClearingConfig.mappingField] || ''}
              onChange={(value) => updateMapping(stripeClearingConfig.mappingField, value)}
              existsInXero={!missingClearingAccounts.some(
                (item) => item.mappingField === stripeClearingConfig.mappingField
              )}
              showContextualHelp={showContextualHelp}
              contextualHelpText={XERO_CONTEXTUAL_HELP.stripeClearing}
            />
            {RECOMMENDED_STANDARD_MAPPINGS.filter(
              (config) => config.mappingField === 'xero_fee_expense_account_id'
            ).map((config) => (
              <div
                key={config.mappingField}
                id={showGuidedSectionIds ? XERO_GUIDED_SECTION_IDS.processorFees : undefined}
              >
                <StandardMappingField
                  config={config}
                  accounts={accounts}
                  value={mappings[config.mappingField] || ''}
                  onChange={(value) => updateMapping(config.mappingField, value)}
                  showContextualHelp={showContextualHelp}
                  contextualHelpText={XERO_CONTEXTUAL_HELP.processorFees}
                />
              </div>
            ))}
          </div>
        ) : null}

        {showCryptoMappings ? (
          <details className="rounded-lg border bg-muted/20 p-4">
            <summary className="cursor-pointer text-sm font-medium">
              Other payment methods
            </summary>
            <p className="mt-3 text-sm text-muted-foreground">{ADVANCED_SETTLEMENT_SECTION_COPY}</p>
            <div className="mt-4 space-y-4">
              {cryptoClearingConfigs.map((config) => (
                <ClearingMappingField
                  key={config.mappingField}
                  config={config}
                  accounts={accounts}
                  value={mappings[config.mappingField] || ''}
                  onChange={(value) => updateMapping(config.mappingField, value)}
                  existsInXero={!missingClearingAccounts.some(
                    (item) => item.mappingField === config.mappingField
                  )}
                  showContextualHelp={showContextualHelp}
                  contextualHelpText={XERO_MAPPING_GUIDANCE[config.mappingField]}
                />
              ))}
            </div>
          </details>
        ) : null}
          </div>
        ) : null}
      </div>

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
                Save Changes
              </>
            )}
          </Button>
        ) : null}

        <Button onClick={handleReset} disabled={saving || loading} variant="outline">
          Reset to Defaults
        </Button>

        <Button
          onClick={fetchAccounts}
          disabled={loading}
          variant="outline"
          className="ml-auto"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh Accounts
        </Button>
      </div>

      <MappingSummary
        mappings={persistedMappings}
        accounts={accounts}
        accountsLoaded={accountsLoaded}
        stablecoinSettlementsEnabled={rails.stablecoinSettlementsEnabled}
        stripeEnabled={rails.stripeEnabled}
        missingClearingAccountFields={missingClearingAccountFields}
        hasUnsavedChanges={dirty}
      />
    </div>
  );
}

function StandardMappingField({
  config,
  accounts,
  value,
  onChange,
  showContextualHelp = false,
  contextualHelpText,
}: {
  config: RecommendedStandardMappingConfig;
  accounts: XeroAccount[];
  value: string;
  onChange: (value: string) => void;
  showContextualHelp?: boolean;
  contextualHelpText?: string;
}) {
  const guidance = XERO_MAPPING_GUIDANCE[config.mappingField];
  return (
    <AccountMappingField
      label={config.label}
      description={config.description}
      guidance={guidance}
      showContextualHelp={showContextualHelp}
      contextualHelpText={contextualHelpText}
      accounts={getAccountOptions(accounts, config.preferredAccountTypes)}
      value={value}
      onChange={onChange}
      placeholder={`Select ${config.label.toLowerCase()}`}
    />
  );
}

function ClearingMappingField({
  config,
  accounts,
  value,
  onChange,
  existsInXero,
  showContextualHelp = false,
  contextualHelpText,
}: {
  config: RecommendedClearingAccountConfig;
  accounts: XeroAccount[];
  value: string;
  onChange: (value: string) => void;
  existsInXero: boolean;
  showContextualHelp?: boolean;
  contextualHelpText?: string;
}) {
  return (
    <div className="space-y-2">
      <AccountMappingField
        label={config.uiLabel ?? config.accountName}
        description={
          config.helperText ??
          'Temporary clearing account used until funds are settled or converted.'
        }
        guidance={XERO_MAPPING_GUIDANCE[config.mappingField]}
        showContextualHelp={showContextualHelp}
        contextualHelpText={contextualHelpText}
        accounts={getAccountOptions(accounts, config.preferredAccountTypes ?? ['CURRENT'])}
        value={value}
        onChange={onChange}
        placeholder={`Select ${config.accountName}`}
        badge={existsInXero ? undefined : 'Recommended'}
      />
      {!existsInXero ? (
        <p className="text-xs text-amber-700">
          Suggested account <span className="font-medium">{config.accountName}</span> is not in
          your Xero accounts yet. Use &ldquo;{RECOMMENDED_SETUP_BANNER.createButtonLabel}&rdquo; above
          to add it.
        </p>
      ) : null}
    </div>
  );
}

function AccountMappingField({
  label,
  description,
  guidance,
  showContextualHelp = false,
  contextualHelpText,
  accounts,
  value,
  onChange,
  placeholder,
  badge,
}: {
  label: string;
  description: string;
  guidance?: string;
  showContextualHelp?: boolean;
  contextualHelpText?: string;
  accounts: XeroAccount[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  badge?: string;
}) {
  const accountOptions = React.useMemo(() => {
    if (value && !accounts.some((account) => account.code === value)) {
      return [
        {
          accountID: `orphan-${value}`,
          code: value,
          name: `Saved code ${value} (not in current chart)`,
          type: '',
          status: 'ACTIVE',
        },
        ...accounts,
      ];
    }
    return accounts;
  }, [accounts, value]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="block text-sm font-medium">{label}</label>
        {badge ? (
          <Badge variant="secondary" className="text-xs">
            {badge}
          </Badge>
        ) : null}
        {showContextualHelp && contextualHelpText ? (
          <ContextualHelp text={contextualHelpText} />
        ) : null}
      </div>
      {guidance ? (
        <p className="text-sm text-foreground/90 leading-relaxed">{guidance}</p>
      ) : null}
      <p className="text-xs text-muted-foreground">{description}</p>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className="w-full bg-background text-foreground">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="bg-popover text-popover-foreground">
          {accountOptions.length === 0 ? (
            <SelectItem value="_none" disabled>
              No accounts available
            </SelectItem>
          ) : (
            accountOptions.map((account) => (
              <SelectItem key={account.accountID} value={account.code}>
                {account.code} - {account.name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

function MappingSummary({
  mappings,
  accounts,
  accountsLoaded,
  stablecoinSettlementsEnabled,
  stripeEnabled = true,
  missingClearingAccountFields,
  hasUnsavedChanges = false,
}: {
  mappings: Partial<AccountMappings>;
  accounts: XeroAccount[];
  accountsLoaded: boolean;
  stablecoinSettlementsEnabled: boolean;
  stripeEnabled?: boolean;
  missingClearingAccountFields: Set<XeroMappingField>;
  hasUnsavedChanges?: boolean;
}) {
  const summaryItems = [
    ...RECOMMENDED_STANDARD_MAPPINGS.map((config) => ({
      kind: 'standard' as const,
      config,
    })),
    ...getSummaryClearingAccounts(stablecoinSettlementsEnabled).map((config) => ({
      kind: 'clearing' as const,
      config,
    })),
  ].filter(({ config }) => {
    if (config.mappingField === 'xero_stripe_clearing_account_id' && !stripeEnabled) {
      return false;
    }
    if (config.mappingField === 'xero_fee_expense_account_id' && !stripeEnabled) {
      return false;
    }
    const clearing = getSummaryClearingAccounts(stablecoinSettlementsEnabled).find(
      (c) => c.mappingField === config.mappingField
    );
    if (clearing?.requiresStablecoinRail && !stablecoinSettlementsEnabled) {
      return false;
    }
    return true;
  });

  if (summaryItems.length === 0) return null;

  if (!accountsLoaded) {
    return (
      <div className="bg-muted/50 p-4 rounded-lg mt-6">
        <p className="text-sm text-muted-foreground">Loading saved mapping status…</p>
      </div>
    );
  }

  return (
    <div className="bg-muted/50 p-4 rounded-lg mt-6 space-y-3">
      <h4 className="font-medium text-sm">{MAPPING_SUMMARY_INTRO.title}</h4>
      <div className="text-sm space-y-2">
        {summaryItems.map(({ kind, config }) => {
          const standardConfig =
            kind === 'standard' ? (config as RecommendedStandardMappingConfig) : null;
          const clearingConfig =
            kind === 'clearing' ? (config as RecommendedClearingAccountConfig) : null;
          const friendlyLabel =
            MAPPING_SUMMARY_FRIENDLY_LABELS[config.mappingField] ??
            standardConfig?.summaryLabel ??
            clearingConfig?.summaryLabel;

          return (
            <MappingSummaryRow
              key={config.mappingField}
              friendlyLabel={friendlyLabel ?? config.mappingField}
              recommendedTargetName={
                clearingConfig?.accountName ??
                (standardConfig?.preferredCodes[0] && standardConfig.preferredNames[0]
                  ? `${standardConfig.preferredCodes[0]} ${standardConfig.preferredNames[0]}`
                  : standardConfig?.preferredNames[0])
              }
              accountId={mappings[config.mappingField]}
              accounts={accounts}
              isClearingAccount={kind === 'clearing'}
              clearingMissingFromChart={missingClearingAccountFields.has(config.mappingField)}
            />
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground pt-1">
        {hasUnsavedChanges
          ? 'Summary shows saved choices. Save your changes above before Provvy uses them.'
          : MAPPING_SUMMARY_INTRO.footer}
      </p>
    </div>
  );
}

function MappingSummaryRow({
  friendlyLabel,
  recommendedTargetName,
  accountId,
  accounts,
  isClearingAccount = false,
  clearingMissingFromChart = false,
}: {
  friendlyLabel: string;
  recommendedTargetName?: string;
  accountId?: string;
  accounts: XeroAccount[];
  isClearingAccount?: boolean;
  clearingMissingFromChart?: boolean;
}) {
  const savedCode = accountId?.trim();
  const account = savedCode ? accounts.find((item) => item.code === savedCode) : undefined;

  if (!savedCode) {
    const suffix =
      isClearingAccount && clearingMissingFromChart ? ' (account not in Xero chart yet)' : '';
    const recommendationHint =
      !isClearingAccount && recommendedTargetName ? ` — recommended: ${recommendedTargetName}` : '';
    return (
      <div className="flex items-start gap-2 text-sm">
        <span className="text-amber-600" aria-hidden>
          ○
        </span>
        <span className="text-amber-900">
          {friendlyLabel} → Not configured{suffix}{recommendationHint}
        </span>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex items-start gap-2 text-sm">
        <span className="text-amber-600" aria-hidden>
          ○
        </span>
        <span className="text-amber-900">
          {friendlyLabel} → Saved code {savedCode} is not in your current Xero chart
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-emerald-600" aria-hidden>
        ✓
      </span>
      <span className="text-foreground">
        {friendlyLabel} → {account.name}
      </span>
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
