export type PilotHealth = 'healthy' | 'degraded' | 'unhealthy' | 'unknown' | 'disabled';

export type PilotRailStatus = {
  rail: 'stripe' | 'hedera' | 'metamask' | 'wise';
  enabled: boolean;
  configured: boolean;
  health: PilotHealth;
  lastPaymentAt: string | null;
  lastWebhookAt: string | null;
  detail: string | null;
};

export type PilotEnvironmentStatus = {
  productionMode: boolean;
  appUrl: string | null;
  stripeConfigured: boolean;
  xeroConfigured: boolean;
  resendConfigured: boolean;
  redisConfigured: boolean;
  cronConfigured: boolean;
  missingRequiredEnv: string[];
};

export type PilotXeroStatus = {
  connected: boolean;
  health: PilotHealth;
  lastInvoiceSyncAt: string | null;
  lastPaymentSyncAt: string | null;
  failedSyncCount: number;
  pendingSyncCount: number;
  mappingComplete: boolean;
  mappingMissing: string[];
};

export type PilotLedgerStatus = {
  health: PilotHealth;
  outstandingInvoices: number;
  settlementFailures: number;
  duplicateSettlements: number;
  balanceStatus: 'balanced' | 'imbalanced' | 'unknown';
  criticalIssues: number;
};

export type PilotMonitoringStatus = {
  latestErrors: Array<{ message: string; at: string }>;
  latestWarnings: Array<{ message: string; at: string }>;
  cronStatus: PilotHealth;
  webhookFailures: number;
  retryQueueDepth: number;
};

export type PilotDanielleStatus = {
  pilotEmailConfigured: boolean;
  organizationFound: boolean;
  organizationId: string | null;
  organizationName: string | null;
  merchantConfigured: boolean;
  stripeConnected: boolean;
};

export type PilotReadinessSnapshot = {
  checkedAt: string;
  environment: PilotEnvironmentStatus;
  rails: PilotRailStatus[];
  xero: PilotXeroStatus;
  ledger: PilotLedgerStatus;
  monitoring: PilotMonitoringStatus;
  danielle: PilotDanielleStatus;
  pilotStatus: 'READY' | 'NOT_READY';
  blockingReasons: string[];
};
