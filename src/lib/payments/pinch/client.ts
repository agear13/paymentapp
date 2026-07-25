/**
 * Generic HTTP gateway for the Pinch Payments API.
 *
 * Handles OAuth 2.0 client-credentials auth, version headers, and JSON request/response
 * handling. Domain services (payments, payers, transfers, webhooks) should compose this
 * client rather than calling fetch directly.
 */

const PINCH_AUTH_URL = 'https://auth.getpinch.com.au/connect/token';

const DEFAULT_TEST_API_BASE_URL = 'https://api.getpinch.com.au/test';
const DEFAULT_LIVE_API_BASE_URL = 'https://api.getpinch.com.au/live';

/** Buffer before token expiry when refreshing (ms). */
const TOKEN_EXPIRY_BUFFER_MS = 60_000;

const REQUIRED_ENV_VARS = [
  'PINCH_APPLICATION_ID',
  'PINCH_SECRET_KEY',
  'PINCH_PUBLISHABLE_KEY',
  'PINCH_API_VERSION',
] as const;

type RequiredEnvVar = (typeof REQUIRED_ENV_VARS)[number];

export type PinchClientConfig = {
  applicationId: string;
  secretKey: string;
  publishableKey: string;
  apiVersion: string;
  apiBaseUrl: string;
};

type PinchTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

type PinchRequestInit = Omit<RequestInit, 'method' | 'body' | 'headers'> & {
  headers?: HeadersInit;
};

export class PinchApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body: string;
  readonly url: string;
  readonly method: string;

  constructor(input: {
    message: string;
    status: number;
    statusText: string;
    body: string;
    url: string;
    method: string;
  }) {
    super(input.message);
    this.name = 'PinchApiError';
    this.status = input.status;
    this.statusText = input.statusText;
    this.body = input.body;
    this.url = input.url;
    this.method = input.method;
  }
}

function readEnv(name: RequiredEnvVar): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function missingEnvVarMessage(name: RequiredEnvVar): string {
  return `Missing required Pinch environment variable: ${name}. Set ${name} before using PinchClient.`;
}

/**
 * Reads and validates Pinch configuration from environment variables.
 * Throws descriptive errors when required values are missing.
 */
export function loadPinchClientConfigFromEnv(): PinchClientConfig {
  for (const name of REQUIRED_ENV_VARS) {
    if (!readEnv(name)) {
      throw new Error(missingEnvVarMessage(name));
    }
  }

  const applicationId = readEnv('PINCH_APPLICATION_ID')!;
  const secretKey = readEnv('PINCH_SECRET_KEY')!;
  const publishableKey = readEnv('PINCH_PUBLISHABLE_KEY')!;
  const apiVersion = readEnv('PINCH_API_VERSION')!;

  const configuredBaseUrl = process.env.PINCH_API_BASE_URL?.trim();
  const apiBaseUrl = (
    configuredBaseUrl ||
    (process.env.NODE_ENV === 'production' ? DEFAULT_LIVE_API_BASE_URL : DEFAULT_TEST_API_BASE_URL)
  ).replace(/\/+$/, '');

  return {
    applicationId,
    secretKey,
    publishableKey,
    apiVersion,
    apiBaseUrl,
  };
}

function joinUrl(baseUrl: string, path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

function buildPinchApiError(input: {
  status: number;
  statusText: string;
  body: string;
  url: string;
  method: string;
}): PinchApiError {
  const detail = input.body.trim() ? `: ${input.body.trim()}` : '';
  return new PinchApiError({
    ...input,
    message: `Pinch API ${input.method} ${input.url} failed with ${input.status} ${input.statusText}${detail}`,
  });
}

export class PinchClient {
  private readonly config: PinchClientConfig;
  private tokenCache: { accessToken: string; expiresAtMs: number } | null = null;
  private tokenRefreshPromise: Promise<string> | null = null;

  constructor(config: PinchClientConfig) {
    this.config = config;
  }

  /** Creates a client using validated environment configuration. */
  static fromEnv(): PinchClient {
    return new PinchClient(loadPinchClientConfigFromEnv());
  }

  get applicationId(): string {
    return this.config.applicationId;
  }

  get publishableKey(): string {
    return this.config.publishableKey;
  }

  get apiVersion(): string {
    return this.config.apiVersion;
  }

  get apiBaseUrl(): string {
    return this.config.apiBaseUrl;
  }

  async get<T>(path: string, init: PinchRequestInit = {}): Promise<T> {
    return this.request<T>('GET', path, undefined, init);
  }

  async post<T>(path: string, body?: unknown, init: PinchRequestInit = {}): Promise<T> {
    return this.request<T>('POST', path, body, init);
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    init: PinchRequestInit = {},
  ): Promise<T> {
    const url = joinUrl(this.config.apiBaseUrl, path);
    const accessToken = await this.getAccessToken();

    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);
    headers.set('pinch-version', this.config.apiVersion);
    headers.set('Accept', 'application/json');

    let serializedBody: string | undefined;
    if (body !== undefined) {
      headers.set('Content-Type', 'application/json');
      serializedBody = JSON.stringify(body);
    } else if (method === 'POST') {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, {
      ...init,
      method,
      headers,
      body: serializedBody,
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw buildPinchApiError({
        status: response.status,
        statusText: response.statusText,
        body: responseText,
        url,
        method,
      });
    }

    if (!responseText.trim()) {
      return undefined as T;
    }

    try {
      return JSON.parse(responseText) as T;
    } catch {
      throw new PinchApiError({
        message: `Pinch API ${method} ${url} returned invalid JSON`,
        status: response.status,
        statusText: response.statusText,
        body: responseText,
        url,
        method,
      });
    }
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();

    if (this.tokenCache && this.tokenCache.expiresAtMs - TOKEN_EXPIRY_BUFFER_MS > now) {
      return this.tokenCache.accessToken;
    }

    if (!this.tokenRefreshPromise) {
      this.tokenRefreshPromise = this.fetchAccessToken().finally(() => {
        this.tokenRefreshPromise = null;
      });
    }

    return this.tokenRefreshPromise;
  }

  private async fetchAccessToken(): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.applicationId,
      client_secret: this.config.secretKey,
    });

    const response = await fetch(PINCH_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw buildPinchApiError({
        status: response.status,
        statusText: response.statusText,
        body: responseText,
        url: PINCH_AUTH_URL,
        method: 'POST',
      });
    }

    let tokenResponse: PinchTokenResponse;
    try {
      tokenResponse = JSON.parse(responseText) as PinchTokenResponse;
    } catch {
      throw new PinchApiError({
        message: 'Pinch auth token endpoint returned invalid JSON',
        status: response.status,
        statusText: response.statusText,
        body: responseText,
        url: PINCH_AUTH_URL,
        method: 'POST',
      });
    }

    if (!tokenResponse.access_token) {
      throw new PinchApiError({
        message: 'Pinch auth token endpoint response did not include access_token',
        status: response.status,
        statusText: response.statusText,
        body: responseText,
        url: PINCH_AUTH_URL,
        method: 'POST',
      });
    }

    const expiresInSeconds =
      typeof tokenResponse.expires_in === 'number' && tokenResponse.expires_in > 0
        ? tokenResponse.expires_in
        : 3600;

    this.tokenCache = {
      accessToken: tokenResponse.access_token,
      expiresAtMs: Date.now() + expiresInSeconds * 1000,
    };

    return tokenResponse.access_token;
  }
}
