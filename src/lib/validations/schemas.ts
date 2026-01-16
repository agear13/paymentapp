/**
 * Zod Validation Schemas for Provvypay
 * Data validation layer for all models and API inputs
 */

import { z } from 'zod';

// ============================================================================
// ENUM SCHEMAS
// ============================================================================

export const PaymentLinkStatusSchema = z.enum([
  'DRAFT',
  'OPEN',
  'PAID',
  'EXPIRED',
  'CANCELED',
]);

export const PaymentEventTypeSchema = z.enum([
  'CREATED',
  'OPENED',
  'PAYMENT_INITIATED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_FAILED',
  'EXPIRED',
  'CANCELED',
]);

export const PaymentMethodSchema = z.enum(['STRIPE', 'HEDERA']);

export const FxSnapshotTypeSchema = z.enum(['CREATION', 'SETTLEMENT']);

export const LedgerAccountTypeSchema = z.enum([
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'EXPENSE',
]);

export const LedgerEntryTypeSchema = z.enum(['DEBIT', 'CREDIT']);

export const XeroSyncTypeSchema = z.enum(['INVOICE', 'PAYMENT']);

export const XeroSyncStatusSchema = z.enum([
  'PENDING',
  'SUCCESS',
  'FAILED',
  'RETRYING',
]);

// ============================================================================
// CUSTOM VALIDATORS (imported from validators.ts)
// ============================================================================

// ISO 4217 Currency Code (3 uppercase letters)
export const currencyCodeSchema = z
  .string()
  .length(3, 'Currency code must be exactly 3 characters')
  .regex(/^[A-Z]{3}$/, 'Currency code must be 3 uppercase letters')
  .refine((code) => {
    // Validate against common ISO 4217 codes
    const validCurrencies = [
      'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY', 'CNY', 'INR',
      'SGD', 'NZD', 'HKD', 'CHF', 'SEK', 'NOK', 'DKK', 'IDR',
      'HBAR', 'USDC', // Crypto currencies
    ];
    return validCurrencies.includes(code);
  }, 'Invalid currency code');

// Hedera Account ID format: 0.0.xxxxx
export const hederaAccountIdSchema = z
  .string()
  .regex(
    /^0\.0\.\d+$/,
    'Hedera account ID must be in format 0.0.xxxxx'
  );

// Hedera Transaction ID format: 0.0.xxx@xxx.xxxxxxxxx or 0.0.xxx-xxx-xxx@xxx.xxxxxxxxx
export const hederaTransactionIdSchema = z
  .string()
  .regex(
    /^0\.0\.\d+[-@]\d+\.\d+$/,
    'Invalid Hedera transaction ID format'
  );

// Invoice reference - flexible format for real-world use
export const invoiceReferenceSchema = z
  .string()
  .min(1, 'Invoice reference is required')
  .max(255, 'Invoice reference must not exceed 255 characters')
  .refine(
    (val) => val.trim().length > 0,
    'Invoice reference cannot be only whitespace'
  );

// Short code (URL-safe, 8 characters)
export const shortCodeSchema = z
  .string()
  .length(8, 'Short code must be exactly 8 characters')
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    'Short code must contain only URL-safe characters'
  );

// Email validation
export const emailSchema = z
  .string()
  .email('Invalid email address')
  .max(255, 'Email must not exceed 255 characters');

// Phone validation (international format) - only validates if value provided
export const phoneSchema = z
  .string()
  .max(50, 'Phone number must not exceed 50 characters')
  .refine(
    (val) => !val || val === '' || /^\+?[1-9]\d{1,14}$/.test(val),
    'Phone number must be in valid international format (e.g., +61412345678)'
  )
  .optional();

// UUID validation
export const uuidSchema = z
  .string()
  .uuid('Invalid UUID format');

// ============================================================================
// ORGANIZATION SCHEMAS
// ============================================================================

export const OrganizationSchema = z.object({
  id: uuidSchema,
  clerkOrgId: z.string().max(255),
  name: z.string().min(1).max(255),
  createdAt: z.date(),
});

export const CreateOrganizationSchema = z.object({
  clerkOrgId: z.string().max(255),
  name: z.string().min(1, 'Organization name is required').max(255),
});

