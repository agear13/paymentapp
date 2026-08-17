import type {
  OrganizationWorkflowLifecycleStatus,
  WorkflowAgreementExtractionStatus,
  WorkflowAgreementSourceType,
} from '@prisma/client';
import type { CommercialGraphSnapshot } from '@/lib/ai-extractor/commercial-graph-types';
import type { ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import type { ReviewFormState } from '@/lib/ai-extractor/review-form-types';

export type AgreementIntelligenceConfiguration = {
  defaultSettlementCurrency: 'AUD' | 'USD';
  operatorApprovalRequired: boolean;
};

export const DEFAULT_AGREEMENT_INTELLIGENCE_CONFIGURATION: AgreementIntelligenceConfiguration = {
  defaultSettlementCurrency: 'AUD',
  operatorApprovalRequired: true,
};

export type ApprovedAgreementStructure = {
  reviewForm: ReviewFormState;
  extractionResult: ExtractionResult;
  commercialGraph: CommercialGraphSnapshot;
  approvedAt: string;
  approvedByUserId: string;
};

export type WorkflowAgreementRecord = {
  id: string;
  organizationId: string;
  organizationWorkflowId: string;
  sourceType: WorkflowAgreementSourceType;
  title: string | null;
  originalFilename: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  storageKey: string | null;
  sourceText: string | null;
  extractionStatus: WorkflowAgreementExtractionStatus;
  extractionResult: ExtractionResult | null;
  commercialGraph: CommercialGraphSnapshot | null;
  approvedStructure: ApprovedAgreementStructure | null;
  extractionError: string | null;
  extractedAt: string | null;
  approvedAt: string | null;
  approvedByUserId: string | null;
  pilotDealId: string | null;
  bootstrapError: string | null;
  bootstrappedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowOperationalHubSummary = {
  lifecycleStatus: OrganizationWorkflowLifecycleStatus;
  lifecycleLabel: string;
  isOperational: boolean;
  pilotDealId: string | null;
  agreementTitle: string | null;
  participantCount: number;
  obligationCount: number;
  participants: Array<{ id: string; name: string; role: string }>;
  obligations: Array<{ id: string; label: string; amountLabel: string; status: string }>;
  upcomingActions: Array<{ label: string; detail: string }>;
  settlementSchedule: string | null;
};

export type WorkflowAgreementHubSummary = {
  title: string | null;
  lifecycleStatus: OrganizationWorkflowLifecycleStatus;
  extractionStatus: WorkflowAgreementExtractionStatus | null;
  participantCount: number;
  obligationCount: number;
  revenueShareCount: number;
  settlementSchedule: string | null;
  approvalRequired: boolean | null;
  hasAgreement: boolean;
  canReview: boolean;
  canApprove: boolean;
  canUpload: boolean;
  canRetryExtraction: boolean;
  canRetryBootstrap: boolean;
  isOperational: boolean;
};

export class WorkflowAgreementError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'NOT_FOUND'
      | 'FORBIDDEN'
      | 'INVALID_STATE'
      | 'INVALID_INPUT'
      | 'EXTRACTION_FAILED'
      | 'NOT_AGREEMENT_INTELLIGENCE',
    readonly status: number = 400
  ) {
    super(message);
    this.name = 'WorkflowAgreementError';
  }
}
