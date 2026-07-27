import type { LucideIcon } from 'lucide-react';
import {
  Receipt,
  CreditCard,
  TrendingUp,
  Split,
  Coins,
  Workflow,
  Brain,
} from 'lucide-react';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

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
};

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
    deployRoute: COMMERCIAL_OS_ROUTES.workflowReconciliation,
    previewRoute: COMMERCIAL_OS_ROUTES.publicWorkflowDetail('agreement-intelligence'),
  },
];

export function getWorkflowBySlug(slug: string): WorkflowLibraryEntry | undefined {
  return WORKFLOW_LIBRARY.find((entry) => entry.slug === slug);
}

export function getRecommendedWorkflow(): WorkflowLibraryEntry {
  return WORKFLOW_LIBRARY.find((entry) => entry.recommended) ?? WORKFLOW_LIBRARY[0]!;
}
