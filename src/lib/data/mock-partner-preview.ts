// Mock data for Partner Workspace
// UI-only prototype — replace with API calls when partner program ships

export type PaymentStatus = 'Active' | 'Attention Needed' | 'Setup Incomplete' | 'Paused';
export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AttentionSeverity = 'Critical' | 'High' | 'Medium' | 'Healthy';
export type AccountingPlatformType = 'Xero' | 'QuickBooks' | 'MYOB' | 'None';
export type AccountingConnectionStatus =
  | 'Connected'
  | 'Expired'
  | 'Missing'
  | 'Needs Reconnect';
export type OperationalHealthCategory =
  | 'healthy'
  | 'needs_attention'
  | 'critical'
  | 'disconnected'
  | 'pending_approval'
  | 'pending_settlement';
export type RecommendationCategory =
  | 'Revenue'
  | 'Automation'
  | 'Marketing'
  | 'Accounting'
  | 'Risk';
export type RiskLabel = 'Healthy' | 'Attention' | 'High Risk';
export type PriorityUrgency = 'critical' | 'warning' | 'success';
export type PortfolioFilterChip =
  | 'all'
  | 'needs_attention'
  | 'accounting'
  | 'settlement'
  | 'payments'
  | 'marketing'
  | 'ai_opportunity'
  | 'high_risk';
export type ActivityType =
  | 'invoice_paid'
  | 'settlement_completed'
  | 'settlement_released'
  | 'xero_synced'
  | 'agreement_uploaded'
  | 'payment_failed'
  | 'invoice_viewed'
  | 'reminder_sent';

export type OnboardingStageKey =
  | 'business_created'
  | 'agreement_prepared'
  | 'accounting_connected'
  | 'payments_enabled'
  | 'settlement_ready'
  | 'live';

export interface OnboardingStage {
  key: OnboardingStageKey;
  label: string;
  completed: boolean;
  remaining?: string;
}

export interface OnboardingProgress {
  percent: number;
  stages: OnboardingStage[];
}

export interface PartnerRevenueMetrics {
  totalClientBusinesses: number;
  monthlyPaymentVolume: number;
  estimatedPartnerRevenue: number;
  businessesReadyToBill: number;
  businessesNeedingAttention: number;
  invoicesAwaitingReconciliation: number;
  connectedAccountingPlatforms: number;
  growthThisMonthPercent: number;
}

export interface ClientBusiness {
  id: string;
  name: string;
  industry: string;
  paymentStatus: PaymentStatus;
  outstandingInvoices: number;
  outstandingAmount: number;
  lastActivity: string;
  accountingPlatform: AccountingPlatformType;
  accountingConnectionStatus: AccountingConnectionStatus;
  healthScore: number;
  healthTier: 'healthy' | 'attention' | 'critical' | 'setup';
  operationalHealthTags: OperationalHealthCategory[];
  paymentRailNames: string[];
  onboardingProgress: OnboardingProgress;
  overview: {
    contactName: string;
    location: string;
    onboardedAt: string;
    monthlyVolume: number;
    activeInvoices: number;
  };
  paymentHealth: {
    successRate: number;
    failedPayments30d: number;
    avgSettlementDays: number;
    status: 'Good' | 'Fair' | 'Poor';
  };
  revenueSummary: {
    monthlyRevenue: number;
    ytdRevenue: number;
    outstandingReceivables: number;
    partnerFeeEstimate: number;
  };
  settlementStatus: {
    pendingAmount: number;
    lastSettlement: string;
    nextSettlement: string;
    status: 'On schedule' | 'Delayed' | 'Not configured';
  };
  recentInvoices: Array<{
    id: string;
    reference: string;
    amount: number;
    status: 'Paid' | 'Outstanding' | 'Overdue' | 'Draft';
    dueDate: string;
  }>;
  outstandingBalances: Array<{
    label: string;
    amount: number;
    currency: string;
  }>;
  paymentRails: Array<{
    rail: string;
    status: 'Connected' | 'Disconnected' | 'Pending' | 'Not configured';
  }>;
  accountingStatus: {
    platform: AccountingPlatformType;
    connection: AccountingConnectionStatus;
    lastSync: string;
    unreconciledCount: number;
  };
  agreementAnalyzerSummary: {
    agreementsReviewed: number;
    openIssues: number;
    lastReview: string;
    summary: string;
  };
  workspaceActivity: Array<{
    id: string;
    type: ActivityType;
    title: string;
    timestamp: string;
  }>;
  recommendedActions: string[];
  logoInitials: string;
  logoColor: string;
  lastPayment: { amount: number; date: string; reference: string };
  aiSummary: string;
  riskScore: number;
  riskLabel: RiskLabel;
  portfolioTags: Exclude<PortfolioFilterChip, 'all'>[];
  searchableTerms: string[];
}

export interface BusinessAttentionRow {
  id: string;
  businessId: string;
  business: string;
  issue: string;
  severity: AttentionSeverity;
  recommendedAction: string;
}

export interface AiRecommendation {
  id: string;
  title: string;
  description: string;
  category: RecommendationCategory;
  ctaLabel: string;
  impact?: string;
}

export interface ClientPipelineStage {
  stage: string;
  count: number;
}

export interface OperationalHealthMetrics {
  healthyBusinesses: number;
  needsAttention: number;
  criticalIssues: number;
  disconnectedIntegrations: number;
  outstandingApprovals: number;
  pendingSettlements: number;
}

export interface PartnerGrowthOpportunity {
  id: string;
  description: string;
  businessCount: number;
}

export interface RecentActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  businessId: string;
  businessName: string;
  timestamp: string;
}

export interface GroupedActivity {
  businessId: string;
  businessName: string;
  activities: RecentActivityItem[];
}

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface MonthlyVolumePoint {
  month: string;
  volume: number;
}

export interface WorkspaceNavItem {
  id: string;
  label: string;
  icon: string;
}

