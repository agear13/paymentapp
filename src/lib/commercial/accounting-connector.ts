/**
 * Accounting Connector Interface
 *
 * Provider-agnostic abstraction layer between the Commercial OS and any
 * external accounting system.
 *
 * Architecture:
 *   Commercial Graph
 *       ↓
 *   deriveAccountingExport()        ← canonical Commercial OS engine
 *       ↓
 *   AccountingConnector (interface) ← THIS FILE
 *       ↓
 *   XeroConnector | MYOBConnector | QuickBooksConnector | ...
 *
 * Design rules:
 *   - No Commercial OS code may call a provider SDK directly.
 *   - All accounting operations flow through this interface.
 *   - Switching providers requires only a new connector — not changes to
 *     Commercial OS logic, pages, hooks, or UI components.
 *   - The connector is a PURE push mechanism. It receives a finalized
 *     AccountingExportRecord and persists it to the provider.
 *   - Connectors are never called from UI components or hooks.
 */

/* ─── Supported accounting providers ────────────────────────────────────── */

export const ACCOUNTING_PROVIDERS = ['xero', 'myob', 'quickbooks', 'sage', 'netsuite'] as const;
export type AccountingProvider = (typeof ACCOUNTING_PROVIDERS)[number];

export const ACCOUNTING_PROVIDER_LABELS: Record<AccountingProvider, string> = {
  xero: 'Xero',
  myob: 'MYOB',
  quickbooks: 'QuickBooks',
  sage: 'Sage',
  netsuite: 'NetSuite',
};

/* ─── Sync status ────────────────────────────────────────────────────────── */

export const ACCOUNTING_SYNC_STATUSES = [
  'ready',
  'exporting',
  'exported',
  'failed',
  'needs_review',
  're_export_required',
] as const;
export type AccountingSyncStatus = (typeof ACCOUNTING_SYNC_STATUSES)[number];

export const SYNC_STATUS_LABELS: Record<AccountingSyncStatus, string> = {
  ready: 'Ready to export',
  exporting: 'Exporting…',
  exported: 'Exported',
  failed: 'Export failed',
  needs_review: 'Needs review',
  re_export_required: 'Re-export required',
};

/* ─── The record handed to a connector for export ───────────────────────── */

export type AccountingExportRecord = {
  /** Deterministic export ID: `${projectId}:${participantId}:accounting_export` */
  exportId: string;
  provider: AccountingProvider;

  /** Supplier name (participant business name or individual name). */
  supplier: string;
  /** Line item description on the bill/invoice. */
  description: string;
  /** Payment reference (agreement reference + participant name). */
  reference: string;
  /** Invoice number from the participant's invoice. */
  invoiceNumber: string | null;

  /** Total amount (inclusive of GST if applicable). */
  amount: number;
  /** GST component of the amount. 0 if not GST registered. */
  gstAmount: number;
  /** True when the participant is GST registered. */
  gstIncluded: boolean;
  currency: string;

  /** Optional tracking category (e.g. event name, department). */
  trackingCategory: string | null;
  /** ISO due date for payment. */
  dueDate: string | null;

  /** ABN for supplier validation. */
  abn: string | null;

  /** Metadata for accounting system reconciliation. */
  projectId: string;
  participantId: string;
  agreementReference: string;

  /** ISO date this export was approved by the operator. */
  approvedAt: string;
  /** Which operator approved it. */
  approvedBy: string;
};

/* ─── Response from a connector push ─────────────────────────────────────── */

export type AccountingConnectorResult = {
  success: boolean;
  /** Provider-assigned reference (e.g. Xero bill ID). */
  providerReference: string | null;
  /** ISO timestamp when the export completed on the provider side. */
  exportedAt: string | null;
  /** Error message if success === false. */
  error: string | null;
  /** Human-readable error for the operator (never expose internal errors). */
  operatorError: string | null;
};

/* ─── The connector interface ─────────────────────────────────────────────── */

/**
 * AccountingConnector
 *
 * All accounting providers implement this interface.
 * The Commercial OS only ever speaks to this interface — never to the
 * provider SDK directly.
 */
export interface AccountingConnector {
  readonly provider: AccountingProvider;

  /**
   * Validate that the connector is configured and the provider is reachable.
   * Called before every export.
   */
  validateConnection(): Promise<{ connected: boolean; error: string | null }>;

