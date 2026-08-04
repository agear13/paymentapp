export type AccountingProfile = {
  provider: 'xero' | 'myob' | 'quickbooks' | 'sage' | 'netsuite';
  connection: {
    connected: boolean;
    tenantId?: string | null;
    operatorMessage?: string | null;
  };
  accounts: {
    revenue?: string | null;
    accountsReceivable?: string | null;
    processorFees?: string | null;
    stripeClearing?: string | null;
    settlementAccounts?: {
      hbar?: string | null;
      usdc?: string | null;
      usdt?: string | null;
      audd?: string | null;
    };
  };
  gst: {
    configured: boolean;
    note?: string | null;
  };
};

export type AccountingHealthStatus =
  | 'healthy'
  | 'ready_with_recommendations'
  | 'attention_required';

export type AccountingHealthItem = {
  label: string;
  status: 'ok' | 'recommendation' | 'attention';
  message?: string;
};

export type AccountingHealthProfile = {
  status: AccountingHealthStatus;
  title: 'Ready for Production' | 'Ready with Recommendations' | 'Attention Required';
  items: AccountingHealthItem[];
};

function hasValue(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

export function evaluateAccountingProfile(
  profile: AccountingProfile,
  options?: { validAccountCodes?: Set<string> }
): AccountingHealthProfile {
  const items: AccountingHealthItem[] = [];
  const validCodes = options?.validAccountCodes;

  function pushAccountItem(
    label: string,
    value: string | null | undefined,
    missing: { status: 'attention' | 'recommendation'; message: string },
    configuredLabel?: string
  ) {
    if (!hasValue(value)) {
      items.push({ label, status: missing.status, message: missing.message });
      return;
    }

    const code = value!.trim();
    if (validCodes && !validCodes.has(code)) {
      items.push({
        label,
        status: 'attention',
        message: `Saved account code "${code}" is not in your current Xero chart. Re-select the account or refresh your chart.`,
      });
      return;
    }

    items.push({ label: configuredLabel ?? `${label} configured`, status: 'ok' });
  }

  if (!profile.connection.connected) {
    items.push({
      label: 'Xero Connected',
      status: 'attention',
      message:
        profile.connection.operatorMessage ||
        'Reconnect Xero before exporting accounting data.',
    });
  } else if (!hasValue(profile.connection.tenantId)) {
    items.push({
      label: 'Xero Organisation',
      status: 'attention',
      message: 'Select a Xero organisation before exporting accounting data.',
    });
  } else {
    items.push({ label: 'Xero Connected', status: 'ok' });
  }

  pushAccountItem('Revenue account', profile.accounts.revenue, {
    status: 'attention',
    message: 'Invoice exports require a revenue account.',
  }, 'Revenue account configured');

  pushAccountItem('Accounts Receivable', profile.accounts.accountsReceivable, {
    status: 'attention',
    message: 'Invoice exports require Accounts Receivable to be configured.',
  }, 'Accounts Receivable configured');

  pushAccountItem('Processor Fee account', profile.accounts.processorFees, {
    status: 'recommendation',
    message: 'This can be configured later by your accountant.',
  }, 'Processor Fee account configured');

  if (hasValue(profile.accounts.stripeClearing)) {
    pushAccountItem(
      'Stripe Clearing account',
      profile.accounts.stripeClearing,
      {
        status: 'recommendation',
        message: "This won't prevent invoice exports. You may configure this later.",
      },
      'Stripe Clearing configured'
    );
  } else {
    items.push({
      label: 'Stripe Clearing account not found',
      status: 'recommendation',
      message: "This won't prevent invoice exports. You may configure this later.",
    });
  }

  const hasAttention = items.some((item) => item.status === 'attention');
  const hasRecommendation = items.some((item) => item.status === 'recommendation');

  if (hasAttention) {
    return { status: 'attention_required', title: 'Attention Required', items };
  }
  if (hasRecommendation) {
    return { status: 'ready_with_recommendations', title: 'Ready with Recommendations', items };
  }
  return { status: 'healthy', title: 'Ready for Production', items };
}