export const ONBOARDING_STAGE_LABELS: Record<OnboardingStageKey, string> = {
  business_created: 'Business Created',
  agreement_prepared: 'Agreement Prepared',
  accounting_connected: 'Accounting Connected',
  payments_enabled: 'Payments Enabled',
  settlement_ready: 'Settlement Ready',
  live: 'Live',
};

export const workspaceNavItems: WorkspaceNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { id: 'invoices', label: 'Invoices', icon: 'FileText' },
  { id: 'agreements', label: 'Agreements', icon: 'FileCheck' },
  { id: 'funding', label: 'Funding', icon: 'CircleDollarSign' },
  { id: 'settlement', label: 'Settlement', icon: 'Banknote' },
  { id: 'reporting', label: 'Reporting', icon: 'BarChart3' },
  { id: 'marketing', label: 'Marketing', icon: 'Megaphone' },
  { id: 'settings', label: 'Settings', icon: 'Settings' },
];

export interface TodaysPriority {
  id: string;
  businessId?: string;
  label: string;
  urgency: PriorityUrgency;
  ctaLabel: string;
}

export interface PortfolioValueSummary {
  totalPortfolioRevenue: number;
  annualProcessingVolume: number;
  moneySettledThisMonth: number;
  outstandingReceivables: number;
  businessesConnected: number;
}

export interface NotificationItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  businessName: string;
  timestamp: string;
}

export interface AiPortfolioInsight {
  id: string;
  text: string;
  trend?: 'up' | 'down' | 'neutral';
}

export interface ComingSoonIntegration {
  id: string;
  title: string;
  description: string;
}

export const portfolioValueSummary: PortfolioValueSummary = {
  totalPortfolioRevenue: 3417000,
  annualProcessingVolume: 3417000,
  moneySettledThisMonth: 243900,
  outstandingReceivables: 133400,
  businessesConnected: 5,
};

export const todaysPriorities: TodaysPriority[] = [
  {
    id: 'tp-1',
    businessId: 'rabbit-hole',
    label: 'Reconnect Xero for Rabbit Hole',
    urgency: 'critical',
    ctaLabel: 'Reconnect',
  },
  {
    id: 'tp-2',
    label: '3 failed settlements require review',
    urgency: 'critical',
    ctaLabel: 'Review settlements',
  },
  {
    id: 'tp-3',
    businessId: 'bears-r-us',
    label: 'Bears R Us has overdue invoices',
    urgency: 'warning',
    ctaLabel: 'Send reminders',
  },
  {
    id: 'tp-4',
    businessId: 'thirsty-turtl',
    label: 'Thirsty Turtl needs payout details',
    urgency: 'warning',
    ctaLabel: 'Complete setup',
  },
  {
    id: 'tp-5',
    businessId: 'coastal-construction',
    label: 'Coastal Construction missing accounting connection',
    urgency: 'warning',
    ctaLabel: 'Connect platform',
  },
  {
    id: 'tp-6',
    businessId: 'finns-beach-club',
    label: 'Finns Beach Club fully reconciled',
    urgency: 'success',
    ctaLabel: 'View report',
  },
  {
    id: 'tp-7',
    businessId: 'bali-wellness-studio',
    label: 'Bali Wellness Studio — quarterly review due',
    urgency: 'success',
    ctaLabel: 'Schedule review',
  },
  {
    id: 'tp-8',
    label: '5 invoices awaiting reconciliation across portfolio',
    urgency: 'warning',
    ctaLabel: 'Open reconciliation',
  },
];

export const aiPortfolioInsights: AiPortfolioInsight[] = [
  {
    id: 'insight-1',
    text: 'Revenue increased 14% this month across your portfolio.',
    trend: 'up',
  },
  {
    id: 'insight-2',
    text: 'Hospitality businesses are collecting payments 2.8× faster than retail.',
    trend: 'up',
  },
  {
    id: 'insight-3',
    text: 'Two businesses are likely to miss reconciliation this week.',
    trend: 'neutral',
  },
  {
    id: 'insight-4',
    text: 'Construction clients are using manual payouts more than average.',
    trend: 'down',
  },
];

export const portfolioFilterChips: Array<{ id: PortfolioFilterChip; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'needs_attention', label: 'Needs Attention' },
  { id: 'accounting', label: 'Accounting' },
  { id: 'settlement', label: 'Settlement' },
  { id: 'payments', label: 'Payments' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'ai_opportunity', label: 'AI Opportunities' },
  { id: 'high_risk', label: 'High Risk' },
];

export const comingSoonIntegrations: ComingSoonIntegration[] = [
  { id: 'payroll', title: 'Payroll', description: 'Run payroll across client businesses from one workspace.' },
  { id: 'bas', title: 'BAS Lodgements', description: 'Prepare and lodge BAS statements for Australian clients.' },
  { id: 'tax', title: 'Tax Returns', description: 'Coordinate tax return workflows across your portfolio.' },
  { id: 'ato', title: 'ATO Integrations', description: 'Direct connection to Australian Tax Office systems.' },
  { id: 'vault', title: 'Document Vault', description: 'Secure document storage per client business.' },
  { id: 'workflow', title: 'Workflow Automation', description: 'Build custom automations across client operations.' },
  { id: 'compliance', title: 'AI Compliance Assistant', description: 'Proactive compliance monitoring and alerts.' },
];

