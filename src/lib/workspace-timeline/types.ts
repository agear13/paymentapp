import type {
  AccountingLayer,
  CommercialLayer,
  SettlementLayer,
} from '@/lib/payments/payment-layers';
import type { BusinessFinancialSnapshot } from '@/lib/commercial/business-financial-snapshot';

/** Semantic timeline event type — extensible via registry. */
export type WorkspaceTimelineEventType =
  | 'project_start'
  | 'project_milestone'
  | 'expected_payment'
  | 'invoice_due'
  | 'invoice_paid'
  | 'metamask_payment'
  | 'stripe_payment'
  | 'settlement_pending'
  | 'settlement_completed'
  | 'participant_approval'
  | 'participant_accepted'
  | 'obligation_due'
  | 'budget_review'
  | 'commercial_risk'
  | 'cash_shortfall'
  | 'funding_connected'
  | 'accounting_synced'
  | 'operational_task';

export type TimelineLayer = 'commercial' | 'accounting' | 'settlement' | 'operational';

export type TimelineImportance = 'critical' | 'high' | 'medium' | 'low';

export type TimelineSourceEntity = {
  kind: string;
  id: string;
  label: string;
  href?: string | null;
};

export type TimelineLineageStep = {
  label: string;
  layer?: TimelineLayer;
};

export type TimelineExplanation = {
  whyThisMatters: string;
  recommendedAction: string | null;
  commercialConsequence: string | null;
  accountingConsequence: string | null;
  settlementConsequence: string | null;
};

export type WorkspaceTimelineEvent = {
  id: string;
  type: WorkspaceTimelineEventType;
  date: string;
  title: string;
  subtitle: string | null;
  projectId: string | null;
  projectName: string | null;
  participantId: string | null;
  participantName: string | null;
  sourceEntity: TimelineSourceEntity;
  status: string;
  importance: TimelineImportance;
  layer: TimelineLayer;
  currency: string | null;
  amount: number | null;
  direction: 'incoming' | 'outgoing' | 'neutral';
  metadata: Record<string, string | number | boolean | null>;
  lineage: TimelineLineageStep[];
  explanation: TimelineExplanation;
  commercialLayer: CommercialLayer | null;
  accountingLayer: AccountingLayer | null;
  settlementLayer: SettlementLayer | null;
  linkedEntities: TimelineSourceEntity[];
  actions: Array<{ label: string; href: string }>;
  tags: string[];
  /** Stable key for status progression — one event per entity. */
  entityKey: string;
};

export type TimelineViewMode = 'month' | 'week' | 'agenda';

export type TimelineFilters = {
  projectId: string | null;
  participantId: string | null;
  layer: TimelineLayer | 'all';
  type: WorkspaceTimelineEventType | 'all';
  currency: string | null;
  status: string | null;
  direction: 'incoming' | 'outgoing' | 'all';
  person: string | null;
  paymentProvider: string | null;
  search: string;
};

export const DEFAULT_TIMELINE_FILTERS: TimelineFilters = {
  projectId: null,
  participantId: null,
  layer: 'all',
  type: 'all',
  currency: null,
  status: null,
  direction: 'all',
  person: null,
  paymentProvider: null,
  search: '',
};

export type TimelineMonthSummary = {
  incomingExpected: number;
  incomingConfirmed: number;
  outgoing: number;
  forecastSurplus: number;
  currency: string;
  activeProjects: number;
  projectsAtRisk: number;
  settlementsWaiting: number;
  approvalsWaiting: number;
};

export type CashFlowForecastPoint = {
  date: string;
  balance: number;
  currency: string;
  isDeficit: boolean;
};

export type WorkspaceTimelineInput = {
  deals: Array<{
    id: string;
    dealName: string;
    projectValueCurrency?: 'AUD' | 'USD';
    commercialRoles?: import('@/lib/projects/commercial-roles/types').CommercialRole[];
    importedAt?: string;
    lastUpdated?: string;
  }>;
  participants: Array<{
    id: string;
    name: string;
    dealId?: string;
    payoutDueDate?: string;
    approvedAt?: string;
    approvalStatus?: string;
    role?: string;
  }>;
  paymentLinks: Array<{
    id: string;
    shortCode: string;
    status: string;
    amount: number;
    currency: string;
    invoiceCurrency?: string | null;
    commercialCurrency?: string | null;
    commercialAmount?: number | null;
    accountingCurrency?: string | null;
    accountingAmount?: number | null;
    settlementCurrency?: string | null;
    settlementAmount?: number | null;
    description: string;
    invoiceReference: string | null;
    customerName: string | null;
    dueDate: string | null;
    invoiceDate: string | null;
    paidAt?: string | null;
    createdAt: string;
    pilotDealId?: string | null;
    xeroInvoiceNumber?: string | null;
    paymentMethod?: string | null;
  }>;
  obligations: Array<{
    id: string;
    deal_id: string;
    obligation_type: string;
    status: string;
    amount_owed: number;
    currency: string;
    due_date?: string | null;
    participant?: { name?: string; role?: string; id?: string };
  }>;
  fundingSources: import('@/lib/projects/funding-sources/types').ProjectFundingSourceDto[];
  business: BusinessFinancialSnapshot | null;
  currentDate?: string;
};

export type WorkspaceTimelineResult = {
  events: WorkspaceTimelineEvent[];
  monthSummary: TimelineMonthSummary;
  cashForecast: CashFlowForecastPoint[];
};
