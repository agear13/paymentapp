/**
 * Plain-English customer copy for Xero UI — presentation only; backend unchanged.
 */

const TECHNICAL_PATTERNS = [
  /\b\d{3}\b/, // bare HTTP codes
  /\{[\s\S]*\}/, // JSON blobs
  /\[[\s\S]*\]/,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i,
  /correlation/i,
  /request header/i,
  /operatorMessage/i,
  /xero_[a-z_]+/i,
  /tenantId/i,
  /invalid response/i,
  /from the server/i,
];

function looksTechnical(text: string): boolean {
  return TECHNICAL_PATTERNS.some((pattern) => pattern.test(text));
}

export type CustomerMessage = {
  message: string;
  action: string;
};

export const XERO_OAUTH_ERROR_MESSAGES: Record<string, CustomerMessage> = {
  access_denied: {
    message: 'Xero connection was cancelled.',
    action: 'You can connect accounting again whenever you are ready.',
  },
  missing_parameters: {
    message: 'Something went wrong while connecting to Xero.',
    action: 'Try connecting again from this page.',
  },
  invalid_state: {
    message: 'Your Xero sign-in session expired before it finished.',
    action: 'Try connecting to Xero again.',
  },
  unauthorized: {
    message: 'Your Provvy session changed while connecting to Xero.',
    action: 'Sign in to Provvy again, then retry connecting Xero.',
  },
  no_tenants: {
    message: 'We could not find a Xero business on that Xero login.',
    action: 'Sign in with the Xero user that manages your business, then try again.',
  },
  connection_failed: {
    message: 'Provvy could not finish linking your Xero account.',
    action: 'Try connecting again. If it keeps failing, reconnect from this page.',
  },
  not_configured: {
    message: 'Xero is not available in this workspace right now.',
    action: 'Contact your Provvy administrator for help.',
  },
};

export function formatXeroOAuthError(code: string): CustomerMessage {
  return (
    XERO_OAUTH_ERROR_MESSAGES[code] ?? {
      message: 'Provvy could not connect to Xero.',
      action: 'Try connecting again from this page.',
    }
  );
}

export function formatXeroConnectionIssue(
  raw: string | null | undefined
): CustomerMessage | null {
  if (!raw?.trim()) return null;
  const text = raw.trim();
  const lower = text.toLowerCase();

  if (
    lower.includes('needs to be reconnected') ||
    lower.includes('could not refresh') ||
    lower.includes("couldn't refresh") ||
    (lower.includes('refresh') && (lower.includes('authorization') || lower.includes('token')))
  ) {
    return {
      message: "Provvy couldn't refresh the Xero authorization.",
      action: 'Use Reconnect Xero above, or disconnect and reconnect from Connected Systems.',
    };
  }
  if (lower.includes('no active xero connection') || /\bconnect xero\b/.test(lower)) {
    return {
      message: 'Xero is not connected right now.',
      action: 'Use Connect Xero above to link your business.',
    };
  }
  if (lower.includes('tenant') || lower.includes('organisation') || lower.includes('organization')) {
    return {
      message: 'Provvy needs to know which Xero business to use.',
      action: 'Choose your business in the Xero business dropdown above.',
    };
  }
  if (lower.includes('network') || lower.includes('could not reach') || lower.includes('fetch')) {
    return {
      message: 'Provvy could not reach Xero just now.',
      action: 'Check your internet connection, then refresh this page.',
    };
  }
  if (looksTechnical(text)) {
    return {
      message: 'Provvy could not load your Xero connection details.',
      action: 'Refresh this page or reconnect Xero using the button above.',
    };
  }

  return { message: text, action: 'If this keeps happening, try reconnecting Xero.' };
}

export function formatMappingIssue(raw: string): CustomerMessage {
  const text = raw.trim();
  const lower = text.toLowerCase();

  if (lower.includes('no active xero connection')) {
    return {
      message: 'Connect Xero before choosing accounts.',
      action: 'Use Connect Xero at the top of this page.',
    };
  }
  if (
    lower.includes('needs to be reconnected') ||
    lower.includes('could not refresh') ||
    lower.includes("couldn't refresh") ||
    (lower.includes('refresh') && (lower.includes('authorization') || lower.includes('token')))
  ) {
    return {
      message: "Provvy couldn't refresh the Xero authorization.",
      action: 'Use Reconnect Xero above, then choose accounts.',
    };
  }
  if (lower.includes('revenue account is required')) {
    return {
      message: 'Choose which Xero account records your sales.',
      action: 'Pick a sales account, then save your choices.',
    };
  }
  if (lower.includes('clearing account must be mapped')) {
    return {
      message: 'Each holding account needs its own Xero account.',
      action: 'Pick a different account for each holding account, then save.',
    };
  }
  if (lower.includes('not a valid code') || lower.includes('uuid')) {
    return {
      message: 'One of the saved account choices is no longer valid in Xero.',
      action: 'Pick the account again from your Xero chart, then save.',
    };
  }
  if (lower.includes('forbidden') || lower.includes('403') || lower.includes('not authorized')) {
    return {
      message: 'Your Xero user may not have permission to add accounts.',
      action: 'Ask your Xero administrator to add the holding accounts, or grant you account access.',
    };
  }
  if (looksTechnical(text)) {
    return {
      message: 'Provvy could not save your Xero account choices.',
      action: 'Check your selections and try saving again.',
    };
  }

  return {
    message: text,
    action: 'Review your account choices and try again.',
  };
}

export function formatSyncIssueForCustomer(
  raw: string | null | undefined,
  options: { xeroCurrentlyConnected: boolean }
): CustomerMessage | null {
  if (!raw?.trim()) return null;
  const text = raw.trim();
  const lower = text.toLowerCase();

  if (
    options.xeroCurrentlyConnected &&
    (lower.includes('no active xero connection') ||
      lower.includes('connect xero first') ||
      lower.includes('invalid connection state'))
  ) {
    return {
      message: 'This payment failed to sync before Xero was connected.',
      action: 'Xero is connected now — use Find missed payments below if needed.',
    };
  }
  if (lower.includes('not subscribed to currency')) {
    return {
      message: 'That invoice currency is not enabled in your Xero business.',
      action: 'Enable the currency in Xero, or invoice in your home currency.',
    };
  }
  if (lower.includes('currency rate')) {
    return {
      message: 'Xero needs an exchange rate for that invoice currency.',
      action: 'Add the currency and rate in Xero, then retry.',
    };
  }
  if (lower.includes('not a valid code')) {
    return {
      message: 'A saved Xero account choice no longer matches your chart.',
      action: 'Update your account choices above, then retry.',
    };
  }
  if (lower.includes('could not find') && lower.includes('invoice')) {
    return {
      message: 'Provvy could not match this payment to a Xero invoice.',
      action: 'Check that the invoice exists in Xero, then use Find missed payments.',
    };
  }
  if (looksTechnical(text) || lower.startsWith('xero:')) {
    return {
      message: 'This payment did not sync to Xero.',
      action: 'New invoices are unaffected. Use Find missed payments below to retry.',
    };
  }

  return {
    message: text.replace(/^Xero:\s*/i, ''),
    action: 'Use Find missed payments below if you want Provvy to try again.',
  };
}

export function formatTenantDisplayName(name: string, tenantType?: string): string {
  if (!tenantType || tenantType === 'ORGANISATION' || tenantType === 'ORGANIZATION') {
    return name;
  }
  return name;
}