export const notificationFeed: NotificationItem[] = [
  { id: 'n-1', type: 'invoice_paid', title: 'Invoice paid', description: 'BRU-1039 — $2,400', businessName: 'Bears R Us', timestamp: '2026-07-06T14:22:00Z' },
  { id: 'n-2', type: 'settlement_completed', title: 'Settlement completed', description: '$15,200 USD disbursed', businessName: 'Finns Beach Club', timestamp: '2026-07-06T11:45:00Z' },
  { id: 'n-3', type: 'agreement_uploaded', title: 'Agreement uploaded', description: 'Venue lease amendment', businessName: 'Rabbit Hole', timestamp: '2026-07-06T09:30:00Z' },
  { id: 'n-4', type: 'invoice_viewed', title: 'Customer viewed invoice', description: 'BWS-112 opened twice', businessName: 'Bali Wellness Studio', timestamp: '2026-07-06T06:20:00Z' },
  { id: 'n-5', type: 'xero_synced', title: 'Xero sync finished', description: '12 invoices imported', businessName: 'Thirsty Turtl', timestamp: '2026-07-06T07:30:00Z' },
  { id: 'n-6', type: 'reminder_sent', title: 'Reminder sent', description: 'RH-8821 overdue notice', businessName: 'Rabbit Hole', timestamp: '2026-07-06T05:15:00Z' },
  { id: 'n-7', type: 'payment_failed', title: 'Payment failed', description: 'CC-9001 declined', businessName: 'Coastal Construction', timestamp: '2026-07-05T16:00:00Z' },
  { id: 'n-8', type: 'settlement_released', title: 'Settlement released', description: '$3,200 AUD', businessName: 'Bears R Us', timestamp: '2026-07-05T10:00:00Z' },
];

export const partnerRevenueMetrics: PartnerRevenueMetrics = {
  totalClientBusinesses: 6,
  monthlyPaymentVolume: 284750,
  estimatedPartnerRevenue: 8542,
  businessesReadyToBill: 4,
  businessesNeedingAttention: 3,
  invoicesAwaitingReconciliation: 17,
  connectedAccountingPlatforms: 5,
  growthThisMonthPercent: 6.4,
};

export const operationalHealthMetrics: OperationalHealthMetrics = {
  healthyBusinesses: 2,
  needsAttention: 3,
  criticalIssues: 2,
  disconnectedIntegrations: 3,
  outstandingApprovals: 4,
  pendingSettlements: 2,
};

export const businessesRequiringAttention: BusinessAttentionRow[] = [
  {
    id: 'att-1',
    businessId: 'bears-r-us',
    business: 'Bears R Us',
    issue: '3 invoices failed to sync',
    severity: 'High',
    recommendedAction: 'Review accounting sync',
  },
  {
    id: 'att-2',
    businessId: 'rabbit-hole',
    business: 'Rabbit Hole',
    issue: 'Xero token expired',
    severity: 'Critical',
    recommendedAction: 'Reconnect Xero',
  },
  {
    id: 'att-3',
    businessId: 'thirsty-turtl',
    business: 'Thirsty Turtl',
    issue: 'Settlement account incomplete',
    severity: 'Medium',
    recommendedAction: 'Complete onboarding',
  },
  {
    id: 'att-4',
    businessId: 'finns-beach-club',
    business: 'Finns Beach Club',
    issue: 'Healthy',
    severity: 'Healthy',
    recommendedAction: 'No action required',
  },
];

export const aiRecommendations: AiRecommendation[] = [
  {
    id: 'ai-1',
    title: 'Recover $18,200 in overdue invoices',
    description: '4 clients have invoices 30+ days overdue. Automated reminders could recover 68% within 14 days.',
    category: 'Revenue',
    ctaLabel: 'Send reminders',
    impact: '+$18,200 potential',
  },
  {
    id: 'ai-2',
    title: '4 businesses should connect Xero',
    description: 'Manual bookkeeping is costing ~6 hours/week. Xero integration would automate invoice sync.',
    category: 'Accounting',
    ctaLabel: 'Start connections',
  },
  {
    id: 'ai-3',
    title: '6 businesses could automate settlements',
    description: 'Recurring settlement schedules would reduce manual payout processing by 80%.',
    category: 'Automation',
    ctaLabel: 'Configure automation',
  },
  {
    id: 'ai-4',
    title: 'Generate LinkedIn content for hospitality clients',
    description: 'Finns Beach Club and Rabbit Hole have strong payment stories — ideal for case study posts.',
    category: 'Marketing',
    ctaLabel: 'Generate content',
  },
  {
    id: 'ai-5',
    title: 'Upload agreements for 3 businesses',
    description: 'Coastal Construction, Thirsty Turtl, and Bali Wellness Studio have unsigned vendor agreements.',
    category: 'Risk',
    ctaLabel: 'Review agreements',
  },
  {
    id: 'ai-6',
    title: 'Review payout configuration for 2 businesses',
    description: 'Settlement rails are incomplete for Coastal Construction and Thirsty Turtl.',
    category: 'Risk',
    ctaLabel: 'Fix payouts',
  },
];

export const clientPipelineStages: ClientPipelineStage[] = [
  { stage: 'Lead', count: 8 },
  { stage: 'Meeting Scheduled', count: 5 },
  { stage: 'Proposal', count: 3 },
  { stage: 'Onboarding', count: 4 },
  { stage: 'Active', count: 6 },
  { stage: 'Expansion', count: 2 },
];

export const partnerGrowthOpportunities: PartnerGrowthOpportunity[] = [
  { id: 'g-1', description: '12 businesses could automate payments', businessCount: 12 },
  { id: 'g-2', description: '8 businesses still invoice manually', businessCount: 8 },
  { id: 'g-3', description: '5 businesses should enable recurring invoices', businessCount: 5 },
  { id: 'g-4', description: '3 businesses should activate AI Agreement Analyzer', businessCount: 3 },
];

export const estimatedAdditionalMonthlyRevenue = 2430;

function buildStages(completedCount: number, remaining?: string): OnboardingStage[] {
  const keys: OnboardingStageKey[] = [
    'business_created',
    'agreement_prepared',
    'accounting_connected',
    'payments_enabled',
    'settlement_ready',
    'live',
  ];
  return keys.map((key, i) => ({
    key,
    label: ONBOARDING_STAGE_LABELS[key],
    completed: i < completedCount,
    remaining: i === completedCount && remaining ? remaining : undefined,
  }));
}

