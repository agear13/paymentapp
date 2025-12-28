/**
 * Xero Integration Module
 * Main exports for Xero OAuth and API integration
 */

export {
  getXeroClient,
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
  getValidAccessToken,
  hasValidConnection,
  disconnectXero,
  getAvailableTenants,
  updateSelectedTenant,
  getConnectionStatus,
  getActiveConnection,
  type XeroConnection,
} from './connection-service';

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