  /**
   * Push one AccountingExportRecord to the provider.
   * Returns a canonical result — never throws; errors are in the result.
   */
  pushExport(record: AccountingExportRecord): Promise<AccountingConnectorResult>;

  /**
   * Check the current status of a previously pushed export.
   * Used for polling after an async push.
   */
  checkExportStatus(
    providerReference: string
  ): Promise<{ status: AccountingSyncStatus; error: string | null }>;

  /**
   * Fetch a list of tracking categories available in the provider.
   * Used to populate the export preview UI.
   */
  listTrackingCategories(): Promise<string[]>;
}

/* ─── Xero connector stub ─────────────────────────────────────────────────── */

/**
 * XeroConnector
 *
 * Stub implementation of AccountingConnector for Xero.
 * The actual Xero SDK calls belong here — never in Commercial OS logic.
 *
 * To connect Xero:
 *   1. Implement `pushExport` using the Xero Node.js SDK.
 *   2. Map AccountingExportRecord → Xero Bill payload.
 *   3. Return the Xero bill ID as `providerReference`.
 *
 * The Commercial OS never imports the Xero SDK directly.
 */
export class XeroConnector implements AccountingConnector {
  readonly provider: AccountingProvider = 'xero';

  async validateConnection(): Promise<{ connected: boolean; error: string | null }> {
    // TODO: Call Xero /connections endpoint with the tenant's access token.
    // For now, return a disconnected stub.
    return { connected: false, error: 'Xero connector not yet configured.' };
  }

  async pushExport(record: AccountingExportRecord): Promise<AccountingConnectorResult> {
    // TODO: Map record → Xero Bill and POST to /Bills endpoint.
    //
    // Example mapping:
    //   Type: 'ACCPAY'
    //   Contact: { Name: record.supplier }
    //   Reference: record.reference
    //   LineItems: [{ Description: record.description, UnitAmount: record.amount }]
    //   Date: new Date().toISOString()
    //   DueDate: record.dueDate
    //
    return {
      success: false,
      providerReference: null,
      exportedAt: null,
      error: 'XeroConnector.pushExport: not implemented',
      operatorError: 'Xero export is not yet configured. Contact your administrator.',
    };
  }

  async checkExportStatus(
    _providerReference: string
  ): Promise<{ status: AccountingSyncStatus; error: string | null }> {
    return { status: 'needs_review', error: 'Status check not implemented.' };
  }

  async listTrackingCategories(): Promise<string[]> {
    return [];
  }
}

/* ─── MYOB connector stub ─────────────────────────────────────────────────── */

export class MYOBConnector implements AccountingConnector {
  readonly provider: AccountingProvider = 'myob';

  async validateConnection() { return { connected: false, error: 'MYOB connector not yet configured.' }; }
  async pushExport(_record: AccountingExportRecord): Promise<AccountingConnectorResult> {
    return { success: false, providerReference: null, exportedAt: null, error: 'Not implemented', operatorError: 'MYOB export is not yet configured.' };
  }
  async checkExportStatus(_ref: string) { return { status: 'needs_review' as AccountingSyncStatus, error: null }; }
  async listTrackingCategories() { return []; }
}

/* ─── QuickBooks connector stub ───────────────────────────────────────────── */

export class QuickBooksConnector implements AccountingConnector {
  readonly provider: AccountingProvider = 'quickbooks';

  async validateConnection() { return { connected: false, error: 'QuickBooks connector not yet configured.' }; }
  async pushExport(_record: AccountingExportRecord): Promise<AccountingConnectorResult> {
    return { success: false, providerReference: null, exportedAt: null, error: 'Not implemented', operatorError: 'QuickBooks export is not yet configured.' };
  }
  async checkExportStatus(_ref: string) { return { status: 'needs_review' as AccountingSyncStatus, error: null }; }
  async listTrackingCategories() { return []; }
}

/* ─── Connector factory ────────────────────────────────────────────────────── */

/**
 * Instantiate the appropriate connector for a given provider.
 * The Commercial OS uses this factory — never imports connectors directly.
 */
export function createAccountingConnector(provider: AccountingProvider): AccountingConnector {
  switch (provider) {
    case 'xero': return new XeroConnector();
    case 'myob': return new MYOBConnector();
    case 'quickbooks': return new QuickBooksConnector();
    default:
      throw new Error(`Accounting connector for provider '${provider}' is not yet implemented.`);
  }
}