export const clientBusinesses: ClientBusiness[] = [
  {
    id: 'bears-r-us',
    name: 'Bears R Us',
    industry: 'Retail & Gifts',
    paymentStatus: 'Active',
    outstandingInvoices: 2,
    outstandingAmount: 4850,
    lastActivity: '2026-07-05T14:22:00Z',
    accountingPlatform: 'Xero',
    accountingConnectionStatus: 'Connected',
    healthScore: 92,
    healthTier: 'healthy',
    operationalHealthTags: ['healthy', 'pending_settlement'],
    paymentRailNames: ['Bank transfer', 'Stripe', 'Wise'],
    onboardingProgress: { percent: 100, stages: buildStages(6) },
    overview: {
      contactName: 'Sarah Chen',
      location: 'Melbourne, AU',
      onboardedAt: '2025-03-12',
      monthlyVolume: 48200,
      activeInvoices: 8,
    },
    paymentHealth: { successRate: 97, failedPayments30d: 1, avgSettlementDays: 2, status: 'Good' },
    revenueSummary: {
      monthlyRevenue: 48200,
      ytdRevenue: 278400,
      outstandingReceivables: 4850,
      partnerFeeEstimate: 1446,
    },
    settlementStatus: {
      pendingAmount: 3200,
      lastSettlement: '2026-07-03',
      nextSettlement: '2026-07-10',
      status: 'On schedule',
    },
    recentInvoices: [
      { id: 'inv-001', reference: 'BRU-1042', amount: 2450, status: 'Outstanding', dueDate: '2026-07-15' },
      { id: 'inv-002', reference: 'BRU-1039', amount: 2400, status: 'Paid', dueDate: '2026-06-28' },
      { id: 'inv-003', reference: 'BRU-1035', amount: 1890, status: 'Paid', dueDate: '2026-06-20' },
    ],
    outstandingBalances: [
      { label: 'Trade receivables', amount: 4850, currency: 'AUD' },
      { label: 'Pending settlement', amount: 3200, currency: 'AUD' },
    ],
    paymentRails: [
      { rail: 'Bank transfer', status: 'Connected' },
      { rail: 'Stripe', status: 'Connected' },
      { rail: 'Wise', status: 'Connected' },
    ],
    accountingStatus: {
      platform: 'Xero',
      connection: 'Connected',
      lastSync: '2026-07-05T09:15:00Z',
      unreconciledCount: 3,
    },
    agreementAnalyzerSummary: {
      agreementsReviewed: 4,
      openIssues: 0,
      lastReview: '2026-06-18',
      summary: 'Supplier agreements aligned with current payment terms.',
    },
    workspaceActivity: [
      { id: 'wa-1', type: 'invoice_paid', title: 'Invoice Paid', timestamp: '2026-07-05T14:22:00Z' },
      { id: 'wa-2', type: 'settlement_released', title: 'Settlement Released', timestamp: '2026-07-04T10:00:00Z' },
      { id: 'wa-3', type: 'xero_synced', title: 'Xero Synced', timestamp: '2026-07-05T09:15:00Z' },
    ],
    recommendedActions: ['Review accounting sync for 3 failed invoices', 'Send payment reminder for BRU-1042'],
    logoInitials: 'BR',
    logoColor: 'bg-amber-600',
    lastPayment: { amount: 2400, date: '2026-06-28', reference: 'BRU-1039' },
    aiSummary: 'Stable retail client with minor sync issues. Revenue trending up 8% QoQ.',
    riskScore: 78,
    riskLabel: 'Attention',
    portfolioTags: ['accounting', 'payments'],
    searchableTerms: ['bears r us', 'sarah chen', 'bru-1042', 'bru-1039', 'retail', 'supplier agreement'],
  },
  {
    id: 'rabbit-hole',
    name: 'Rabbit Hole',
    industry: 'Hospitality',
    paymentStatus: 'Attention Needed',
    outstandingInvoices: 5,
    outstandingAmount: 12400,
    lastActivity: '2026-07-04T11:08:00Z',
    accountingPlatform: 'Xero',
    accountingConnectionStatus: 'Expired',
    healthScore: 68,
    healthTier: 'attention',
    operationalHealthTags: ['needs_attention', 'critical', 'disconnected', 'pending_approval'],
    paymentRailNames: ['Bank transfer', 'Stripe', 'MetaMask'],
    onboardingProgress: {
      percent: 65,
      stages: buildStages(4, 'Reconnect Xero and configure MetaMask wallet'),
    },
    overview: {
      contactName: 'James Okonkwo',
      location: 'Sydney, AU',
      onboardedAt: '2024-11-02',
      monthlyVolume: 67800,
      activeInvoices: 14,
    },
    paymentHealth: { successRate: 82, failedPayments30d: 4, avgSettlementDays: 4, status: 'Fair' },
    revenueSummary: {
      monthlyRevenue: 67800,
      ytdRevenue: 392400,
      outstandingReceivables: 12400,
      partnerFeeEstimate: 2034,
    },
    settlementStatus: {
      pendingAmount: 8400,
      lastSettlement: '2026-06-28',
      nextSettlement: '2026-07-11',
      status: 'Delayed',
    },
    recentInvoices: [
      { id: 'inv-101', reference: 'RH-8821', amount: 4200, status: 'Overdue', dueDate: '2026-06-25' },
      { id: 'inv-102', reference: 'RH-8815', amount: 3100, status: 'Outstanding', dueDate: '2026-07-10' },
      { id: 'inv-103', reference: 'RH-8809', amount: 5100, status: 'Outstanding', dueDate: '2026-07-12' },
    ],
    outstandingBalances: [
      { label: 'Trade receivables', amount: 12400, currency: 'AUD' },
      { label: 'Overdue invoices', amount: 4200, currency: 'AUD' },
    ],
    paymentRails: [
      { rail: 'Bank transfer', status: 'Connected' },
      { rail: 'Stripe', status: 'Connected' },
      { rail: 'MetaMask', status: 'Not configured' },
    ],
    accountingStatus: {
      platform: 'Xero',
      connection: 'Expired',
      lastSync: '2026-06-28T16:40:00Z',
      unreconciledCount: 5,
    },
    agreementAnalyzerSummary: {
      agreementsReviewed: 6,
      openIssues: 2,
      lastReview: '2026-07-01',
      summary: 'Revenue share clause in venue lease may conflict with partner payout schedule.',
    },
    workspaceActivity: [
      { id: 'wa-4', type: 'agreement_uploaded', title: 'Agreement Uploaded', timestamp: '2026-07-03T15:00:00Z' },
      { id: 'wa-5', type: 'payment_failed', title: 'Payment Failed', timestamp: '2026-07-04T09:18:00Z' },
      { id: 'wa-6', type: 'reminder_sent', title: 'Reminder Sent', timestamp: '2026-07-04T11:08:00Z' },
    ],
    recommendedActions: [
      'Reconnect Xero integration',
      'Configure MetaMask wallet for crypto settlements',
      'Reconcile 5 outstanding invoices',
    ],
    logoInitials: 'RH',
    logoColor: 'bg-violet-600',
    lastPayment: { amount: 3100, date: '2026-06-15', reference: 'RH-8810' },
    aiSummary: 'High-value hospitality client with expired Xero token and overdue receivables.',
    riskScore: 43,
    riskLabel: 'High Risk',
    portfolioTags: ['needs_attention', 'accounting', 'settlement', 'payments', 'high_risk', 'ai_opportunity'],
    searchableTerms: ['rabbit hole', 'rabbit', 'james okonkwo', 'rh-8821', 'venue lease', 'participant james'],
  },
  {
    id: 'thirsty-turtl',
    name: 'Thirsty Turtl',
    industry: 'Food & Beverage',
    paymentStatus: 'Active',
    outstandingInvoices: 3,
    outstandingAmount: 6200,
    lastActivity: '2026-07-06T08:45:00Z',
    accountingPlatform: 'MYOB',
    accountingConnectionStatus: 'Connected',
    healthScore: 85,
    healthTier: 'attention',
    operationalHealthTags: ['needs_attention', 'pending_settlement'],
    paymentRailNames: ['Bank transfer', 'PayPal'],
    onboardingProgress: {
      percent: 80,
      stages: buildStages(5, 'Complete settlement account setup'),
    },
    overview: {
      contactName: 'Liam Patel',
      location: 'Brisbane, AU',
      onboardedAt: '2025-01-20',
      monthlyVolume: 35400,
      activeInvoices: 6,
    },
    paymentHealth: { successRate: 94, failedPayments30d: 0, avgSettlementDays: 3, status: 'Good' },
    revenueSummary: {
      monthlyRevenue: 35400,
      ytdRevenue: 204800,
      outstandingReceivables: 6200,
      partnerFeeEstimate: 1062,
    },
    settlementStatus: {
      pendingAmount: 4100,
      lastSettlement: '2026-07-01',
      nextSettlement: '2026-07-08',
      status: 'On schedule',
    },
    recentInvoices: [
      { id: 'inv-201', reference: 'TT-441', amount: 2100, status: 'Outstanding', dueDate: '2026-07-18' },
      { id: 'inv-202', reference: 'TT-438', amount: 1800, status: 'Paid', dueDate: '2026-06-30' },
      { id: 'inv-203', reference: 'TT-435', amount: 2300, status: 'Outstanding', dueDate: '2026-07-20' },
    ],
    outstandingBalances: [{ label: 'Trade receivables', amount: 6200, currency: 'AUD' }],
    paymentRails: [
      { rail: 'Bank transfer', status: 'Connected' },
      { rail: 'PayPal', status: 'Connected' },
    ],
    accountingStatus: {
      platform: 'MYOB',
      connection: 'Connected',
      lastSync: '2026-07-06T07:30:00Z',
      unreconciledCount: 1,
    },
    agreementAnalyzerSummary: {
      agreementsReviewed: 2,
      openIssues: 0,
      lastReview: '2026-05-14',
      summary: 'Franchise fee structure documented. Payment terms consistent.',
    },
    workspaceActivity: [
      { id: 'wa-7', type: 'xero_synced', title: 'Accounting Synced', timestamp: '2026-07-06T07:30:00Z' },
      { id: 'wa-8', type: 'invoice_paid', title: 'Invoice Paid', timestamp: '2026-06-30T16:00:00Z' },
    ],
    recommendedActions: ['Complete settlement account onboarding', 'Follow up on TT-441'],
    logoInitials: 'TT',
    logoColor: 'bg-teal-600',
    lastPayment: { amount: 1800, date: '2026-06-30', reference: 'TT-438' },
    aiSummary: 'Growing F&B business. Settlement onboarding incomplete but payments healthy.',
    riskScore: 71,
    riskLabel: 'Attention',
    portfolioTags: ['needs_attention', 'settlement', 'payments'],
    searchableTerms: ['thirsty turtl', 'turtl', 'liam patel', 'tt-441', 'franchise agreement'],
  },
  {
    id: 'finns-beach-club',
    name: 'Finns Beach Club',
    industry: 'Hospitality & Events',
    paymentStatus: 'Active',
    outstandingInvoices: 4,
    outstandingAmount: 28750,
    lastActivity: '2026-07-03T19:12:00Z',
    accountingPlatform: 'Xero',
    accountingConnectionStatus: 'Needs Reconnect',
    healthScore: 88,
    healthTier: 'healthy',
    operationalHealthTags: ['healthy', 'disconnected', 'pending_settlement'],
    paymentRailNames: ['Bank transfer', 'Wise', 'Stripe'],
    onboardingProgress: { percent: 100, stages: buildStages(6) },
    overview: {
      contactName: 'Made Wardana',
      location: 'Bali, ID',
      onboardedAt: '2024-08-15',
      monthlyVolume: 95600,
      activeInvoices: 22,
    },
    paymentHealth: { successRate: 96, failedPayments30d: 1, avgSettlementDays: 3, status: 'Good' },
    revenueSummary: {
      monthlyRevenue: 95600,
      ytdRevenue: 552000,
      outstandingReceivables: 28750,
      partnerFeeEstimate: 2868,
    },
    settlementStatus: {
      pendingAmount: 15200,
      lastSettlement: '2026-07-02',
      nextSettlement: '2026-07-09',
      status: 'On schedule',
    },
    recentInvoices: [
      { id: 'inv-301', reference: 'FBC-2201', amount: 8500, status: 'Overdue', dueDate: '2026-06-20' },
      { id: 'inv-302', reference: 'FBC-2198', amount: 7200, status: 'Outstanding', dueDate: '2026-07-08' },
      { id: 'inv-303', reference: 'FBC-2195', amount: 6050, status: 'Outstanding', dueDate: '2026-07-14' },
    ],
    outstandingBalances: [
      { label: 'Trade receivables', amount: 28750, currency: 'USD' },
      { label: 'Awaiting settlement', amount: 15200, currency: 'USD' },
    ],
    paymentRails: [
      { rail: 'Bank transfer', status: 'Connected' },
      { rail: 'Wise', status: 'Disconnected' },
      { rail: 'Stripe', status: 'Connected' },
    ],
    accountingStatus: {
      platform: 'Xero',
      connection: 'Needs Reconnect',
      lastSync: '2026-07-03T12:00:00Z',
      unreconciledCount: 3,
    },
    agreementAnalyzerSummary: {
      agreementsReviewed: 8,
      openIssues: 1,
      lastReview: '2026-06-25',
      summary: 'Event vendor agreement missing force-majeure payment clause.',
    },
    workspaceActivity: [
      { id: 'wa-9', type: 'settlement_completed', title: 'Settlement Completed', timestamp: '2026-07-05T11:45:00Z' },
      { id: 'wa-10', type: 'invoice_paid', title: 'Invoice Paid', timestamp: '2026-07-02T14:00:00Z' },
    ],
    recommendedActions: ['Reconnect Wise account for IDR payouts'],
    logoInitials: 'FB',
    logoColor: 'bg-orange-500',
    lastPayment: { amount: 7200, date: '2026-07-02', reference: 'FBC-2198' },
    aiSummary: 'Top revenue client. Fully reconciled with minor Wise reconnection needed.',
    riskScore: 92,
    riskLabel: 'Healthy',
    portfolioTags: ['settlement', 'marketing', 'ai_opportunity'],
    searchableTerms: ['finns beach club', 'finns', 'made wardana', 'fbc-2201', 'event vendor agreement'],
  },
  {
    id: 'bali-wellness-studio',
    name: 'Bali Wellness Studio',
    industry: 'Health & Wellness',
    paymentStatus: 'Active',
    outstandingInvoices: 1,
    outstandingAmount: 1800,
    lastActivity: '2026-07-06T06:20:00Z',
    accountingPlatform: 'QuickBooks',
    accountingConnectionStatus: 'Connected',
    healthScore: 94,
    healthTier: 'healthy',
    operationalHealthTags: ['healthy'],
    paymentRailNames: ['Bank transfer', 'Stripe'],
    onboardingProgress: { percent: 100, stages: buildStages(6) },
    overview: {
      contactName: 'Anita Dewi',
      location: 'Ubud, ID',
      onboardedAt: '2025-06-01',
      monthlyVolume: 22100,
      activeInvoices: 4,
    },
    paymentHealth: { successRate: 99, failedPayments30d: 0, avgSettlementDays: 2, status: 'Good' },
    revenueSummary: {
      monthlyRevenue: 22100,
      ytdRevenue: 44200,
      outstandingReceivables: 1800,
      partnerFeeEstimate: 663,
    },
    settlementStatus: {
      pendingAmount: 0,
      lastSettlement: '2026-07-05',
      nextSettlement: '2026-07-12',
      status: 'On schedule',
    },
    recentInvoices: [
      { id: 'inv-401', reference: 'BWS-112', amount: 1800, status: 'Outstanding', dueDate: '2026-07-22' },
      { id: 'inv-402', reference: 'BWS-109', amount: 950, status: 'Paid', dueDate: '2026-06-15' },
    ],
    outstandingBalances: [{ label: 'Trade receivables', amount: 1800, currency: 'IDR' }],
    paymentRails: [
      { rail: 'Bank transfer', status: 'Connected' },
      { rail: 'Stripe', status: 'Connected' },
    ],
    accountingStatus: {
      platform: 'QuickBooks',
      connection: 'Connected',
      lastSync: '2026-07-06T05:45:00Z',
      unreconciledCount: 0,
    },
    agreementAnalyzerSummary: {
      agreementsReviewed: 3,
      openIssues: 0,
      lastReview: '2026-06-10',
      summary: 'Membership and instructor agreements reviewed. All payment clauses standard.',
    },
    workspaceActivity: [
      { id: 'wa-11', type: 'invoice_viewed', title: 'Customer Viewed Invoice', timestamp: '2026-07-06T06:20:00Z' },
    ],
    recommendedActions: ['Schedule quarterly compliance review'],
    logoInitials: 'BW',
    logoColor: 'bg-emerald-600',
    lastPayment: { amount: 950, date: '2026-06-15', reference: 'BWS-109' },
    aiSummary: 'Low-risk wellness studio. All systems connected and reconciled.',
    riskScore: 94,
    riskLabel: 'Healthy',
    portfolioTags: ['marketing'],
    searchableTerms: ['bali wellness', 'anita dewi', 'bws-112', 'membership agreement', 'instructor'],
  },
  {
    id: 'coastal-construction',
    name: 'Coastal Construction',
    industry: 'Construction',
    paymentStatus: 'Setup Incomplete',
    outstandingInvoices: 8,
    outstandingAmount: 68400,
    lastActivity: '2026-07-01T10:00:00Z',
    accountingPlatform: 'None',
    accountingConnectionStatus: 'Missing',
    healthScore: 42,
    healthTier: 'critical',
    operationalHealthTags: ['critical', 'disconnected', 'pending_approval', 'pending_settlement'],
    paymentRailNames: ['Bank transfer'],
    onboardingProgress: {
      percent: 20,
      stages: buildStages(1, 'Connect accounting, configure payouts, upload agreements'),
    },
    overview: {
      contactName: 'Tom Richardson',
      location: 'Gold Coast, AU',
      onboardedAt: '2026-05-28',
      monthlyVolume: 112000,
      activeInvoices: 8,
    },
    paymentHealth: { successRate: 71, failedPayments30d: 3, avgSettlementDays: 0, status: 'Poor' },
    revenueSummary: {
      monthlyRevenue: 112000,
      ytdRevenue: 224000,
      outstandingReceivables: 68400,
      partnerFeeEstimate: 3360,
    },
    settlementStatus: {
      pendingAmount: 46000,
      lastSettlement: '—',
      nextSettlement: '—',
      status: 'Not configured',
    },
    recentInvoices: [
      { id: 'inv-501', reference: 'CC-9001', amount: 28500, status: 'Outstanding', dueDate: '2026-07-05' },
      { id: 'inv-502', reference: 'CC-8998', amount: 22400, status: 'Draft', dueDate: '2026-07-20' },
      { id: 'inv-503', reference: 'CC-8995', amount: 17500, status: 'Outstanding', dueDate: '2026-07-12' },
    ],
    outstandingBalances: [
      { label: 'Trade receivables', amount: 68400, currency: 'AUD' },
      { label: 'Progress claims unpaid', amount: 46000, currency: 'AUD' },
    ],
    paymentRails: [
      { rail: 'Bank transfer', status: 'Connected' },
      { rail: 'Payout account', status: 'Not configured' },
    ],
    accountingStatus: {
      platform: 'None',
      connection: 'Missing',
      lastSync: '—',
      unreconciledCount: 8,
    },
    agreementAnalyzerSummary: {
      agreementsReviewed: 1,
      openIssues: 3,
      lastReview: '2026-06-30',
      summary: 'Subcontractor agreements uploaded. Retention and milestone clauses need review.',
    },
    workspaceActivity: [
      { id: 'wa-12', type: 'agreement_uploaded', title: 'Agreement Uploaded', timestamp: '2026-07-01T10:00:00Z' },
    ],
    recommendedActions: [
      'Configure merchant payout account',
      'Connect accounting platform',
      'Complete Agreement Analyzer review',
    ],
    logoInitials: 'CC',
    logoColor: 'bg-slate-600',
    lastPayment: { amount: 0, date: '—', reference: '—' },
    aiSummary: 'New construction client with incomplete setup. High revenue potential once onboarded.',
    riskScore: 38,
    riskLabel: 'High Risk',
    portfolioTags: ['needs_attention', 'accounting', 'settlement', 'payments', 'high_risk', 'ai_opportunity'],
    searchableTerms: ['coastal construction', 'tom richardson', 'cc-9001', 'subcontractor agreement', 'progress claim'],
  },
];

