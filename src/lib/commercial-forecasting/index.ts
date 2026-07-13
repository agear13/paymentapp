/**
 * Commercial Forecasting — canonical domain module.
 *
 * Forecasting derives from commercial commitments — agreements, timing,
 * obligations, settlement — not historical accounting entries.
 */

export * from '@/lib/commercial-forecasting/types';
export * from '@/lib/commercial-forecasting/derive-commercial-forecast';
export * from '@/lib/commercial-forecasting/derive-revenue-forecast';
export * from '@/lib/commercial-forecasting/derive-cost-forecast';
export * from '@/lib/commercial-forecasting/derive-cashflow-forecast';
export * from '@/lib/commercial-forecasting/derive-profit-forecast';
export * from '@/lib/commercial-forecasting/derive-working-capital';
export * from '@/lib/commercial-forecasting/derive-risk-analysis';
export * from '@/lib/commercial-forecasting/derive-forecast-confidence';
export * from '@/lib/commercial-forecasting/derive-forecast-events';
export * from '@/lib/commercial-forecasting/forecast-timeline';

export * from '@/lib/commercial-forecasting/reporting/forecasting-reporting';
export * from '@/lib/commercial-forecasting/extensions/ai-recommendations';
export * from '@/lib/commercial-forecasting/extensions/partner-workspace';
