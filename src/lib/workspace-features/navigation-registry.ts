import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Banknote,
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  CircleDollarSign,
  CreditCard,
  Download,
  FileCheck,
  FolderKanban,
  History,
  LayoutDashboard,
  Link as LinkIcon,
  Megaphone,
  Package,
  Plug,
  Repeat,
  Settings,
  Share2,
  Handshake,
  Layers,
  Wallet,
} from 'lucide-react';
import type { FeatureRegistryItemWithFeature } from './registry';
import { WorkspaceFeature } from './types';
import { PRODUCT_TERMINOLOGY } from '@/lib/product/product-terminology';

export type WorkspaceNavigationRegistryChild = FeatureRegistryItemWithFeature<LucideIcon> & {
  adminOnly?: boolean;
};

export type WorkspaceNavigationRegistryItem = FeatureRegistryItemWithFeature<LucideIcon> & {
  icon: LucideIcon;
  adminOnly?: boolean;
  items?: readonly WorkspaceNavigationRegistryChild[];
};

export const WORKSPACE_NAVIGATION_REGISTRY = [
  {
    id: 'home',
    title: 'Dashboard',
    icon: LayoutDashboard,
    href: '/dashboard',
    requiredFeature: WorkspaceFeature.Dashboard,
  },
  {
    id: 'calendar',
    title: 'Calendar',
    icon: CalendarDays,
    href: '/dashboard/calendar',
    requiredFeature: WorkspaceFeature.Calendar,
  },
  {
    id: 'projects',
    title: PRODUCT_TERMINOLOGY.projects,
    icon: FolderKanban,
    href: '/dashboard/projects',
    requiredFeature: WorkspaceFeature.Agreements,
  },
  {
    id: 'payments',
    title: 'Funding',
    icon: Wallet,
    href: '/dashboard/payments',
    requiredFeature: WorkspaceFeature.Payments,
    items: [
      {
        id: 'payments-overview',
        title: 'Overview',
        href: '/dashboard/payments',
        requiredFeature: WorkspaceFeature.Payments,
      },
      {
        id: 'invoices',
        title: 'Invoices',
        href: '/dashboard/payment-links',
        icon: LinkIcon,
        requiredFeature: WorkspaceFeature.Invoices,
      },
      {
        id: 'recurring-schedules',
        title: 'Recurring schedules',
        href: '/dashboard/recurring-templates',
        icon: Repeat,
        requiredFeature: WorkspaceFeature.Payments,
      },
      {
        id: 'funding-activity',
        title: 'Funding activity',
        href: '/dashboard/transactions',
        icon: CreditCard,
        requiredFeature: WorkspaceFeature.Funding,
      },
    ],
  },
  {
    id: 'payouts',
    title: 'Settlement',
    icon: Banknote,
    href: '/dashboard/payouts',
    requiredFeature: WorkspaceFeature.Settlement,
    items: [
      {
        id: 'settlement-overview',
        title: 'Overview',
        href: '/dashboard/payouts',
        requiredFeature: WorkspaceFeature.Settlement,
      },
      {
        id: 'obligations',
        title: 'Obligations',
        href: '/dashboard/payouts/obligations',
        icon: FileCheck,
        requiredFeature: WorkspaceFeature.Obligations,
      },
      {
        id: 'earnings-readiness',
        title: 'Earnings & readiness',
        href: '/dashboard/payouts/commissions',
        icon: CircleDollarSign,
        requiredFeature: WorkspaceFeature.Earnings,
      },
      {
        id: 'settlement-releases',
        title: 'Settlement releases',
        href: '/dashboard/payouts/settlements',
        icon: History,
        requiredFeature: WorkspaceFeature.Settlement,
      },
    ],
  },
  {
    id: 'reporting',
    title: 'Reporting',
    icon: BarChart3,
    href: '/dashboard/reports',
    requiredFeature: WorkspaceFeature.Reporting,
    items: [
      {
        id: 'reporting-overview',
        title: 'Overview',
        href: '/dashboard/reports',
        requiredFeature: WorkspaceFeature.Reporting,
      },
      {
        id: 'agreement-intelligence',
        title: PRODUCT_TERMINOLOGY.projectIntelligence,
        href: '/dashboard/reports/agreement-intelligence',
        icon: Activity,
        requiredFeature: WorkspaceFeature.AgreementIntelligence,
      },
      {
        id: 'ledger',
        title: 'Ledger',
        href: '/dashboard/reports/ledger',
        icon: BookOpen,
        requiredFeature: WorkspaceFeature.Ledger,
      },
      {
        id: 'exports',
        title: 'Export Center',
        href: '/dashboard/reports/exports',
        icon: Download,
        requiredFeature: WorkspaceFeature.Exports,
      },
    ],
  },
  {
    id: 'marketing',
    title: 'Marketing',
    icon: Megaphone,
    href: '/marketing',
    requiredFeature: WorkspaceFeature.Marketing,
  },
  {
    id: 'settings',
    title: 'Settings',
    icon: Settings,
    href: '/dashboard/settings/organization',
    requiredFeature: WorkspaceFeature.Settings,
    items: [
      {
        id: 'organization-settings',
        title: 'Organization',
        href: '/dashboard/settings/organization',
        icon: Building2,
        requiredFeature: WorkspaceFeature.Settings,
      },
      {
        id: 'billing-settings',
        title: 'Billing',
        href: '/dashboard/settings/billing',
        icon: CreditCard,
        requiredFeature: WorkspaceFeature.Settings,
      },
      {
        id: 'collection-settlement-infrastructure',
        title: 'Collection & settlement infrastructure',
        href: '/dashboard/settings/merchant',
        requiredFeature: WorkspaceFeature.Settings,
      },
      {
        id: 'team-settings',
        title: 'Team',
        href: '/dashboard/settings/team',
        requiredFeature: WorkspaceFeature.Settings,
      },
      {
        id: 'integration-settings',
        title: 'Integrations',
        href: '/dashboard/settings/integrations',
        icon: Plug,
        requiredFeature: WorkspaceFeature.Integrations,
      },
      {
        id: 'service-catalog-settings',
        title: 'Service catalog',
        href: '/dashboard/settings/services',
        icon: Package,
        requiredFeature: WorkspaceFeature.Settings,
      },
      {
        id: 'allocation-rules',
        title: 'Allocation rules',
        href: '/dashboard/partners/rules',
        requiredFeature: WorkspaceFeature.AllocationRules,
        adminOnly: true,
      },
      {
        id: 'commission-links',
        title: 'Commission links',
        href: '/dashboard/partners/referral-links',
        requiredFeature: WorkspaceFeature.CommissionLinks,
        adminOnly: true,
      },
      {
        id: 'agreement-analyzer',
        title: 'Agreement Analyzer',
        href: '/dashboard/agreement-analyzer',
        icon: FileCheck,
        requiredFeature: WorkspaceFeature.AgreementIntelligence,
        adminOnly: true,
      },
      {
        id: 'admin-operations',
        title: 'Admin operations',
        href: '/dashboard/admin',
        icon: Activity,
        requiredFeature: WorkspaceFeature.Settings,
        adminOnly: true,
      },
      {
        id: 'referral-sharing',
        title: 'Referral sharing',
        href: '/dashboard/referrals',
        icon: Share2,
        requiredFeature: WorkspaceFeature.CommissionLinks,
        adminOnly: true,
      },
    ],
  },
] as const satisfies readonly WorkspaceNavigationRegistryItem[];

