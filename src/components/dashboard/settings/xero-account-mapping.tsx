'use client';

/**
 * Xero Account Mapping Component
 * Maps Provvypay accounts to Xero Chart of Accounts
 * Supports 4 crypto clearing accounts: HBAR, USDC, USDT, AUDD
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
import { Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { DefaultAccountingMappingService } from '@/lib/accounting/default-accounting-mapping-service';

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

interface AccountMappings {
  xero_revenue_account_id: string;
  xero_receivable_account_id: string;
  xero_stripe_clearing_account_id: string;
  xero_hbar_clearing_account_id: string;
  xero_usdc_clearing_account_id: string;
  xero_usdt_clearing_account_id: string;
  xero_audd_clearing_account_id: string;
  xero_fee_expense_account_id: string;
}

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
  const [error, setError] = React.useState<string | null>(null);
  const [connectionReady, setConnectionReady] = React.useState(false);

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
      checkConnectionAndLoad();
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
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      toast.error(errorMessage);
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
    } catch (err) {
      console.error('Error fetching mappings:', err);
      // Don't show error toast for missing mappings (expected on first load)
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);

      // Validate all mappings are set
      const validation = validateMappings(mappings);
      if (!validation.valid) {
        setError(validation.error!);
        toast.error(validation.error!);
        return;
      }

      const response = await fetch('/api/settings/xero-mappings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId,
          ...mappings,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save mappings');
      }

      toast.success('Xero account mappings saved successfully');
      setDirty(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save mappings';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    const defaults = getDefaultMappings(accounts);
    setMappings(defaults);
    setDirty(true);
    toast.info('Mappings reset to suggested defaults');
  }

  function updateMapping(field: keyof AccountMappings, value: string) {
    setMappings((current) => ({ ...current, [field]: value }));
    setDirty(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Loading Xero accounts...
        </span>
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
            <span className="block mt-2">
              Connect to Xero using the button above.
            </span>
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

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {/* Revenue Account */}
        <AccountMappingField
          label="Revenue Account"
          description="Sales revenue from invoices"
          accounts={getAccountOptions(accounts, ['SALES', 'REVENUE'])}
          value={mappings.xero_revenue_account_id || ''}
          onChange={(value) => updateMapping('xero_revenue_account_id', value)}
          placeholder="Select revenue account (e.g., 4000 Revenue)"
        />

        {/* Accounts Receivable */}
        <AccountMappingField
          label="Accounts Receivable"
          description="Customer invoices pending payment"
          accounts={getAccountOptions(accounts, ['CURRENT', 'CURRLIAB'])}
          value={mappings.xero_receivable_account_id || ''}
          onChange={(value) => updateMapping('xero_receivable_account_id', value)}
          placeholder="Select receivable account (e.g., 1200 Accounts Receivable)"
        />

        {/* Stripe Clearing */}
        <AccountMappingField
          label="Stripe Clearing Account"
          description="Stripe payment settlements"
          accounts={getAccountOptions(accounts, ['BANK', 'CURRENT', 'CURRLIAB'])}
          value={mappings.xero_stripe_clearing_account_id || ''}
          onChange={(value) => updateMapping('xero_stripe_clearing_account_id', value)}
          placeholder="Select Stripe clearing account"
        />

        {/* Processor Fee Expense */}
        <AccountMappingField
          label="Processor Fee Expense"
          description="Payment processing fees"
          accounts={getAccountOptions(accounts, ['EXPENSE', 'OVERHEADS'])}
          value={mappings.xero_fee_expense_account_id || ''}
          onChange={(value) => updateMapping('xero_fee_expense_account_id', value)}
          placeholder="Select expense account (e.g., 6100 Bank Fees)"
        />

        {stablecoinSettlementsEnabled ? (
          <details className="rounded-lg border bg-muted/20 p-4">
            <summary className="cursor-pointer text-sm font-medium">
              Advanced Settlement Accounts
            </summary>
            <div className="mt-4 space-y-4">
              <AccountMappingField
                label="HBAR"
                description="Optional HBAR settlement clearing account"
                accounts={getAccountOptions(accounts, ['BANK', 'CURRENT', 'CURRLIAB'])}
                value={mappings.xero_hbar_clearing_account_id || ''}
                onChange={(value) => updateMapping('xero_hbar_clearing_account_id', value)}
                placeholder="Select HBAR clearing account"
              />
              <AccountMappingField
                label="USDC"
                description="Optional USDC stablecoin settlement clearing account"
                accounts={getAccountOptions(accounts, ['BANK', 'CURRENT', 'CURRLIAB'])}
                value={mappings.xero_usdc_clearing_account_id || ''}
                onChange={(value) => updateMapping('xero_usdc_clearing_account_id', value)}
                placeholder="Select USDC clearing account"
              />
              <AccountMappingField
                label="USDT"
                description="Optional USDT stablecoin settlement clearing account"
                accounts={getAccountOptions(accounts, ['BANK', 'CURRENT', 'CURRLIAB'])}
                value={mappings.xero_usdt_clearing_account_id || ''}
                onChange={(value) => updateMapping('xero_usdt_clearing_account_id', value)}
                placeholder="Select USDT clearing account"
              />
              <AccountMappingField
                label="AUDD"
                description="Optional AUDD stablecoin settlement clearing account"
                accounts={getAccountOptions(accounts, ['BANK', 'CURRENT', 'CURRLIAB'])}
                value={mappings.xero_audd_clearing_account_id || ''}
                onChange={(value) => updateMapping('xero_audd_clearing_account_id', value)}
                placeholder="Select AUDD clearing account"
                badge="AUD Stablecoin"
              />
            </div>
          </details>
        ) : null}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t">
        {dirty ? (
          <Button
            onClick={handleSave}
            disabled={saving || loading}
            className="min-w-[120px]"
          >
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

        <Button
          onClick={handleReset}
          disabled={saving || loading}
          variant="outline"
        >
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

      {/* Mapping Summary */}
      {Object.keys(mappings).length > 0 && (
        <div className="bg-muted/50 p-4 rounded-lg mt-6 space-y-2">
          <h4 className="font-medium text-sm mb-3">Mapping Summary</h4>
          <div className="text-sm space-y-1">
            <MappingSummaryItem
              label="Revenue"
              accountId={mappings.xero_revenue_account_id}
              accounts={accounts}
            />
            <MappingSummaryItem
              label="Receivables"
              accountId={mappings.xero_receivable_account_id}
              accounts={accounts}
            />
            <MappingSummaryItem
              label="Stripe"
              accountId={mappings.xero_stripe_clearing_account_id}
              accounts={accounts}
            />
            {stablecoinSettlementsEnabled ? (
              <>
                <MappingSummaryItem
                  label="HBAR"
                  accountId={mappings.xero_hbar_clearing_account_id}
                  accounts={accounts}
                />
                <MappingSummaryItem
                  label="USDC"
                  accountId={mappings.xero_usdc_clearing_account_id}
                  accounts={accounts}
                />
                <MappingSummaryItem
                  label="USDT"
                  accountId={mappings.xero_usdt_clearing_account_id}
                  accounts={accounts}
                />
                <MappingSummaryItem
                  label="AUDD"
                  accountId={mappings.xero_audd_clearing_account_id}
                  accounts={accounts}
                />
              </>
            ) : null}
            <MappingSummaryItem
              label="Fees"
              accountId={mappings.xero_fee_expense_account_id}
              accounts={accounts}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Account mapping field component
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
        <label className="block text-sm font-medium">
          {label}
        </label>
        {badge && (
          <Badge variant="secondary" className="text-xs">
            {badge}
          </Badge>
        )}
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

// Mapping summary item component
function MappingSummaryItem({
  label,
  accountId,
  accounts,
}: {
  label: string;
  accountId?: string;
  accounts: XeroAccount[];
}) {
  const account = accounts.find(a => a.code === accountId);
  const display = account ? `${account.code} - ${account.name}` : 'Not mapped';
  const isMapped = !!account;

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-muted-foreground">{label}:</span>
      <span className={isMapped ? 'font-mono text-xs' : 'text-xs text-muted-foreground'}>
        {display}
      </span>
    </div>
  );
}

// Validation function
function validateMappings(mappings: Partial<AccountMappings>): {
  valid: boolean;
  error?: string;
} {
  const required = [
    { field: 'xero_revenue_account_id', label: 'Revenue Account' },
  ];

  for (const { field, label } of required) {
    if (!mappings[field as keyof AccountMappings]) {
      return {
        valid: false,
        error: `${label} is required. Please select an account.`,
      };
    }
  }

  // Validate no duplicate crypto clearing accounts
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

// Get default mappings by searching for matching account codes
function getDefaultMappings(accounts: XeroAccount[]): Partial<AccountMappings> {
  const result = new DefaultAccountingMappingService().resolve(accounts);
  return {
    xero_revenue_account_id: result.mappings.revenueAccountCode,
    xero_receivable_account_id: result.mappings.receivableAccountCode,
    xero_stripe_clearing_account_id: result.mappings.stripeClearingAccountCode,
    xero_fee_expense_account_id: result.mappings.processorFeeExpenseAccountCode,
  };
}

function getAccountOptions(accounts: XeroAccount[], preferredTypes: string[]): XeroAccount[] {
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






