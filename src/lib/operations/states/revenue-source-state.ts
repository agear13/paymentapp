/**
 * REVENUE SOURCE — customer inflow or forecast feeding project treasury.
 */

export const REVENUE_SOURCE_STATES = [
  'DRAFT',
  'PENDING_COLLECTION',
  'COLLECTED',
  'HELD',
  'ALLOCATED',
  'RELEASED',
  'FAILED',
  'REFUNDED',
] as const;

export type RevenueSourceState = (typeof REVENUE_SOURCE_STATES)[number];

export const REVENUE_SOURCE_TYPES = [
  'TICKETING',
  'SPONSORSHIP',
  'BOOKING',
  'INVOICE',
  'MANUAL_FORECAST',
  'PAYMENT_LINK',
] as const;

export type RevenueSourceType = (typeof REVENUE_SOURCE_TYPES)[number];