// ============================================================================
// MERCHANT SETTINGS SCHEMAS
// ============================================================================

export const MerchantSettingsSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  displayName: z.string().min(1).max(255),
  defaultCurrency: currencyCodeSchema,
  stripeAccountId: z.string().max(255).nullable(),
  hederaAccountId: hederaAccountIdSchema.nullable(),
  createdAt: z.date(),
});

export const CreateMerchantSettingsSchema = z.object({
  organizationId: uuidSchema,
  displayName: z.string().min(1, 'Display name is required').max(255),
  defaultCurrency: currencyCodeSchema,
  stripeAccountId: z.string().max(255).optional(),
  hederaAccountId: hederaAccountIdSchema.optional(),
});

export const UpdateMerchantSettingsSchema = z.object({
  displayName: z.string().min(1).max(255).optional(),
  defaultCurrency: currencyCodeSchema.optional(),
  stripeAccountId: z.string().max(255).nullable().optional(),
  hederaAccountId: hederaAccountIdSchema.nullable().optional(),
});

// ============================================================================
// PAYMENT LINK SCHEMAS
// ============================================================================

export const PaymentLinkSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  shortCode: shortCodeSchema,
  status: PaymentLinkStatusSchema,
  amount: z.number().positive('Amount must be positive'),
  currency: currencyCodeSchema,
  description: z.string().max(200, 'Description must not exceed 200 characters'),
  invoiceReference: invoiceReferenceSchema.nullable(),
  customerEmail: emailSchema.nullable(),
  customerPhone: phoneSchema.nullable(),
  expiresAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreatePaymentLinkSchema = z.object({
  organizationId: uuidSchema,
  amount: z
    .number()
    .positive('Amount must be positive')
    .multipleOf(0.01, 'Amount must have at most 2 decimal places'),
  currency: currencyCodeSchema,
  description: z
    .string()
    .min(1, 'Description is required')
    .max(200, 'Description must not exceed 200 characters'),
  invoiceReference: z
    .string()
    .max(255, 'Invoice reference must not exceed 255 characters')
    .optional()
    .transform((val) => val && val.trim() ? val : undefined),
  customerEmail: z
    .string()
    .email('Invalid email address')
    .max(255)
    .optional()
    .or(z.literal(''))
    .transform((val) => val && val.trim() ? val : undefined),
  customerName: z
    .string()
    .max(255)
    .optional()
    .or(z.literal(''))
    .transform((val) => val && val.trim() ? val : undefined),
  customerPhone: phoneSchema
    .or(z.literal(''))
    .transform((val) => val && val.trim() ? val : undefined),
  dueDate: z
    .string()
    .datetime('Invalid datetime format')
    .optional()
    .or(z.date().optional()),
  expiresAt: z
    .string()
    .datetime('Invalid datetime format')
    .optional()
    .or(z.date().optional()),
});

export const UpdatePaymentLinkSchema = z.object({
  status: PaymentLinkStatusSchema.optional(),
  description: z.string().max(200).optional(),
  customerEmail: emailSchema.nullable().optional(),
  customerName: z.string().max(255).nullable().optional(),
  customerPhone: phoneSchema.nullable().optional(),
  dueDate: z
    .string()
    .datetime()
    .optional()
    .or(z.date().nullable().optional()),
  expiresAt: z
    .string()
    .datetime()
    .optional()
    .or(z.date().nullable().optional()),
});

// ============================================================================
// PAYMENT EVENT SCHEMAS
// ============================================================================

export const PaymentEventSchema = z.object({
  id: uuidSchema,
  paymentLinkId: uuidSchema,
  eventType: PaymentEventTypeSchema,
  paymentMethod: PaymentMethodSchema.nullable(),
  stripePaymentIntentId: z.string().max(255).nullable(),
  hederaTransactionId: hederaTransactionIdSchema.nullable(),
  amountReceived: z.number().nullable(),
  currencyReceived: currencyCodeSchema.nullable(),
  metadata: z.record(z.any()).nullable(),
  createdAt: z.date(),
});

