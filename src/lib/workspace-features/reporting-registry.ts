import type { FeatureRegistryItemWithFeature } from './registry';
import { WorkspaceFeature } from './types';
import { PRODUCT_TERMINOLOGY } from '@/lib/product/product-terminology';

export type WorkspaceReportRegistryItem = FeatureRegistryItemWithFeature;

export const WORKSPACE_REPORTING_REGISTRY = [
  {
    id: 'reporting-overview',
    title: 'Reporting overview',
    href: '/dashboard/reports',
    requiredFeature: WorkspaceFeature.Reporting,
  },
  {
    id: 'ledger',
    title: 'Ledger',
    href: '/dashboard/reports/ledger',
    requiredFeature: WorkspaceFeature.Ledger,
  },
  {
    id: 'exports',
    title: 'Export Center',
    href: '/dashboard/reports/exports',
    requiredFeature: WorkspaceFeature.Exports,
  },
  {
    id: 'agreement-intelligence',
    title: PRODUCT_TERMINOLOGY.projectIntelligence,
    href: '/dashboard/reports/agreement-intelligence',
    requiredFeature: WorkspaceFeature.AgreementIntelligence,
  },
] as const satisfies readonly WorkspaceReportRegistryItem[];
