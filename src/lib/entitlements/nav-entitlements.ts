import type { EntitlementFeature } from '@/lib/entitlements/types';
import {
  PAYOUTS_COMMISSIONS_HREF,
  PAYOUTS_OBLIGATIONS_HREF,
  PAYOUTS_SETTLEMENTS_HREF,
  REPORTS_AGREEMENT_INTELLIGENCE_HREF,
  REPORTS_EXPORTS_HREF,
  REPORTS_LEDGER_HREF,
} from '@/lib/navigation/operator-nav';

/** Maps dashboard hrefs to entitlement features for nav filtering. */
export const NAV_HREF_ENTITLEMENT: Record<string, EntitlementFeature> = {
  '/dashboard/payment-links': 'payment_links',
  '/dashboard/recurring-templates': 'payment_links',
  '/dashboard/transactions': 'payment_links',
  [PAYOUTS_SETTLEMENTS_HREF]: 'automated_settlement_coordination',
  [REPORTS_AGREEMENT_INTELLIGENCE_HREF]: 'advanced_reporting',
  [REPORTS_LEDGER_HREF]: 'advanced_reporting',
  [REPORTS_EXPORTS_HREF]: 'advanced_reporting',
  '/dashboard/monitoring': 'advanced_reporting',
  '/dashboard/settings/integrations': 'xero_integration',
  '/dashboard/settings/team': 'team_members',
  '/dashboard/partners/referral-links': 'referral_management',
  '/dashboard/partners/rules': 'referral_management',
  '/dashboard/partners/commissions': 'referral_management',
  '/dashboard/partners/payouts': 'referral_management',
  '/dashboard/referrals': 'referral_management',
};

/** Paths that remain visible but show locked state when gated. */
export const NAV_LOCKED_VISIBLE_HREFS = new Set([
  '/dashboard/payment-links',
  '/dashboard/settings/integrations',
  '/dashboard/settings/team',
  PAYOUTS_SETTLEMENTS_HREF,
  REPORTS_LEDGER_HREF,
]);

export function entitlementForNavHref(href: string): EntitlementFeature | null {
  if (href === PAYOUTS_OBLIGATIONS_HREF || href === PAYOUTS_COMMISSIONS_HREF) {
    return null;
  }
  return NAV_HREF_ENTITLEMENT[href] ?? null;
}
