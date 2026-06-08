import type {
  ProjectFundingConfidenceLevel,
  ProjectFundingSourceStatus,
  ProjectFundingSourceType,
} from '@prisma/client';

export type { ProjectFundingSourceType, ProjectFundingSourceStatus, ProjectFundingConfidenceLevel };

export type ProjectFundingSourceDto = {
  id: string;
  projectId: string;
  organizationId: string | null;
  name: string;
  description: string | null;
  sourceType: ProjectFundingSourceType;
  amount: number;
  currency: string;
  status: ProjectFundingSourceStatus;
  confidenceLevel: ProjectFundingConfidenceLevel;
  expectedSettlementDate: string | null;
  actualSettlementDate: string | null;
  linkedInvoiceId: string | null;
  linkedPaymentId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectTreasuryHealth =
  | 'healthy'
  | 'funding_pending'
  | 'forecast_heavy'
  | 'partially_funded'
  | 'settlement_risk'
  | 'ready_for_payout';

export type ObligationOperationalReadiness =
  | 'ready'
  | 'partially_funded'
  | 'awaiting_funding'
  | 'blocked'
  | 'forecast_only'
  /** Compensated project-obligation participants exist but no obligation rows materialized yet. */
  | 'obligations_pending';

export type ProjectTreasurySummary = {
  currency: string;
  fundingSourceCount: number;
  totalExpectedInflows: number;
  confirmedFunding: number;
  pendingFunding: number;
  forecastFunding: number;
  clearedFunding: number;
  obligationsTotal: number;
  obligationsReady: number;
  obligationsAwaitingFunding: number;
  operationalReadiness: ObligationOperationalReadiness;
  projectHealth: ProjectTreasuryHealth;
  hasFundingSources: boolean;
  fundingLabel: string;
  fundingSubcopy: string;
};