export const recentActivity: RecentActivityItem[] = [
  {
    id: 'act-1',
    type: 'invoice_paid',
    title: 'Invoice Paid',
    description: 'BRU-1039 settled via bank transfer',
    businessId: 'bears-r-us',
    businessName: 'Bears R Us',
    timestamp: '2026-07-05T14:22:00Z',
  },
  {
    id: 'act-2',
    type: 'settlement_released',
    title: 'Settlement Released',
    description: '$3,200 AUD released to operating account',
    businessId: 'bears-r-us',
    businessName: 'Bears R Us',
    timestamp: '2026-07-04T10:00:00Z',
  },
  {
    id: 'act-3',
    type: 'xero_synced',
    title: 'Xero Synced',
    description: '8 payments imported',
    businessId: 'bears-r-us',
    businessName: 'Bears R Us',
    timestamp: '2026-07-05T09:15:00Z',
  },
  {
    id: 'act-4',
    type: 'agreement_uploaded',
    title: 'Agreement Uploaded',
    description: 'Venue lease amendment added to queue',
    businessId: 'rabbit-hole',
    businessName: 'Rabbit Hole',
    timestamp: '2026-07-03T15:00:00Z',
  },
  {
    id: 'act-5',
    type: 'payment_failed',
    title: 'Payment Failed',
    description: 'RH-8821 auto-debit declined',
    businessId: 'rabbit-hole',
    businessName: 'Rabbit Hole',
    timestamp: '2026-07-04T09:18:00Z',
  },
  {
    id: 'act-6',
    type: 'reminder_sent',
    title: 'Reminder Sent',
    description: 'Overdue invoice reminder sent to client',
    businessId: 'rabbit-hole',
    businessName: 'Rabbit Hole',
    timestamp: '2026-07-04T11:08:00Z',
  },
  {
    id: 'act-7',
    type: 'settlement_completed',
    title: 'Settlement Completed',
    description: '$15,200 USD disbursed',
    businessId: 'finns-beach-club',
    businessName: 'Finns Beach Club',
    timestamp: '2026-07-05T11:45:00Z',
  },
  {
    id: 'act-8',
    type: 'invoice_viewed',
    title: 'Customer Viewed Invoice',
    description: 'BWS-112 payment page viewed twice',
    businessId: 'bali-wellness-studio',
    businessName: 'Bali Wellness Studio',
    timestamp: '2026-07-06T06:20:00Z',
  },
];

