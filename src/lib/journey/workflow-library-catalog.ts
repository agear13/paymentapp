import type { LucideIcon } from 'lucide-react';
import {
  Receipt,
  CreditCard,
  TrendingUp,
  Split,
  Coins,
  Workflow,
  Brain,
  Share2,
} from 'lucide-react';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import type { EntitlementFeature } from '@/lib/entitlements/types';
import { WorkspaceFeature } from '@/lib/workspace-features/types';
import { AGREEMENT_INTELLIGENCE_CONFIGURATION_SCHEMA } from '@/lib/workflows/agreement-intelligence/configuration';

export type WorkflowTemplateMetadata = {
  /** Semantic version pinned on deploy — catalog updates do not mutate installed instances. */
  version: string;
  category: string;
  /** When true, Add to Workspace is available. */
  deployable: boolean;
  /** Entitlement required to deploy; undefined = membership only. */
  requiredEntitlement?: EntitlementFeature;
  /** Workspace feature enabled when this workflow is installed. */
  workspaceFeature?: WorkspaceFeature;
  /** Capability checklist shown on preview/detail for deployable workflows. */
  previewCapabilities?: string[];
  /** Allowed configuration keys for deploy; empty = no config accepted. */
  configurationSchema?: Record<string, unknown>;
};

export type WorkflowLibraryEntry = {
  slug: string;
  name: string;
  summary: string;
  outcome: string;
  problem: string;
  overview: string;
  systems: string[];
  impact: {
    timeSaved: string;
    businessImpact: string;
    deployment: string;
  };
  capabilities: string[];
  reasoning: string[];
  saved: string;
  icon: LucideIcon;
  recommended?: boolean;
  deployRoute: string;
  previewRoute: string;
  template: WorkflowTemplateMetadata;
};

const DEFAULT_TEMPLATE: WorkflowTemplateMetadata = {
  version: '1.0.0',
  category: 'commercial',
  deployable: false,
};

const REFERRAL_MANAGEMENT_PREVIEW_CAPABILITIES = [
  'Add promoters without an agreement',
  'Assign catalogue services',
  'Issue referral links and QR codes',
  'Coordinate promoter approval and payout details',
  'Attribute referred checkout revenue',
  'Hand off commission to Settlement',
] as const;

const AGREEMENT_INTELLIGENCE_PREVIEW_CAPABILITIES = [
  'Upload agreements',
  'Extract participants',
  'Extract obligations',
  'Extract payment terms',
  'Identify revenue shares',
  'Create approval requirements',
  'Monitor obligations',
] as const;

