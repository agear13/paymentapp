import type {
  AccountingLayer,
  CommercialLayer,
  SettlementLayer,
} from '@/lib/payments/payment-layers';

/** High-level calendar grouping — drives colour and summary rollups. */
export type CalendarEventCategory =
  | 'expected_revenue'
  | 'money_outgoing'
  | 'project_milestone'
  | 'operational_task';

export type CalendarEventDirection = 'incoming' | 'outgoing' | 'neutral';

export type CalendarEventSourceType =
  | 'invoice'
  | 'payment_link'
  | 'funding_source'
  | 'commercial_role'
  | 'participant'
  | 'obligation'
  | 'settlement'
  | 'commercial_task'
  | 'project'
  | 'recurring'
  | 'approval';

export type CalendarEventAction = {
  label: string;
  href: string;
  variant?: 'default' | 'outline';
};

export type CalendarEvent = {
  id: string;
  title: string;
  type: CalendarEventCategory;
  /** ISO date (YYYY-MM-DD) for calendar placement. */
  date: string;
  amount: number | null;
  currency: string | null;
  direction: CalendarEventDirection;
  status: string;
  projectId: string | null;
  projectName: string | null;
  participantId: string | null;
  participantName: string | null;
  sourceType: CalendarEventSourceType;
  sourceId: string;
  /** Operator-facing source explanation fields — resolved in the drawer. */
  sourceMetadata: Record<string, string | number | boolean | null>;
  commercialLayer: CommercialLayer | null;
  accountingLayer: AccountingLayer | null;
  settlementLayer: SettlementLayer | null;
  actionHref: string | null;
  actions: CalendarEventAction[];
  tags: string[];
};

export type CalendarViewMode = 'month' | 'week' | 'agenda';

export type CalendarFilters = {
  projectId: string | null;
  participantId: string | null;
  category: CalendarEventCategory | 'all';
  currency: string | null;
  status: string | null;
  tag: string | null;
  search: string;
};

export const DEFAULT_CALENDAR_FILTERS: CalendarFilters = {
  projectId: null,
  participantId: null,
  category: 'all',
  currency: null,
  status: null,
  tag: null,
  search: '',
};

export type CalendarMonthSummary = {
  incoming: number;
  outgoing: number;
  net: number;
  currency: string;
  activeProjects: number;
  paymentsDue: number;
  settlementReleases: number;
  approvalsWaiting: number;
};

export type CalendarEventSource<T = unknown> = {
  id: string;
  label: string;
  derive: (input: T, ctx: CalendarDerivationContext) => CalendarEvent[];
};

export type CalendarPaymentLinkInput = {
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
  expiresAt: string | null;
  createdAt: string;
  pilotDealId?: string | null;
  xeroInvoiceNumber?: string | null;
};

export type CalendarObligationInput = {
  id: string;
  deal_id: string;
  obligation_type: string;
  status: string;
  amount_owed: number;
  currency: string;
  due_date?: string | null;
  participant?: { name?: string; role?: string; id?: string };
};

export type CalendarDerivationContext = {
  dealsById: Map<string, { id: string; name: string }>;
  today: string;
};

export type CalendarDerivationInput = {
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
    role?: string;
  }>;
  paymentLinks: CalendarPaymentLinkInput[];
  obligations: CalendarObligationInput[];
  fundingSources: import('@/lib/projects/funding-sources/types').ProjectFundingSourceDto[];
  tasks: import('@/lib/commercial/commercial-task-engine').CommercialTask[];
  currentDate?: string;
};