export const monthlyPaymentVolume: MonthlyVolumePoint[] = [
  { month: 'Feb', volume: 198000 },
  { month: 'Mar', volume: 215400 },
  { month: 'Apr', volume: 231800 },
  { month: 'May', volume: 248200 },
  { month: 'Jun', volume: 267500 },
  { month: 'Jul', volume: 284750 },
];

export const clientRevenueDistribution: ChartDataPoint[] = [
  { label: 'Coastal Construction', value: 112000 },
  { label: 'Finns Beach Club', value: 95600 },
  { label: 'Rabbit Hole', value: 67800 },
  { label: 'Bears R Us', value: 48200 },
  { label: 'Thirsty Turtl', value: 35400 },
  { label: 'Bali Wellness Studio', value: 22100 },
];

export const paymentMethodBreakdown: ChartDataPoint[] = [
  { label: 'Bank transfer', value: 42 },
  { label: 'Card (Stripe)', value: 31 },
  { label: 'Wise', value: 14 },
  { label: 'PayPal', value: 8 },
  { label: 'Crypto', value: 5 },
];

export const outstandingReceivables: ChartDataPoint[] = [
  { label: 'Current', value: 28400 },
  { label: '1–30 days', value: 42100 },
  { label: '31–60 days', value: 31800 },
  { label: '61–90 days', value: 18600 },
  { label: '90+ days', value: 12400 },
];

