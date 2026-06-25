/**
 * Xero Integration Module
 * Main exports for Xero OAuth and API integration
 */

export {
  getXeroClient,
  isXeroConfigured,
  generateAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  getXeroTenants,
  revokeConnection,
} from './client';

export {
  encryptToken,
  decryptToken,
  generateEncryptionKey,
} from './encryption';

export {
  storeXeroConnection,
  getXeroConnection,
  getXeroConnectionRow,
  getValidAccessToken,
  hasValidConnection,
  disconnectXero,
  getAvailableTenants,
  updateSelectedTenant,
  getConnectionStatus,
  getActiveConnection,
  resolveXeroConnectionForApi,
  type XeroConnection,
} from './connection-service';

export {
  isLegacyIncompleteXeroConnectionRow,
  XERO_OAUTH_SCOPES_PERSISTED,
} from './token-set-trace';

export {
  fetchXeroAccounts,
  fetchXeroAccountsByType,
  searchXeroAccounts,
  type XeroAccount,
  type AccountsResponse,
} from './accounts-service';

export {
  createXeroInvoice,
  type InvoiceCreationParams,
  type InvoiceCreationResult,
} from './invoice-service';

export {
  recordXeroPayment,
  type PaymentRecordingParams,
  type PaymentRecordingResult,
} from './payment-service';

export {
  syncPaymentToXero,
  retryFailedSync,
  getSyncStatus,
  type SyncPaymentParams,
  type SyncResult,
} from './sync-orchestration';

export {
  queueXeroSync,
  queueXeroPaymentSyncIfEnabled,
  getPendingSyncJobs,
  markSyncSuccess,
  markSyncFailed,
  markSyncInProgress,
  calculateNextRetryTime,
  categorizeError,
  getFailedSyncs,
  getSyncStatistics,
  type QueueSyncJobParams,
  type ProcessQueueOptions,
} from './queue-service';

export {
  processQueue,
  processSyncById,
  type ProcessorStats,
} from './queue-processor';

export {
  assertXeroConfigured,
  getXeroEnvStatus,
  getMissingXeroEnvVars,
  isXeroFullyConfigured,
  XeroConfigurationError,
  type XeroEnvStatus,
} from './xero-config';

export {
  runXeroDiagnostics,
  type XeroDiagnosticsResult,
} from './xero-diagnostics';






