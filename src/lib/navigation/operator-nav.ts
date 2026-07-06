type OperatorNavItemLike = {
  href: string;
};

type OperatorNavSectionLike = {
  id: string;
  href: string;
  items?: readonly OperatorNavItemLike[];
};

/** Canonical destination for connecting / managing the Stripe payment provider. */
export const MERCHANT_STRIPE_HREF = '/dashboard/settings/merchant#payment-provider';

export const PAYOUTS_HUB_HREF = '/dashboard/payouts';
export const PAYOUTS_OBLIGATIONS_HREF = '/dashboard/payouts/obligations';
export const PAYOUTS_COMMISSIONS_HREF = '/dashboard/payouts/commissions';
export const PAYOUTS_SETTLEMENTS_HREF = '/dashboard/payouts/settlements';
export const REPORTS_LEDGER_HREF = '/dashboard/reports/ledger';
export const REPORTS_EXPORTS_HREF = '/dashboard/reports/exports';
export const REPORTS_AGREEMENT_INTELLIGENCE_HREF = '/dashboard/reports/agreement-intelligence';
export const MARKETING_HREF = '/marketing';

const DEAL_NETWORK_BASE = '/dashboard/partners/deal-network';

/** Whether a pathname is active for a nav target (supports section hubs and legacy paths). */
export function isOperatorNavActive(path: string, href: string, sectionId?: string): boolean {
  if (href === '/dashboard') {
    return path === '/dashboard';
  }

  if (href === '/dashboard/projects') {
    return path === '/dashboard/projects' || path.startsWith('/dashboard/projects/');
  }

  if (href === '/dashboard/payments') {
    return (
      path === '/dashboard/payments' ||
      path === '/dashboard/payment-links' ||
      path.startsWith('/dashboard/payment-links/') ||
      path === '/dashboard/recurring-templates' ||
      path.startsWith('/dashboard/recurring-templates/') ||
      path === '/dashboard/transactions' ||
      path.startsWith('/dashboard/transactions/')
    );
  }

  if (href === PAYOUTS_HUB_HREF) {
    return path === PAYOUTS_HUB_HREF;
  }

  if (href === PAYOUTS_OBLIGATIONS_HREF) {
    return path === PAYOUTS_OBLIGATIONS_HREF || path.startsWith(`${PAYOUTS_OBLIGATIONS_HREF}/`);
  }

  if (href === PAYOUTS_COMMISSIONS_HREF) {
    return path === PAYOUTS_COMMISSIONS_HREF || path.startsWith(`${PAYOUTS_COMMISSIONS_HREF}/`);
  }

  if (href === PAYOUTS_SETTLEMENTS_HREF) {
    return path === PAYOUTS_SETTLEMENTS_HREF || path.startsWith(`${PAYOUTS_SETTLEMENTS_HREF}/`);
  }

  if (sectionId === 'payouts') {
    return (
      path === PAYOUTS_HUB_HREF ||
      path.startsWith(`${PAYOUTS_HUB_HREF}/`) ||
      path === '/dashboard/partners/commissions' ||
      path.startsWith('/dashboard/partners/commissions/') ||
      path === '/dashboard/partners/payouts' ||
      path.startsWith('/dashboard/partners/payouts/')
    );
  }

  if (href === '/dashboard/reports') {
    return path === '/dashboard/reports';
  }

  if (href === REPORTS_LEDGER_HREF) {
    return (
      path === REPORTS_LEDGER_HREF ||
      path.startsWith(`${REPORTS_LEDGER_HREF}/`) ||
      path === '/dashboard/ledger' ||
      path.startsWith('/dashboard/ledger/')
    );
  }

  if (href === REPORTS_EXPORTS_HREF) {
    return path === REPORTS_EXPORTS_HREF || path.startsWith(`${REPORTS_EXPORTS_HREF}/`);
  }

  if (href === REPORTS_AGREEMENT_INTELLIGENCE_HREF) {
    return (
      path === REPORTS_AGREEMENT_INTELLIGENCE_HREF ||
      path.startsWith(`${REPORTS_AGREEMENT_INTELLIGENCE_HREF}/`)
    );
  }

  if (sectionId === 'reports') {
    return path === '/dashboard/reports' || path.startsWith('/dashboard/reports/');
  }

  if (href === MARKETING_HREF || sectionId === 'marketing') {
    return path === MARKETING_HREF || path.startsWith(`${MARKETING_HREF}/`);
  }

  if (href.startsWith('/dashboard/settings') || sectionId === 'settings') {
    return (
      path.startsWith('/dashboard/settings') ||
      path === '/dashboard/admin' ||
      path.startsWith('/dashboard/admin/') ||
      path === '/dashboard/agreement-analyzer' ||
      path.startsWith('/dashboard/agreement-analyzer/') ||
      path === '/dashboard/partners/rules' ||
      path.startsWith('/dashboard/partners/rules/') ||
      path === '/dashboard/partners/referral-links' ||
      path.startsWith('/dashboard/partners/referral-links/') ||
      (sectionId === 'settings' && path === '/dashboard/referrals')
    );
  }

  if (href === DEAL_NETWORK_BASE) {
    return (
      path === DEAL_NETWORK_BASE ||
      (path.startsWith(`${DEAL_NETWORK_BASE}/`) &&
        path !== `${DEAL_NETWORK_BASE}/obligations` &&
        !path.startsWith(`${DEAL_NETWORK_BASE}/obligations/`))
    );
  }

  if (href === `${DEAL_NETWORK_BASE}/obligations`) {
    return path === href || path.startsWith(`${href}/`);
  }

  if (href === '/dashboard/payment-links' || href === '/dashboard/recurring-templates') {
    return path === href || path.startsWith(`${href}/`);
  }

  if (href === '/dashboard/transactions') {
    return path === href || path.startsWith(`${href}/`);
  }

  return path === href || path.startsWith(`${href}/`);
}

export function isOperatorSectionActive(
  path: string,
  section: OperatorNavSectionLike
): boolean {
  if (isOperatorNavActive(path, section.href, section.id)) return true;
  return section.items?.some((item) => isOperatorNavActive(path, item.href, section.id)) ?? false;
}

/** Skip redundant Overview sub-link when it matches section hub or a child href. */
export function shouldShowSectionOverviewSubLink(
  section: OperatorNavItemLike,
  childItems: readonly OperatorNavItemLike[]
): boolean {
  if (childItems.some((item) => item.href === section.href)) return false;
  return true;
}