export const industryFilterOptions = [
  'All industries',
  'Retail & Gifts',
  'Hospitality',
  'Food & Beverage',
  'Hospitality & Events',
  'Health & Wellness',
  'Construction',
] as const;

export const healthFilterOptions = [
  { value: 'all', label: 'All health' },
  { value: 'healthy', label: 'Healthy (80+)' },
  { value: 'attention', label: 'Needs attention' },
  { value: 'critical', label: 'Critical' },
  { value: 'setup', label: 'Setup incomplete' },
] as const;

export const accountingFilterOptions = [
  'All platforms',
  'Xero',
  'QuickBooks',
  'MYOB',
  'None',
] as const;

export const paymentRailFilterOptions = [
  'All rails',
  'Bank transfer',
  'Stripe',
  'Wise',
  'PayPal',
  'MetaMask',
] as const;

export const statusFilterOptions = [
  'All statuses',
  'Active',
  'Attention Needed',
  'Setup Incomplete',
] as const;

export type QuickActionId =
  | 'view_workspace'
  | 'agreement_report'
  | 'payment_reminder'
  | 'reconciliation'
  | 'create_invoice'
  | 'accounting_sync';

export const quickActions: Array<{ id: QuickActionId; label: string }> = [
  { id: 'view_workspace', label: 'View Client Workspace' },
  { id: 'agreement_report', label: 'Generate Agreement Report' },
  { id: 'payment_reminder', label: 'Send Payment Reminder' },
  { id: 'reconciliation', label: 'Open Reconciliation' },
  { id: 'create_invoice', label: 'Create Invoice' },
  { id: 'accounting_sync', label: 'View Accounting Sync' },
];