export const CreatePaymentEventSchema = z.object({
  paymentLinkId: uuidSchema,
  eventType: PaymentEventTypeSchema,
  paymentMethod: PaymentMethodSchema.optional(),
  stripePaymentIntentId: z.string().max(255).optional(),
  hederaTransactionId: hederaTransactionIdSchema.optional(),
  amountReceived: z.number().positive().optional(),
  currencyReceived: currencyCodeSchema.optional(),
  metadata: z.record(z.any()).optional(),
});

// ============================================================================
// FX SNAPSHOT SCHEMAS
// ============================================================================

export const FxSnapshotSchema = z.object({
  id: uuidSchema,
  paymentLinkId: uuidSchema,
  snapshotType: FxSnapshotTypeSchema,
  baseCurrency: currencyCodeSchema,
  quoteCurrency: currencyCodeSchema,
  rate: z.number().positive('Exchange rate must be positive'),
  provider: z.string().max(100),
  capturedAt: z.date(),
});

export const CreateFxSnapshotSchema = z.object({
  paymentLinkId: uuidSchema,
  snapshotType: FxSnapshotTypeSchema,
  baseCurrency: currencyCodeSchema,
  quoteCurrency: currencyCodeSchema,
  rate: z.number().positive('Exchange rate must be positive'),
  provider: z.enum(['coingecko', 'hedera_mirror', 'manual']),
});

// ============================================================================
// LEDGER ACCOUNT SCHEMAS
// ============================================================================

export const LedgerAccountSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  code: z.string().max(50),
  name: z.string().max(255),
  accountType: LedgerAccountTypeSchema,
  xeroAccountId: z.string().max(255).nullable(),
  createdAt: z.date(),
});

export const CreateLedgerAccountSchema = z.object({
  organizationId: uuidSchema,
  code: z.string().min(1, 'Account code is required').max(50),
  name: z.string().min(1, 'Account name is required').max(255),
  accountType: LedgerAccountTypeSchema,
  xeroAccountId: z.string().max(255).optional(),
});

// ============================================================================
// LEDGER ENTRY SCHEMAS
// ============================================================================

export const LedgerEntrySchema = z.object({
  id: uuidSchema,
  paymentLinkId: uuidSchema,
  ledgerAccountId: uuidSchema,
  entryType: LedgerEntryTypeSchema,
  amount: z.number().positive('Amount must be positive'),
  currency: currencyCodeSchema,
  description: z.string(),
  idempotencyKey: z.string().max(255),
  createdAt: z.date(),
});

export const CreateLedgerEntrySchema = z.object({
  paymentLinkId: uuidSchema,
  ledgerAccountId: uuidSchema,
  entryType: LedgerEntryTypeSchema,
  amount: z.number().positive('Amount must be positive'),
  currency: currencyCodeSchema,
  description: z.string().min(1, 'Description is required'),
  idempotencyKey: z.string().max(255),
});

// Batch ledger entries (for double-entry bookkeeping)
export const CreateLedgerEntriesSchema = z
  .array(CreateLedgerEntrySchema)
  .min(2, 'At least 2 entries required for double-entry')
  .refine(
    (entries) => {
      // Validate that debits equal credits
      const debits = entries
        .filter((e) => e.entryType === 'DEBIT')
        .reduce((sum, e) => sum + e.amount, 0);
      const credits = entries
        .filter((e) => e.entryType === 'CREDIT')
        .reduce((sum, e) => sum + e.amount, 0);
      
      // Allow small rounding differences (0.001)
      return Math.abs(debits - credits) < 0.001;
    },
    { message: 'Debits must equal credits in double-entry bookkeeping' }
  );

// ============================================================================
// XERO CONNECTION SCHEMAS
// ============================================================================

export const XeroConnectionSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  tenantId: z.string().max(255),
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.date(),
  connectedAt: z.date(),
});

// ============================================================================
// XERO SYNC SCHEMAS
// ============================================================================

