import type { ObligationOperationalReadiness } from '@/lib/projects/funding-sources/types';

const READINESS_LABELS: Record<ObligationOperationalReadiness, string> = {
  ready: 'Ready',
  partially_funded: 'Partially funded',
  awaiting_funding: 'Awaiting funding',
  blocked: 'Blocked',
  forecast_only: 'Forecast only',
  obligations_pending: 'Needs review',
};

export function formatOperationalReadiness(readiness: ObligationOperationalReadiness): string {
  return READINESS_LABELS[readiness] ?? readiness;
}

export function operationalReadinessBadgeVariant(
  readiness: ObligationOperationalReadiness
): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (readiness) {
    case 'ready':
      return 'default';
    case 'partially_funded':
      return 'secondary';
    case 'awaiting_funding':
    case 'forecast_only':
      return 'outline';
    case 'blocked':
    case 'obligations_pending':
      return 'destructive';
    default:
      return 'outline';
  }
}
