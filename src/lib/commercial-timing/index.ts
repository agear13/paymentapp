/**
 * Commercial Timing — canonical domain module.
 *
 * Commercial Timing represents when commercial activity occurs, independently
 * from invoice issue dates and payment receipt dates.
 *
 * Source of truth: the commercial agreement.
 * Accounting, settlement, reporting, and forecasting consume this module.
 */

export * from '@/lib/commercial-timing/types';
export * from '@/lib/commercial-timing/serialization';
export * from '@/lib/commercial-timing/resolve-commercial-timing';
export * from '@/lib/commercial-timing/inherit-commercial-timing';
export * from '@/lib/commercial-timing/commercial-timing-payload';
export * from '@/lib/commercial-timing/payment-link-timing';
export * from '@/lib/commercial-timing/validation';

export * from '@/lib/commercial-timing/extensions/revenue-recognition';
export * from '@/lib/commercial-timing/extensions/forecasting';
export * from '@/lib/commercial-timing/extensions/reporting';
export * from '@/lib/commercial-timing/extensions/settlement-timing';
export * from '@/lib/commercial-timing/extensions/accounting-export-mapping';
export * from '@/lib/commercial-timing/extensions/agreement-intelligence';
