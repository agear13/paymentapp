/**
 * Derives participant commercial performance from obligations and attribution activity.
 * Never fabricates metrics — only surfaces recorded commercial activity.
 */
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { formatCurrency } from '@/lib/formatters/format-currency';
import type {
  CommercialMetricField,
  CommercialMetricValue,
  ParticipantCommercialPerformance,
  PortalAttributionActivity,
  PortalObligationSnapshot,
} from '@/lib/participant-portal/participant-portal-types';

const PAID_STATUSES = new Set(['PAID']);
const PENDING_SETTLEMENT_STATUSES = new Set([
  'AVAILABLE_FOR_PAYOUT',
  'APPROVED',
  'UNFUNDED',
  'PARTIALLY_FUNDED',
  'PENDING_APPROVAL',
]);

function sumByStatus(
  obligations: PortalObligationSnapshot[],
  statuses: Set<string>
): number {
  return obligations
    .filter((o) => statuses.has(o.status.toUpperCase()))
    .reduce((sum, o) => sum + o.amountOwed, 0);
}

function earningsModelFields(participant: DemoParticipant): CommercialMetricField[] {
  const profile = participant.compensationProfile;
  const type = profile?.compensationType;
  const fields: CommercialMetricField[] = ['current_earnings', 'pending_settlement', 'paid_to_date'];

  const hasAttribution =
    profile?.customerAttributionEnabled ||
    participant.participationModel === 'customer_attribution' ||
    Boolean(participant.referralCode?.trim()) ||
    Boolean(participant.customerCommerceUrl?.trim());

  if (type === 'COMMISSION' || hasAttribution) {
    fields.push(
      'attributed_sales',
      'orders',
      'conversions',
      'commission_earned',
      'average_order_value'
    );
    if (participant.referralCode?.trim()) fields.push('promo_code');
    if (participant.customerCommerceUrl?.trim()) fields.push('referral_link');
  }

  if (type === 'REVENUE_SHARE' || participant.commissionKind === 'pct_deal_value') {
    fields.push('revenue_generated');
  }

  return [...new Set(fields)];
}

function metricOrEmpty(
  field: CommercialMetricField,
  label: string,
  value: number | null,
  currency: string,
  emptyMessage: string
): CommercialMetricValue {
  if (value == null || (value === 0 && field !== 'orders' && field !== 'conversions')) {
    return { field, label, value: '—', emptyMessage };
  }
  if (field === 'orders' || field === 'conversions') {
    return { field, label, value: String(value), emptyMessage: value === 0 ? emptyMessage : undefined };
  }
  if (field === 'promo_code' || field === 'referral_link') {
    return { field, label, value: String(value) };
  }
  return {
    field,
    label,
    value: formatCurrency(value, currency),
    emptyMessage: value === 0 ? emptyMessage : undefined,
  };
}

export function deriveParticipantCommercialPerformance(
  participant: DemoParticipant,
  obligations: PortalObligationSnapshot[],
  attributionActivity: PortalAttributionActivity | null,
  currency: string
): ParticipantCommercialPerformance {
  const supportedFields = earningsModelFields(participant);
  const paidToDate = sumByStatus(obligations, PAID_STATUSES);
  const pendingSettlement = sumByStatus(obligations, PENDING_SETTLEMENT_STATUSES);
  const currentEarnings = obligations
    .filter((o) => o.status.toUpperCase() !== 'REVERSED')
    .reduce((sum, o) => sum + o.amountOwed, 0);

  const pct =
    participant.compensationProfile?.percentage ??
    participant.referralCommerce?.commerceCommissionPct ??
    0;

  const attr = attributionActivity;
  let commissionFromAttr = attr?.commissionEarned ?? 0;
  if (attr && commissionFromAttr === 0 && pct > 0) {
    commissionFromAttr = (attr.attributedSales * pct) / 100;
  }
  const attributedSales = attr?.attributedSales ?? 0;
  const orders = attr?.orders ?? 0;
  const avgOrder = orders > 0 ? attributedSales / orders : null;

  const emptyActivity = 'No commercial activity has been recorded yet.';

  const metrics: CommercialMetricValue[] = [];

  for (const field of supportedFields) {
    switch (field) {
      case 'current_earnings':
        metrics.push(
          metricOrEmpty(field, 'Current Earnings', obligations.length ? currentEarnings : null, currency, emptyActivity)
        );
        break;
      case 'pending_settlement':
        metrics.push(
          metricOrEmpty(field, 'Pending Settlement', obligations.length ? pendingSettlement : null, currency, emptyActivity)
        );
        break;
      case 'paid_to_date':
        metrics.push(
          metricOrEmpty(field, 'Paid To Date', obligations.length ? paidToDate : null, currency, emptyActivity)
        );
        break;
      case 'revenue_generated':
        metrics.push(
          metricOrEmpty(
            field,
            'Revenue Generated',
            attr ? attributedSales : null,
            currency,
            emptyActivity
          )
        );
        break;
      case 'attributed_sales':
        metrics.push(
          metricOrEmpty(field, 'Attributed Sales', attr ? attributedSales : null, currency, emptyActivity)
        );
        break;
      case 'orders':
        metrics.push(
          metricOrEmpty(field, 'Orders', attr ? orders : null, currency, emptyActivity)
        );
        break;
      case 'conversions':
        metrics.push(
          metricOrEmpty(field, 'Conversions', attr ? orders : null, currency, emptyActivity)
        );
        break;
      case 'commission_earned':
        metrics.push(
          metricOrEmpty(
            field,
            'Commission Earned',
            attr ? commissionFromAttr : obligations.length && pct > 0 ? pendingSettlement + paidToDate : null,
            currency,
            emptyActivity
          )
        );
        break;
      case 'average_order_value':
        metrics.push(
          metricOrEmpty(field, 'Average Order Value', avgOrder, currency, emptyActivity)
        );
        break;
      case 'promo_code':
        if (participant.referralCode?.trim()) {
          metrics.push({ field, label: 'Promo Code', value: participant.referralCode.trim() });
        }
        break;
      case 'referral_link': {
        const url = participant.customerCommerceUrl?.trim();
        if (url) {
          metrics.push({
            field,
            label: 'Referral Link',
            value: url.replace(/^https?:\/\/[^/]+/, ''),
          });
        }
        break;
      }
    }
  }

  const hasRecordedActivity =
    paidToDate > 0 ||
    pendingSettlement > 0 ||
    currentEarnings > 0 ||
    (attr != null && (attr.orders > 0 || attr.attributedSales > 0));

  return { supportedFields, metrics, hasRecordedActivity };
}
