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
  hasAnyRecommendedMappingAvailable,
  mergeRecommendedMappingsIntoEmptyFields,
  type RecommendedMappings,
} from '@/lib/accounting/recommended-clearing-accounts-service';

interface XeroAccountMappingProps {
  organizationId: string;
  stablecoinSettlementsEnabled?: boolean;
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
}: XeroAccountMappingProps) {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = React.useState<XeroAccount[]>([]);
  const [mappings, setMappings] = React.useState<Partial<AccountMappings>>({});
  const [dirty, setDirty] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [creatingAccounts, setCreatingAccounts] = React.useState(false);
  const [applyingRecommended, setApplyingRecommended] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [connectionReady, setConnectionReady] = React.useState(false);
  const [accountsLoaded, setAccountsLoaded] = React.useState(false);
  const [mappingsLoaded, setMappingsLoaded] = React.useState(false);
  const autoAppliedRef = React.useRef(false);

  const clearingAccountsForUi = React.useMemo(
    () => getClearingAccountsForUi(stablecoinSettlementsEnabled),
    [stablecoinSettlementsEnabled]
  );

  const stripeClearingConfig = React.useMemo(
    () => clearingAccountsForUi.find((config) => config.rail === 'Stripe'),
    [clearingAccountsForUi]
  );

  const cryptoClearingConfigs = React.useMemo(
    () => clearingAccountsForUi.filter((config) => config.requiresStablecoinRail),
    [clearingAccountsForUi]
  );

  const missingClearingAccounts = React.useMemo(
    () => getMissingRecommendedClearingAccounts(accounts, clearingAccountsForUi),
    [accounts, clearingAccountsForUi]
  );

  const showRecommendedBanner = React.useMemo(
    () =>
      hasAnyRecommendedMappingAvailable(
        accounts,
        mappings as RecommendedMappings,
        stablecoinSettlementsEnabled
      ) || missingClearingAccounts.length > 0,
    [accounts, mappings, stablecoinSettlementsEnabled, missingClearingAccounts.length]
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
  }, [organizationId, checkConnectionAndLoad]);

  React.useEffect(() => {
    if (searchParams.get('xero_success') === 'connected') {
      autoAppliedRef.current = false;
      checkConnectionAndLoad();
      fetchMappings();
    }
  }, [searchParams, checkConnectionAndLoad]);

  React.useEffect(() => {
    if (!accountsLoaded || !mappingsLoaded || autoAppliedRef.current) return;
    autoAppliedRef.current = true;

    const recommended = buildRecommendedMappings(accounts, mappings as RecommendedMappings, {
      includeStablecoinRails: stablecoinSettlementsEnabled,
    });
    const merged = mergeRecommendedMappingsIntoEmptyFields(
      mappings as RecommendedMappings,
      recommended
    );

    if (JSON.stringify(merged) !== JSON.stringify(mappings)) {
      setMappings(merged);
    }
  }, [accountsLoaded, mappingsLoaded, accounts, mappings, stablecoinSettlementsEnabled]);

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
      if (data) {
        setMappings(data);
        setDirty(false);
      }
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
    setDirty(false);
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
        includeStablecoinRails: stablecoinSettlementsEnabled,
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
        throw new Error(payload.error || 'Failed to create clearing accounts');
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
        toast.info('Recommended clearing accounts already exist in Xero');
      }

      if (failed?.length) {
        toast.error(
          `${failed.length} account${failed.length === 1 ? '' : 's'} could not be created. Check Xero permissions and try again.`
        );
      }
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
      includeStablecoinRails: stablecoinSettlementsEnabled,
    });
    setMappings(recommended);
    setDirty(true);
    toast.info('Mappings reset to recommended defaults');
  }

  function updateMapping(field: XeroMappingField, value: string) {
    setMappings((current) => ({ ...current, [field]: value }));
    setDirty(true);
  }

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
        <h3 className="text-lg font-medium">Advanced Accounting Settings</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Provvypay has already configured recommended accounting settings for your business.
          Most businesses never need to modify these. Only change these settings if your
          accountant has instructed you to, your chart of accounts changes, or you enable
          stablecoin settlements.
        </p>
      </div>

      {showRecommendedBanner ? (
        <Alert className="border-emerald-200 bg-emerald-50/80">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertTitle className="text-emerald-900">{RECOMMENDED_SETUP_BANNER.title}</AlertTitle>
          <AlertDescription className="space-y-3 text-emerald-900/90">
            <p>{RECOMMENDED_SETUP_BANNER.description}</p>
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
        <Alert className="border-amber-200 bg-amber-50/70">
          <AlertCircle className="h-4 w-4 text-amber-700" />
          <AlertTitle className="text-amber-900">Recommended clearing accounts</AlertTitle>
          <AlertDescription className="space-y-3 text-amber-900/90">
            <p>
              The following recommended clearing accounts are not in your Xero chart of accounts yet.
              You can create them in one step — existing accounts with the same name will not be
              duplicated.
            </p>
            <ul className="list-disc pl-5 text-sm space-y-1">
              {missingClearingAccounts.map((config) => (
                <li key={config.mappingField}>
                  <span className="font-medium">{config.accountName}</span>
                  <span className="text-amber-800/80"> — Current Asset</span>
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
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-4">
        {RECOMMENDED_STANDARD_MAPPINGS.filter(
          (config) => config.mappingField !== 'xero_fee_expense_account_id'
        ).map((config) => (
          <StandardMappingField
            key={config.mappingField}
            config={config}
            accounts={accounts}
            value={mappings[config.mappingField] || ''}
            onChange={(value) => updateMapping(config.mappingField, value)}
          />
        ))}

        {stripeClearingConfig ? (
          <ClearingMappingField
            config={stripeClearingConfig}
            accounts={accounts}
            value={mappings[stripeClearingConfig.mappingField] || ''}
            onChange={(value) => updateMapping(stripeClearingConfig.mappingField, value)}
            existsInXero={!missingClearingAccounts.some(
              (item) => item.mappingField === stripeClearingConfig.mappingField
            )}
          />
        ) : null}

        {RECOMMENDED_STANDARD_MAPPINGS.filter(
          (config) => config.mappingField === 'xero_fee_expense_account_id'
        ).map((config) => (
          <StandardMappingField
            key={config.mappingField}
            config={config}
            accounts={accounts}
            value={mappings[config.mappingField] || ''}
            onChange={(value) => updateMapping(config.mappingField, value)}
          />
        ))}

        {stablecoinSettlementsEnabled && cryptoClearingConfigs.length > 0 ? (
          <details className="rounded-lg border bg-muted/20 p-4" open>
            <summary className="cursor-pointer text-sm font-medium">
              Advanced Settlement Accounts
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
                />
              ))}
            </div>
          </details>
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
        mappings={mappings}
        accounts={accounts}
        stablecoinSettlementsEnabled={stablecoinSettlementsEnabled}
      />
    </div>
  );
}

function StandardMappingField({
  config,
  accounts,
  value,
  onChange,
}: {
  config: RecommendedStandardMappingConfig;
  accounts: XeroAccount[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <AccountMappingField
      label={config.label}
      description={config.description}
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
}: {
  config: RecommendedClearingAccountConfig;
  accounts: XeroAccount[];
  value: string;
  onChange: (value: string) => void;
  existsInXero: boolean;
}) {
  return (
    <div className="space-y-2">
      <AccountMappingField
        label={config.uiLabel ?? config.accountName}
        description={
          config.helperText ??
          'Temporary clearing account used until funds are settled or converted.'
        }
        accounts={getAccountOptions(accounts, config.preferredAccountTypes ?? ['CURRENT'])}
        value={value}
        onChange={onChange}
        placeholder={`Select ${config.accountName}`}
        badge={existsInXero ? undefined : 'Recommended'}
      />
      {!existsInXero ? (
        <p className="text-xs text-amber-700">
          Recommended account <span className="font-medium">{config.accountName}</span> is not in
          your Xero chart yet. Use &ldquo;{RECOMMENDED_SETUP_BANNER.createButtonLabel}&rdquo; above
          to add it.
        </p>
      ) : null}
    </div>
  );
}

function AccountMappingField({
  label,
  description,
  accounts,
  value,
  onChange,
  placeholder,
  badge,
}: {
  label: string;
  description: string;
  accounts: XeroAccount[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  badge?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="block text-sm font-medium">{label}</label>
        {badge ? (
          <Badge variant="secondary" className="text-xs">
            {badge}
          </Badge>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
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
    </div>
  );
}

function MappingSummary({
  mappings,
  accounts,
  stablecoinSettlementsEnabled,
}: {
  mappings: Partial<AccountMappings>;
  accounts: XeroAccount[];
  stablecoinSettlementsEnabled: boolean;
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
  ];

  if (summaryItems.length === 0) return null;

  return (
    <div className="bg-muted/50 p-4 rounded-lg mt-6 space-y-2">
      <h4 className="font-medium text-sm mb-3">Mapping Summary</h4>
      <div className="text-sm space-y-2">
        {summaryItems.map(({ kind, config }) => {
          const standardConfig =
            kind === 'standard' ? (config as RecommendedStandardMappingConfig) : null;
          const clearingConfig =
            kind === 'clearing' ? (config as RecommendedClearingAccountConfig) : null;

          return (
            <MappingSummaryRow
              key={config.mappingField}
              summaryLabel={standardConfig?.summaryLabel ?? clearingConfig!.summaryLabel}
              recommendedTargetName={
                clearingConfig?.accountName ??
                (standardConfig?.preferredCodes[0] && standardConfig.preferredNames[0]
                  ? `${standardConfig.preferredCodes[0]} ${standardConfig.preferredNames[0]}`
                  : standardConfig?.preferredNames[0])
              }
              accountId={mappings[config.mappingField]}
              accounts={accounts}
            />
          );
        })}
      </div>
    </div>
  );
}

function MappingSummaryRow({
  summaryLabel,
  recommendedTargetName,
  accountId,
  accounts,
}: {
  summaryLabel: string;
  recommendedTargetName?: string;
  accountId?: string;
  accounts: XeroAccount[];
}) {
  const account = accountId ? accounts.find((item) => item.code === accountId) : undefined;
  const isMapped = Boolean(account);
  const targetLabel = account
    ? account.name
    : (recommendedTargetName ?? 'Not configured');

  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-md px-2 py-1.5 ${
        isMapped ? '' : 'bg-amber-50 border border-amber-200'
      }`}
    >
      <span className={isMapped ? 'text-sm' : 'text-sm text-amber-900'}>
        {summaryLabel} → {targetLabel}
      </span>
      {!isMapped ? (
        <span className="text-xs text-amber-700 whitespace-nowrap">⚠ Action Recommended</span>
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
