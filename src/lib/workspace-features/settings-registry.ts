import type { FeatureRegistryItemWithFeature } from './registry';
import { WorkspaceFeature } from './types';

export type WorkspaceSettingsRegistryItem = FeatureRegistryItemWithFeature;

export const WORKSPACE_SETTINGS_REGISTRY = [
  {
    id: 'organization-settings',
    title: 'Organization',
    href: '/dashboard/settings/organization',
    requiredFeature: WorkspaceFeature.Settings,
  },
  {
    id: 'billing-settings',
    title: 'Billing',
    href: '/dashboard/settings/billing',
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
    requiredFeature: WorkspaceFeature.Integrations,
  },
  {
    id: 'xero-settings',
    title: 'Xero',
    href: '/dashboard/settings/integrations#xero',
    requiredFeature: WorkspaceFeature.Xero,
  },
  {
    id: 'service-catalog-settings',
    title: 'Service catalog',
    href: '/dashboard/settings/services',
    requiredFeature: WorkspaceFeature.Settings,
  },
  {
    id: 'notification-settings',
    title: 'Notifications',
    href: '/dashboard/settings/notifications',
    requiredFeature: WorkspaceFeature.Settings,
  },
  {
    id: 'privacy-settings',
    title: 'Privacy',
    href: '/dashboard/settings/privacy',
    requiredFeature: WorkspaceFeature.Settings,
  },
  {
    id: 'allocation-rules',
    title: 'Allocation rules',
    href: '/dashboard/partners/rules',
    requiredFeature: WorkspaceFeature.AllocationRules,
  },
  {
    id: 'commission-links',
    title: 'Commission links',
    href: '/dashboard/partners/referral-links',
    requiredFeature: WorkspaceFeature.CommissionLinks,
  },
] as const satisfies readonly WorkspaceSettingsRegistryItem[];
