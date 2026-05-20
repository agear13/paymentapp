import type { ProjectFundingSourceStatus, ProjectFundingSourceType } from '@prisma/client';
import type { ProjectTreasuryHealth } from '@/lib/projects/funding-sources/types';

const STATUS_LABELS: Record<ProjectFundingSourceStatus, string> = {
  forecast: 'Forecast',
  pending: 'Pending',
  confirmed: 'Confirmed',
  cleared: 'Cleared',
  reconciled: 'Reconciled',
};

const TYPE_LABELS: Record<ProjectFundingSourceType, string> = {
  invoice: 'Invoice',
  payment_link: 'Payment link',
  sponsorship: 'Sponsorship',
  ticketing: 'Ticketing',
  table_booking: 'Table booking',
  manual_forecast: 'Manual forecast',
  bank_transfer: 'Bank transfer',
  cash: 'Cash',
  accounting_sync: 'Accounting sync',
  other: 'Other',
};

const HEALTH_LABELS: Record<ProjectTreasuryHealth, string> = {
  healthy: 'Healthy',
  funding_pending: 'Funding pending',
  forecast_heavy: 'Forecast heavy',
  partially_funded: 'Partially funded',
  settlement_risk: 'Settlement risk',
  ready_for_payout: 'Ready for payout',
};

export function formatFundingSourceStatus(status: ProjectFundingSourceStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function formatFundingSourceType(type: ProjectFundingSourceType): string {
  return TYPE_LABELS[type] ?? type;
}

export function formatProjectTreasuryHealth(health: ProjectTreasuryHealth): string {
  return HEALTH_LABELS[health] ?? health;
}

export function formatTreasuryAmount(amount: number, currency: string): string {
  const code = (currency || 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  }
}

export const FUNDING_SOURCE_TYPE_OPTIONS: { value: ProjectFundingSourceType; label: string }[] = (
  Object.entries(TYPE_LABELS) as [ProjectFundingSourceType, string][]
).map(([value, label]) => ({ value, label }));

export const FUNDING_SOURCE_STATUS_OPTIONS: { value: ProjectFundingSourceStatus; label: string }[] =
  (Object.entries(STATUS_LABELS) as [ProjectFundingSourceStatus, string][]).map(([value, label]) => ({
    value,
    label,
  }));
