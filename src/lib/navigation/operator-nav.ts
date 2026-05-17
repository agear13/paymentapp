import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  FolderKanban,
  Wallet,
  Banknote,
  BarChart3,
  Settings,
  Link as LinkIcon,
  Repeat,
  CreditCard,
  FileCheck,
  CircleDollarSign,
  History,
  Building2,
  Plug,
  Package,
  BookOpen,
  Share2,
  Activity,
} from 'lucide-react';
import type { DashboardProductProfile } from '@/lib/auth/admin-shared';

export type OperatorNavItem = {
  title: string;
  href: string;
  icon?: LucideIcon;
  /** Shown only for beta admin (partner paths / internal tooling) */
  adminOnly?: boolean;
};

export type OperatorNavSection = {
  id: string;
  title: string;
  href: string;
  icon: LucideIcon;
  items?: OperatorNavItem[];
};

export const PAYOUTS_HUB_HREF = '/dashboard/payouts';
export const PAYOUTS_OBLIGATIONS_HREF = '/dashboard/payouts/obligations';
const DEAL_NETWORK_BASE = '/dashboard/partners/deal-network';

/** Primary workflow navigation — Projects and Payouts are always visible. */
export function getOperatorNavSections(
  productProfile: DashboardProductProfile
): OperatorNavSection[] {
  const isAdmin = productProfile === 'admin';

  const sections: OperatorNavSection[] = [
    {
      id: 'home',
      title: 'Home',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'projects',
      title: 'Projects',
      href: '/dashboard/projects',
      icon: FolderKanban,
    },
    {
      id: 'payments',
      title: 'Payments',
      href: '/dashboard/payments',
      icon: Wallet,
      items: [
        { title: 'Invoices', href: '/dashboard/payment-links', icon: LinkIcon },
        { title: 'Recurring', href: '/dashboard/recurring-templates', icon: Repeat },
        { title: 'Transactions', href: '/dashboard/transactions', icon: CreditCard },
      ],
    },
    {
      id: 'payouts',
      title: 'Payouts',
      href: PAYOUTS_HUB_HREF,
      icon: Banknote,
      items: [
        {
          title: 'Obligations',
          href: PAYOUTS_OBLIGATIONS_HREF,
          icon: FileCheck,
        },
        {
          title: 'Commissions',
          href: '/dashboard/partners/commissions',
          icon: CircleDollarSign,
          adminOnly: true,
        },
        {
          title: 'Settlement history',
          href: '/dashboard/partners/payouts',
          icon: History,
          adminOnly: true,
        },
      ],
    },
    {
      id: 'reports',
      title: 'Reports',
      href: '/dashboard/reports',
      icon: BarChart3,
      items: [{ title: 'Transactions', href: '/dashboard/transactions' }],
    },
    {
      id: 'settings',
      title: 'Settings',
      href: '/dashboard/settings/organization',
      icon: Settings,
      items: [
        {
          title: 'Organization',
          href: '/dashboard/settings/organization',
          icon: Building2,
        },
        { title: 'Merchant & rails', href: '/dashboard/settings/merchant' },
        { title: 'Team', href: '/dashboard/settings/team' },
        {
          title: 'Integrations',
          href: '/dashboard/settings/integrations',
          icon: Plug,
        },
        {
          title: 'Service catalog',
          href: '/dashboard/settings/services',
          icon: Package,
        },
        {
          title: 'Ledger',
          href: '/dashboard/ledger',
          icon: BookOpen,
          adminOnly: true,
        },
        {
          title: 'Allocation rules',
          href: '/dashboard/partners/rules',
          adminOnly: true,
        },
        {
          title: 'Commission links',
          href: '/dashboard/partners/referral-links',
          adminOnly: true,
        },
        {
          title: 'Admin operations',
          href: '/dashboard/admin',
          icon: Activity,
          adminOnly: true,
        },
        {
          title: 'Referral sharing',
          href: '/dashboard/referrals',
          icon: Share2,
          adminOnly: true,
        },
      ],
    },
  ];

  return sections.map((section) => ({
    ...section,
    items: section.items?.filter((item) => {
      if (item.adminOnly && !isAdmin) return false;
      return true;
    }),
  }));
}

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
      path.startsWith('/dashboard/recurring-templates/')
    );
  }

  if (href === PAYOUTS_HUB_HREF) {
    return path === PAYOUTS_HUB_HREF;
  }

  if (href === PAYOUTS_OBLIGATIONS_HREF) {
    return path === PAYOUTS_OBLIGATIONS_HREF || path.startsWith(`${PAYOUTS_OBLIGATIONS_HREF}/`);
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
    return path === '/dashboard/reports' || path.startsWith('/dashboard/reports/');
  }

  if (sectionId === 'reports' && href === '/dashboard/transactions') {
    return path === '/dashboard/transactions' || path.startsWith('/dashboard/transactions/');
  }

  if (href.startsWith('/dashboard/settings') || sectionId === 'settings') {
    return (
      path.startsWith('/dashboard/settings') ||
      path === '/dashboard/ledger' ||
      path.startsWith('/dashboard/ledger/') ||
      path === '/dashboard/admin' ||
      path.startsWith('/dashboard/admin/') ||
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
        path !== PAYOUTS_OBLIGATIONS_HREF &&
        !path.startsWith(`${PAYOUTS_OBLIGATIONS_HREF}/`))
    );
  }

  if (href === '/dashboard/payment-links' || href === '/dashboard/recurring-templates') {
    return path === href || path.startsWith(`${href}/`);
  }

  return path === href || path.startsWith(`${href}/`);
}

export function isOperatorSectionActive(
  path: string,
  section: OperatorNavSection
): boolean {
  if (isOperatorNavActive(path, section.href, section.id)) return true;
  return section.items?.some((item) => isOperatorNavActive(path, item.href, section.id)) ?? false;
}

/** Skip redundant Overview sub-link when it matches section hub or a child href. */
export function shouldShowSectionOverviewSubLink(
  section: OperatorNavSection,
  childItems: OperatorNavItem[]
): boolean {
  if (childItems.some((item) => item.href === section.href)) return false;
  return true;
}
