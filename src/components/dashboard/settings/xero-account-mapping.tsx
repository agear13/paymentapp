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

interface XeroAccountMappingProps {
  organizationId: string;
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

export function XeroAccountMapping({ organizationId }: XeroAccountMappingProps) {
  const [accounts, setAccounts] = React.useState<XeroAccount[]>([]);
  const [mappings, setMappings] = React.useState<Partial<AccountMappings>>({});
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch Xero accounts on mount
  React.useEffect(() => {
    fetchAccounts();
    fetchMappings();
  }, [organizationId]);

  async function fetchAccounts() {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(
        `/api/xero/accounts?organization_id=${organizationId}`
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
    } finally {
      setLoading(false);
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
    toast.info('Mappings reset to suggested defaults');
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

  if (error && accounts.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error}
          {error.includes('No active Xero connection') && (
            <span className="block mt-2">
              Please connect to Xero first in the Connection tab above.
            </span>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Xero Account Mapping</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Map your Provvypay accounts to Xero accounts for automated sync.
          Each crypto token requires a separate clearing account.
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
          accounts={accounts.filter(a => a.type === 'REVENUE')}
          value={mappings.xero_revenue_account_id || ''}
          onChange={(value) =>
            setMappings({ ...mappings, xero_revenue_account_id: value })
          }
          placeholder="Select revenue account (e.g., 4000 Revenue)"
        />

        {/* Accounts Receivable */}
        <AccountMappingField
          label="Accounts Receivable"
          description="Customer invoices pending payment"
          accounts={accounts.filter(a => a.type === 'CURRENT' || a.type === 'CURRLIAB')}
          value={mappings.xero_receivable_account_id || ''}
          onChange={(value) =>
            setMappings({ ...mappings, xero_receivable_account_id: value })
          }
          placeholder="Select receivable account (e.g., 1200 Accounts Receivable)"
        />

        {/* Stripe Clearing */}
        <AccountMappingField
          label="Stripe Clearing Account"
          description="Stripe payment settlements"
          accounts={accounts.filter(a => a.type === 'CURRENT' || a.type === 'BANK')}
          value={mappings.xero_stripe_clearing_account_id || ''}
          onChange={(value) =>
            setMappings({ ...mappings, xero_stripe_clearing_account_id: value })
          }
          placeholder="Select Stripe clearing account"
        />

        {/* HBAR Clearing */}
        <AccountMappingField
          label="Crypto Clearing - HBAR"
          description="HBAR cryptocurrency settlements"
          accounts={accounts.filter(a => a.type === 'CURRENT' || a.type === 'BANK')}
          value={mappings.xero_hbar_clearing_account_id || ''}
          onChange={(value) =>
            setMappings({ ...mappings, xero_hbar_clearing_account_id: value })
          }
          placeholder="Select HBAR clearing account (typically 1051)"
        />

        {/* USDC Clearing */}
        <AccountMappingField
          label="Crypto Clearing - USDC"
          description="USDC stablecoin settlements"
          accounts={accounts.filter(a => a.type === 'CURRENT' || a.type === 'BANK')}
          value={mappings.xero_usdc_clearing_account_id || ''}
          onChange={(value) =>
            setMappings({ ...mappings, xero_usdc_clearing_account_id: value })
          }
          placeholder="Select USDC clearing account (typically 1052)"
        />

        {/* USDT Clearing */}
        <AccountMappingField
          label="Crypto Clearing - USDT"
          description="USDT stablecoin settlements"
          accounts={accounts.filter(a => a.type === 'CURRENT' || a.type === 'BANK')}
          value={mappings.xero_usdt_clearing_account_id || ''}
          onChange={(value) =>
            setMappings({ ...mappings, xero_usdt_clearing_account_id: value })
          }
          placeholder="Select USDT clearing account (typically 1053)"
        />

        {/* AUDD Clearing ⭐ NEW */}
        <AccountMappingField
          label="Crypto Clearing - AUDD"
          description="AUDD (Australian Digital Dollar) stablecoin settlements"
          accounts={accounts.filter(a => a.type === 'CURRENT' || a.type === 'BANK')}
          value={mappings.xero_audd_clearing_account_id || ''}
          onChange={(value) =>
            setMappings({ ...mappings, xero_audd_clearing_account_id: value })
          }
          placeholder="Select AUDD clearing account (typically 1054)"
          badge="🇦🇺 AUD Stablecoin"
        />

        {/* Processor Fee Expense */}
        <AccountMappingField
          label="Processor Fee Expense"
          description="Payment processing fees"
          accounts={accounts.filter(a => a.type === 'EXPENSE' || a.type === 'OVERHEADS')}
          value={mappings.xero_fee_expense_account_id || ''}
          onChange={(value) =>
            setMappings({ ...mappings, xero_fee_expense_account_id: value })
          }
          placeholder="Select expense account (e.g., 6100 Bank Fees)"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t">
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
              Save Mappings
            </>
          )}
        </Button>

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
              label="AUDD 🇦🇺"
              accountId={mappings.xero_audd_clearing_account_id}
              accounts={accounts}
            />
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
    { field: 'xero_receivable_account_id', label: 'Accounts Receivable' },
    { field: 'xero_stripe_clearing_account_id', label: 'Stripe Clearing' },
    { field: 'xero_hbar_clearing_account_id', label: 'HBAR Clearing' },
    { field: 'xero_usdc_clearing_account_id', label: 'USDC Clearing' },
    { field: 'xero_usdt_clearing_account_id', label: 'USDT Clearing' },
    { field: 'xero_audd_clearing_account_id', label: 'AUDD Clearing' },
    { field: 'xero_fee_expense_account_id', label: 'Fee Expense' },
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
  return {
    xero_revenue_account_id: findAccount(accounts, ['4000', '4100', 'revenue'])?.code,
    xero_receivable_account_id: findAccount(accounts, ['1200', '1100', 'receivable'])?.code,
    xero_stripe_clearing_account_id: findAccount(accounts, ['1050', 'stripe'])?.code,
    xero_hbar_clearing_account_id: findAccount(accounts, ['1051', 'hbar', 'crypto'])?.code,
    xero_usdc_clearing_account_id: findAccount(accounts, ['1052', 'usdc'])?.code,
    xero_usdt_clearing_account_id: findAccount(accounts, ['1053', 'usdt'])?.code,
    xero_audd_clearing_account_id: findAccount(accounts, ['1054', 'audd'])?.code,
    xero_fee_expense_account_id: findAccount(accounts, ['6100', '6200', 'fee', 'bank charges'])?.code,
  };
}

// Helper to find account by code or name
function findAccount(accounts: XeroAccount[], searchTerms: string[]): XeroAccount | undefined {
  return accounts.find(account =>
    searchTerms.some(term =>
      account.code?.toLowerCase().includes(term.toLowerCase()) ||
      account.name?.toLowerCase().includes(term.toLowerCase())
    )
  );
}






