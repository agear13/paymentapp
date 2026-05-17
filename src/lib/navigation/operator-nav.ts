import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  FolderKanban,
  Users,
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
  /** Shown only when operator has revenue-share / project coordination access */
  revenueShareOnly?: boolean;
  /** Shown only for beta admin (internal tooling) */
  adminOnly?: boolean;
};

export type OperatorNavSection = {
  id: string;
  title: string;
  href: string;
  icon: LucideIcon;
  items?: OperatorNavItem[];
  revenueShareOnly?: boolean;
};

const DEAL_NETWORK_BASE = '/dashboard/partners/deal-network';
const OBLIGATIONS_HREF = `${DEAL_NETWORK_BASE}/obligations`;

/** Primary workflow navigation for standard operators and beta admins. */
export function getOperatorNavSections(
  productProfile: DashboardProductProfile
): OperatorNavSection[] {
  const hasRevenueShare = productProfile === 'admin';

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
      revenueShareOnly: true,
    },
    {
      id: 'participants',
      title: 'Participants',
      href: '/dashboard/participants',
      icon: Users,
      revenueShareOnly: true,
      items: [
        {
          title: 'All participants',
          href: '/dashboard/programs/participants',
          revenueShareOnly: true,
        },
        {
          title: 'My referrals',
          href: '/dashboard/referrals/mine',
          revenueShareOnly: true,
        },
        {
          title: 'Payout methods',
          href: '/dashboard/partners/payout-methods',
          revenueShareOnly: true,
        },
      ],
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
      href: '/dashboard/payouts',
      icon: Banknote,
      revenueShareOnly: true,
      items: [
        {
          title: 'Obligations',
          href: OBLIGATIONS_HREF,
          icon: FileCheck,
          revenueShareOnly: true,
        },
        {
          title: 'Commissions',
          href: '/dashboard/partners/commissions',
          icon: CircleDollarSign,
          revenueShareOnly: true,
        },
        {
          title: 'Payout history',
          href: '/dashboard/partners/payouts',
          icon: History,
          revenueShareOnly: true,
        },
      ],
    },
    {
      id: 'reports',
      title: 'Reports',
      href: '/dashboard/reports',
      icon: BarChart3,
      items: [
        { title: 'Overview', href: '/dashboard/reports' },
        { title: 'Transactions', href: '/dashboard/transactions' },
        {
          title: 'Commissions',
          href: '/dashboard/partners/commissions',
          revenueShareOnly: true,
        },
      ],
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

  return sections.filter((section) => {
    if (section.revenueShareOnly && !hasRevenueShare) return false;
    return true;
  }).map((section) => ({
    ...section,
    items: section.items?.filter((item) => {
      if (item.revenueShareOnly && !hasRevenueShare) return false;
      if (item.adminOnly && productProfile !== 'admin') return false;
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

  if (href === '/dashboard/participants') {
    return (
      path === '/dashboard/participants' ||
      path.startsWith('/dashboard/programs/participants') ||
      path === '/dashboard/referrals/mine' ||
      path.startsWith('/dashboard/referrals/mine/') ||
      path === '/dashboard/partners/payout-methods' ||
      path.startsWith('/dashboard/partners/payout-methods/') ||
      (path === '/dashboard/referrals' && sectionId === 'participants')
    );
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

  if (href === '/dashboard/payouts') {
    return (
      path === '/dashboard/payouts' ||
      path === OBLIGATIONS_HREF ||
      path.startsWith(`${OBLIGATIONS_HREF}/`) ||
      path === '/dashboard/partners/commissions' ||
      path.startsWith('/dashboard/partners/commissions/') ||
      path === '/dashboard/partners/payouts' ||
      path.startsWith('/dashboard/partners/payouts/')
    );
  }

  if (href === '/dashboard/reports') {
    return path === '/dashboard/reports' || path.startsWith('/dashboard/reports/');
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
        path !== OBLIGATIONS_HREF &&
        !path.startsWith(`${OBLIGATIONS_HREF}/`))
    );
  }

  if (href === OBLIGATIONS_HREF) {
    return path === OBLIGATIONS_HREF || path.startsWith(`${OBLIGATIONS_HREF}/`);
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