export function getClientBusinessById(id: string): ClientBusiness | undefined {
  return clientBusinesses.find((b) => b.id === id);
}

export function getGroupedRecentActivity(): GroupedActivity[] {
  const map = new Map<string, GroupedActivity>();
  for (const item of recentActivity) {
    const existing = map.get(item.businessId);
    if (existing) {
      existing.activities.push(item);
    } else {
      map.set(item.businessId, {
        businessId: item.businessId,
        businessName: item.businessName,
        activities: [item],
      });
    }
  }
  return Array.from(map.values());
}

export function filterClientBusinesses(
  businesses: ClientBusiness[],
  filters: {
    search: string;
    globalSearch: string;
    industry: string;
    health: string;
    accounting: string;
    paymentRail: string;
    status: string;
    operationalHealth: OperationalHealthCategory | null;
    portfolioChip: PortfolioFilterChip;
  }
): ClientBusiness[] {
  const globalIds =
    filters.globalSearch.trim().length > 0
      ? new Set(globalSearchBusinessIds(filters.globalSearch))
      : null;

  return businesses.filter((b) => {
    if (globalIds && !globalIds.has(b.id)) {
      return false;
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (
        !b.name.toLowerCase().includes(q) &&
        !b.industry.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    if (filters.portfolioChip !== 'all' && !b.portfolioTags.includes(filters.portfolioChip)) {
      return false;
    }
    if (filters.industry !== 'All industries' && b.industry !== filters.industry) {
      return false;
    }
    if (filters.health !== 'all' && b.healthTier !== filters.health) {
      return false;
    }
    if (
      filters.accounting !== 'All platforms' &&
      b.accountingPlatform !== filters.accounting
    ) {
      return false;
    }
    if (
      filters.paymentRail !== 'All rails' &&
      !b.paymentRailNames.includes(filters.paymentRail)
    ) {
      return false;
    }
    if (filters.status !== 'All statuses' && b.paymentStatus !== filters.status) {
      return false;
    }
    if (
      filters.operationalHealth &&
      !b.operationalHealthTags.includes(filters.operationalHealth)
    ) {
      return false;
    }
    return true;
  });
}

export function globalSearchBusinessIds(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return clientBusinesses.map((b) => b.id);

  return clientBusinesses
    .filter((b) => {
      if (b.name.toLowerCase().includes(q)) return true;
      if (b.overview.contactName.toLowerCase().includes(q)) return true;
      if (b.industry.toLowerCase().includes(q)) return true;
      if (b.searchableTerms.some((t) => t.includes(q))) return true;
      if (b.recentInvoices.some((inv) => inv.reference.toLowerCase().includes(q))) return true;
      if (b.agreementAnalyzerSummary.summary.toLowerCase().includes(q)) return true;
      return false;
    })
    .map((b) => b.id);
}

export function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