export const XeroSyncSchema = z.object({
  id: uuidSchema,
  paymentLinkId: uuidSchema,
  syncType: XeroSyncTypeSchema,
  status: XeroSyncStatusSchema,
  xeroInvoiceId: z.string().max(255).nullable(),
  xeroPaymentId: z.string().max(255).nullable(),
  requestPayload: z.record(z.any()),
  responsePayload: z.record(z.any()).nullable(),
  errorMessage: z.string().nullable(),
  retryCount: z.number().int().min(0).max(5),
  nextRetryAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateXeroSyncSchema = z.object({
  paymentLinkId: uuidSchema,
  syncType: XeroSyncTypeSchema,
  requestPayload: z.record(z.any()),
});

// ============================================================================
// AUDIT LOG SCHEMAS
// ============================================================================

export const AuditLogSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema.nullable(),
  userId: z.string().max(255).nullable(),
  entityType: z.string().max(100),
  entityId: uuidSchema,
  action: z.string().max(50),
  oldValues: z.record(z.any()).nullable(),
  newValues: z.record(z.any()).nullable(),
  ipAddress: z.string().max(45).nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.date(),
});

export const CreateAuditLogSchema = z.object({
  organizationId: uuidSchema.optional(),
  userId: z.string().max(255).optional(),
  entityType: z.string().max(100),
  entityId: uuidSchema,
  action: z.enum([
    'CREATE',
    'UPDATE',
    'DELETE',
    'STATUS_CHANGE',
    'PAYMENT_RECEIVED',
    'SYNC_ATTEMPTED',
  ]),
  oldValues: z.record(z.any()).optional(),
  newValues: z.record(z.any()).optional(),
  ipAddress: z.string().max(45).optional(),
  userAgent: z.string().optional(),
});

// ============================================================================
// API REQUEST/RESPONSE SCHEMAS
// ============================================================================

// Pagination
export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// Payment Link Filters
export const PaymentLinkFiltersSchema = z.object({
  status: PaymentLinkStatusSchema.optional(),
  currency: currencyCodeSchema.optional(),
  paymentMethod: PaymentMethodSchema.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  search: z.string().max(255).optional(), // Search in description or invoice reference
});

// Status Response
export const PaymentLinkStatusResponseSchema = z.object({
  status: PaymentLinkStatusSchema,
  lastEventType: PaymentEventTypeSchema.nullable(),
  lastEventTimestamp: z.date().nullable(),
  paymentMethod: PaymentMethodSchema.nullable(),
  transactionId: z.string().nullable(),
});

// ============================================================================
// EXPORT TYPES
// ============================================================================

export type Organization = z.infer<typeof OrganizationSchema>;
export type CreateOrganization = z.infer<typeof CreateOrganizationSchema>;

export type MerchantSettings = z.infer<typeof MerchantSettingsSchema>;
export type CreateMerchantSettings = z.infer<typeof CreateMerchantSettingsSchema>;
export type UpdateMerchantSettings = z.infer<typeof UpdateMerchantSettingsSchema>;

export type PaymentLink = z.infer<typeof PaymentLinkSchema>;
export type CreatePaymentLink = z.infer<typeof CreatePaymentLinkSchema>;
export type UpdatePaymentLink = z.infer<typeof UpdatePaymentLinkSchema>;

export type PaymentEvent = z.infer<typeof PaymentEventSchema>;
export type CreatePaymentEvent = z.infer<typeof CreatePaymentEventSchema>;

export type FxSnapshot = z.infer<typeof FxSnapshotSchema>;
export type CreateFxSnapshot = z.infer<typeof CreateFxSnapshotSchema>;

export type LedgerAccount = z.infer<typeof LedgerAccountSchema>;
export type CreateLedgerAccount = z.infer<typeof CreateLedgerAccountSchema>;

export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;
export type CreateLedgerEntry = z.infer<typeof CreateLedgerEntrySchema>;
export type CreateLedgerEntries = z.infer<typeof CreateLedgerEntriesSchema>;

export type XeroConnection = z.infer<typeof XeroConnectionSchema>;
export type XeroSync = z.infer<typeof XeroSyncSchema>;
export type CreateXeroSync = z.infer<typeof CreateXeroSyncSchema>;

export type AuditLog = z.infer<typeof AuditLogSchema>;
export type CreateAuditLog = z.infer<typeof CreateAuditLogSchema>;

export type PaginationParams = z.infer<typeof PaginationSchema>;
export type PaymentLinkFilters = z.infer<typeof PaymentLinkFiltersSchema>;
export type PaymentLinkStatusResponse = z.infer<typeof PaymentLinkStatusResponseSchema>;