export const WORKSPACE_PLATFORM_PREVIEW_NAVIGATION_REGISTRY = [
  {
    id: 'platform-preview',
    title: 'Platform Preview',
    icon: Layers,
    href: '/dashboard/platform-preview/overview',
    requiredFeature: WorkspaceFeature.Dashboard,
    adminOnly: true,
    items: [
      {
        id: 'platform-preview-overview',
        title: 'Overview',
        href: '/dashboard/platform-preview/overview',
        requiredFeature: WorkspaceFeature.Dashboard,
      },
      {
        id: 'platform-preview-connections',
        title: 'Connections',
        href: '/dashboard/platform-preview/connections',
        requiredFeature: WorkspaceFeature.Dashboard,
      },
      {
        id: 'platform-preview-inventory',
        title: 'Inventory',
        href: '/dashboard/platform-preview/inventory',
        requiredFeature: WorkspaceFeature.Dashboard,
      },
      {
        id: 'platform-preview-ledger',
        title: 'Unified Ledger',
        href: '/dashboard/platform-preview/ledger',
        requiredFeature: WorkspaceFeature.Dashboard,
      },
    ],
  },
] as const satisfies readonly WorkspaceNavigationRegistryItem[];

export const WORKSPACE_PARTNER_PREVIEW_NAVIGATION_REGISTRY = [
  {
    id: 'partner-preview',
    title: 'Partner Workspace',
    icon: Building2,
    href: '/dashboard/partner-preview',
    requiredFeature: WorkspaceFeature.Dashboard,
    adminOnly: true,
  },
] as const satisfies readonly WorkspaceNavigationRegistryItem[];

export const RABBIT_HOLE_PILOT_NAVIGATION_REGISTRY = [
  {
    id: 'deal-network',
    title: 'Deal Network',
    href: '/dashboard/partners/deal-network',
    icon: Handshake,
    requiredFeature: WorkspaceFeature.Agreements,
  },
  {
    id: 'deal-network-obligations',
    title: 'Obligations',
    href: '/dashboard/partners/deal-network/obligations',
    icon: FileCheck,
    requiredFeature: WorkspaceFeature.Obligations,
  },
  {
    id: 'pilot-invoices',
    title: 'Invoices',
    href: '/dashboard/payment-links',
    icon: LinkIcon,
    requiredFeature: WorkspaceFeature.Invoices,
  },
  {
    id: 'pilot-recurring',
    title: 'Recurring',
    href: '/dashboard/recurring-templates',
    icon: Repeat,
    requiredFeature: WorkspaceFeature.Payments,
  },
  {
    id: 'pilot-collection-settlement',
    title: 'Collection & settlement',
    href: '/dashboard/settings/merchant',
    icon: Building2,
    requiredFeature: WorkspaceFeature.Settings,
  },
] as const satisfies readonly WorkspaceNavigationRegistryItem[];

export const STRAIT_EXPERIENCES_PILOT_NAVIGATION_REGISTRY = [
  {
    ...RABBIT_HOLE_PILOT_NAVIGATION_REGISTRY[0],
    title: PRODUCT_TERMINOLOGY.projects,
  },
  ...RABBIT_HOLE_PILOT_NAVIGATION_REGISTRY.slice(1),
] as const satisfies readonly WorkspaceNavigationRegistryItem[];
