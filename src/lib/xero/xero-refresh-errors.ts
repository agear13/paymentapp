export type XeroRefreshFailureCategory = 'invalid_grant' | 'transient' | 'persist_failed';

export class XeroRefreshError extends Error {
  readonly category: XeroRefreshFailureCategory;
  readonly statusCode?: number;

  constructor(
    message: string,
    category: XeroRefreshFailureCategory,
    statusCode?: number
  ) {
    super(message);
    this.name = 'XeroRefreshError';
    this.category = category;
    this.statusCode = statusCode;
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error ?? '');
}

function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const withResponse = error as { response?: { status?: number }; status?: number };
  return withResponse.response?.status ?? withResponse.status;
}

export function classifyXeroRefreshFailure(error: unknown): {
  category: XeroRefreshFailureCategory;
  statusCode?: number;
  message: string;
} {
  if (error instanceof XeroRefreshError) {
    return {
      category: error.category,
      statusCode: error.statusCode,
      message: error.message,
    };
  }

  const message = errorMessage(error);
  const statusCode = errorStatus(error);
  const lower = message.toLowerCase();

  if (
    statusCode === 400 ||
    statusCode === 401 ||
    /invalid_grant|invalid refresh token|refresh token.*(expired|revoked|invalid)|unauthorized/.test(
      lower
    )
  ) {
    return { category: 'invalid_grant', statusCode, message };
  }

  if (
    statusCode === 429 ||
    (statusCode != null && statusCode >= 500) ||
    /econnreset|etimedout|enotfound|eai_again|network|fetch failed|socket|timeout|temporar/.test(
      lower
    )
  ) {
    return { category: 'transient', statusCode, message };
  }

  if (/persist|database|prisma/.test(lower)) {
    return { category: 'persist_failed', statusCode, message };
  }

  return { category: 'transient', statusCode, message };
}

export function xeroRefreshErrorFromUnknown(error: unknown): XeroRefreshError {
  if (error instanceof XeroRefreshError) return error;
  const classified = classifyXeroRefreshFailure(error);
  return new XeroRefreshError(classified.message, classified.category, classified.statusCode);
}