export const WORKFLOW_LIBRARY: WorkflowLibraryEntry[] = [
  {
    slug: 'autonomous-reconciliation',
    name: 'Autonomous Reconciliation',
    summary: 'Agreements, invoices and payments reconcile end-to-end with AI oversight.',
    outcome: 'Every payment matched to the right invoice, automatically.',
    problem:
      'Finance teams spend hours matching payments to invoices across disconnected systems — the highest-volume, lowest-value work in the commercial stack.',
    overview:
      'End-to-end reconciliation between your payments, invoicing and accounting — running continuously in the background with Provvy AI oversight.',
    systems: ['Xero', 'Pinch Payments', 'Gmail', 'Google Drive'],
    impact: {
      timeSaved: '38 hrs / mo',
      businessImpact: 'A$148,000 / yr',
      deployment: 'Under 48 hours',
    },
    capabilities: [
      'Automatically match payments to invoices',
      'Reconcile across Pinch, bank feeds and accounting',
      'Detect and flag discrepancies in real time',
      'Post journals to Xero without manual entry',
      'Handle partial payments and multi-currency',
      'Generate reconciliation reports on demand',
    ],
    reasoning: [
      'Your team spends the majority of finance admin on matching payments to invoices.',
      'Because Xero and Pinch Payments are already connected, autonomous reconciliation removes the most repeatable admin while improving cashflow visibility immediately.',
      'Deploying this first creates the data foundation for forecasting, revenue sharing and reporting.',
    ],
    saved: '~ 8 hours / month',
    icon: Receipt,
    recommended: true,
    deployRoute: COMMERCIAL_OS_ROUTES.workflowReconciliation,
    previewRoute: `${COMMERCIAL_OS_ROUTES.workflowReconciliation}?tour=1`,
    template: { ...DEFAULT_TEMPLATE, category: 'reconciliation' },
  },
  {
    slug: 'payment-collection',
    name: 'Payment Collection',
    summary: 'Proactively collect on overdue invoices with contextual, AI-generated outreach.',
    outcome: 'Get paid faster with smart links, reminders and payment plans.',
    problem:
      'Late payments and manual follow-ups drain working capital and operator attention every week.',
    overview:
      'Automated collection workflows that send contextual reminders, payment links and plans grounded in each customer relationship.',
    systems: ['Pinch Payments', 'Xero', 'Gmail'],
    impact: {
      timeSaved: '22 hrs / mo',
      businessImpact: '12 days off DSO',
      deployment: 'Under 72 hours',
    },
    capabilities: [
      'Send contextual payment reminders',
      'Offer payment plans automatically',
      'Track collection performance by customer',
      'Reconcile collections to invoices',
    ],
    reasoning: [
      'Collection delays are often process failures, not customer failures.',
      'Provvy sequences outreach using invoice age, customer history and cashflow impact.',
    ],
    saved: '~ 12 days off DSO',
    icon: CreditCard,
    deployRoute: COMMERCIAL_OS_ROUTES.workflowReconciliation,
    previewRoute: COMMERCIAL_OS_ROUTES.publicWorkflowDetail('payment-collection'),
    template: { ...DEFAULT_TEMPLATE, category: 'collections' },
  },
  {
    slug: 'cashflow-forecasting',
    name: 'Cashflow Forecasting',
    summary: 'Grounded 90-day cashflow projections driven by real commercial events.',
    outcome: 'A live, 13-week view of cash grounded in your real business data.',
    problem:
      'Spreadsheet forecasts drift from reality because they are disconnected from live invoices, payments and agreements.',
    overview:
      'Rolling cashflow projections built from reconciled commercial events — invoices, payments, agreements and supplier terms.',
    systems: ['Xero', 'Pinch Payments'],
    impact: {
      timeSaved: '9 hrs / mo',
      businessImpact: 'Improved runway visibility',
      deployment: 'Under 1 week',
    },
    capabilities: [
      '13-week rolling cash forecast',
      'Scenario modelling on late payments',
      'Supplier and payroll timing overlays',
    ],
    reasoning: [
      'Forecasts are only useful when grounded in reconciled commercial data.',
      'Provvy updates projections as invoices, payments and agreements change.',
    ],
    saved: '~ 6 hours / month',
    icon: TrendingUp,
    deployRoute: COMMERCIAL_OS_ROUTES.workflowLibrary,
    previewRoute: COMMERCIAL_OS_ROUTES.publicWorkflowDetail('cashflow-forecasting'),
    template: { ...DEFAULT_TEMPLATE, category: 'forecasting' },
  },
  {
    slug: 'revenue-sharing',
    name: 'Revenue Sharing',
    summary: 'Calculate, split and settle revenue between partners on schedule.',
    outcome: 'Automate splits, referrals and partner payouts on every transaction.',
    problem:
      'Partner and referral payouts require manual calculations, approvals and settlement coordination.',
    overview:
      'Automated revenue allocation from agreements through collection, approval and settlement to each participant.',
    systems: ['Xero', 'Pinch Payments', 'Gmail'],
    impact: {
      timeSaved: '14 hrs / mo',
      businessImpact: 'Faster partner settlement',
      deployment: 'Under 1 week',
    },
    capabilities: [
      'Extract revenue share terms from agreements',
      'Calculate participant allocations automatically',
      'Coordinate approvals before settlement',
      'Release payouts when funds are confirmed',
    ],
    reasoning: [
      'Revenue sharing fails when terms live in documents instead of workflows.',
      'Provvy connects agreement intelligence to settlement execution.',
    ],
    saved: '~ 4 hours / month',
    icon: Split,
    deployRoute: COMMERCIAL_OS_ROUTES.workflowReconciliation,
    previewRoute: COMMERCIAL_OS_ROUTES.publicWorkflowDetail('revenue-sharing'),
    template: { ...DEFAULT_TEMPLATE, category: 'revenue' },
  },
  {
    slug: 'referral-management',
    name: 'Referral Management',
    summary: 'Manage promoters, affiliates and referral revenue from one place.',
    outcome: 'Acquire, attribute and coordinate referral revenue on existing Provvy checkout.',
    problem:
      'Promoters, referral links and commission tracking live in disconnected tools instead of the commercial operating system.',
    overview:
      'A first-class workflow over existing participant, referral, payout and attribution primitives — without a second referral backend.',
    systems: ['Pinch Payments', 'Xero'],
    impact: {
      timeSaved: 'Same day',
      businessImpact: 'Attributed referral revenue',
      deployment: 'Same day',
    },
    capabilities: [
      'Add promoters without uploading an agreement',
      'Issue existing referral links and QR codes',
      'Coordinate approval and payout details',
      'Attribute referred checkout revenue',
      'Open Settlement for owed commissions',
    ],
    reasoning: [
      'Referral Management acquires and attributes. Settlement shows what is owed and paid.',
      'Agreement Intelligence can optionally enrich the same participant identity.',
    ],
    saved: 'Uses existing referral infrastructure',
    icon: Share2,
    deployRoute: COMMERCIAL_OS_ROUTES.workflowInstance('referral-management'),
    previewRoute: COMMERCIAL_OS_ROUTES.workflowDetail('referral-management'),
    template: {
      version: '1.0.0',
      category: 'referral',
      deployable: true,
      requiredEntitlement: 'referral_management',
      workspaceFeature: WorkspaceFeature.CommissionLinks,
      previewCapabilities: [...REFERRAL_MANAGEMENT_PREVIEW_CAPABILITIES],
    },
  },
  {
    slug: 'supplier-payments',
    name: 'Supplier Payments',
    summary: 'Approve, batch and pay suppliers on the right cash cycle.',
    outcome: 'Approve, batch and pay suppliers on the right cash cycle.',
    problem:
      'Supplier payment runs are assembled manually from invoices, approvals and bank balances.',
    overview:
      'Batch supplier payments with approval gates, cash timing and ledger reconciliation built in.',
    systems: ['Xero', 'Pinch Payments'],
    impact: {
      timeSaved: '5 hrs / mo',
      businessImpact: 'Reduced payment admin',
      deployment: 'Under 1 week',
    },
    capabilities: [
      'Batch supplier payment proposals',
      'Approval workflows before release',
      'Cash timing recommendations',
    ],
    reasoning: [
      'Supplier payments should follow cash availability, not calendar habit.',
    ],
    saved: '~ 5 hours / month',
    icon: Coins,
    deployRoute: COMMERCIAL_OS_ROUTES.workflowLibrary,
    previewRoute: COMMERCIAL_OS_ROUTES.publicWorkflowDetail('supplier-payments'),
    template: { ...DEFAULT_TEMPLATE, category: 'payments' },
  },
  {
    slug: 'commercial-operations',
    name: 'Commercial Operations',
    summary: 'Route agreements, approvals and onboarding through one system.',
    outcome: 'Route agreements, approvals and onboarding through one system.',
    problem:
      'Agreements, participant onboarding and approvals happen across email, docs and disconnected tools.',
    overview:
      'A unified commercial operations workflow from agreement import through participant coordination and settlement readiness.',
    systems: ['Gmail', 'Google Drive', 'Xero', 'Pinch Payments'],
    impact: {
      timeSaved: '10 hrs / mo',
      businessImpact: 'Faster deal execution',
      deployment: 'Under 1 week',
    },
    capabilities: [
      'Import and extract commercial agreements',
      'Coordinate participant approvals',
      'Track settlement readiness end-to-end',
    ],
    reasoning: [
      'Commercial operations break down at handoffs between people and systems.',
      'Provvy keeps one continuous workflow from agreement to settlement.',
    ],
    saved: '~ 10 hours / month',
    icon: Workflow,
    deployRoute: COMMERCIAL_OS_ROUTES.workflowReconciliation,
    previewRoute: COMMERCIAL_OS_ROUTES.publicWorkflowDetail('commercial-operations'),
    template: { ...DEFAULT_TEMPLATE, category: 'operations' },
  },
  {
    slug: 'agreement-intelligence',
    name: 'Agreement Intelligence',
    summary: 'Extract obligations, pricing and terms from every agreement automatically.',
    outcome: 'Structured commercial data from every agreement — parties, terms and settlement logic.',
    problem:
      'Critical commercial terms remain trapped in PDFs, emails and chat threads.',
    overview:
      'AI extraction of parties, obligations, payment schedules and revenue allocation from any commercial source.',
    systems: ['Gmail', 'Google Drive', 'WhatsApp'],
    impact: {
      timeSaved: '17 hrs / mo',
      businessImpact: 'Fewer commercial errors',
      deployment: 'Same day',
    },
    capabilities: [
      'Extract parties and roles from agreements',
      'Identify payment schedules and revenue shares',
      'Flag missing terms and commercial risks',
    ],
    reasoning: [
      'Downstream workflows only work when agreements become structured data first.',
    ],
    saved: '17 hrs / mo',
    icon: Brain,
    deployRoute: COMMERCIAL_OS_ROUTES.workflowInstance('agreement-intelligence'),
    previewRoute: COMMERCIAL_OS_ROUTES.workflowDetail('agreement-intelligence'),
    template: {
      version: '1.0.0',
      category: 'agreement_intelligence',
      deployable: true,
      requiredEntitlement: 'ai_import',
      workspaceFeature: WorkspaceFeature.AgreementIntelligence,
      previewCapabilities: [...AGREEMENT_INTELLIGENCE_PREVIEW_CAPABILITIES],
      configurationSchema: AGREEMENT_INTELLIGENCE_CONFIGURATION_SCHEMA,
    },
  },
];

export function getWorkflowBySlug(slug: string): WorkflowLibraryEntry | undefined {
  return WORKFLOW_LIBRARY.find((entry) => entry.slug === slug);
}

export function getRecommendedWorkflow(): WorkflowLibraryEntry {
  return WORKFLOW_LIBRARY.find((entry) => entry.recommended) ?? WORKFLOW_LIBRARY[0]!;
}
