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

export function evaluateAccountingProfile(profile: AccountingProfile): AccountingHealthProfile {
  const items: AccountingHealthItem[] = [];

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

  if (hasValue(profile.accounts.revenue)) {
    items.push({ label: 'Revenue account configured', status: 'ok' });
  } else {
    items.push({
      label: 'Revenue account',
      status: 'attention',
      message: 'Invoice exports require a revenue account.',
    });
  }

  if (hasValue(profile.accounts.accountsReceivable)) {
    items.push({ label: 'Accounts Receivable configured', status: 'ok' });
  } else {
    items.push({
      label: 'Accounts Receivable',
      status: 'attention',
      message: 'Invoice exports require Accounts Receivable to be configured.',
    });
  }

  if (hasValue(profile.accounts.processorFees)) {
    items.push({ label: 'Processor Fee account configured', status: 'ok' });
  } else {
    items.push({
      label: 'Processor Fee account',
      status: 'recommendation',
      message: 'This can be configured later by your accountant.',
    });
  }

  if (hasValue(profile.accounts.stripeClearing)) {
    items.push({ label: 'Stripe Clearing configured', status: 'ok' });
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
