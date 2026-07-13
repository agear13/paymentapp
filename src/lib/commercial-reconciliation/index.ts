/**
 * Commercial Reconciliation — canonical domain module.
 *
 * Commercial reconciliation matches payments to invoices using commercial identity.
 * Accounting systems consume results; bank feeds confirm settlement afterwards.
 */

export * from '@/lib/commercial-reconciliation/types';
export * from '@/lib/commercial-reconciliation/derive-clearing-account';
export * from '@/lib/commercial-reconciliation/derive-payment-allocation';
export * from '@/lib/commercial-reconciliation/derive-reconciliation-status';
export * from '@/lib/commercial-reconciliation/derive-bank-settlement';
export * from '@/lib/commercial-reconciliation/derive-commercial-reconciliation';
export * from '@/lib/commercial-reconciliation/adapters/reconciliation-rail-adapters';

export * from '@/lib/commercial-reconciliation/extensions/refunds';
export * from '@/lib/commercial-reconciliation/extensions/chargebacks';
export * from '@/lib/commercial-reconciliation/extensions/future-providers';
export * from '@/lib/commercial-reconciliation/reporting/reconciliation-reporting';
