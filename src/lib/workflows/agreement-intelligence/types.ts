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

export type WorkflowOperationalPartyKind =
  | 'contractual_party'
  | 'compensated_participant';

export type WorkflowCoordinationAgreementStatus =
  | 'not_requested'
  | 'requested'
  | 'viewed'
  | 'approved';

export type WorkflowCoordinationPayoutStatus =
  | 'not_applicable'
  | 'required'
  | 'requested'
  | 'submitted'
  | 'flagged'
  | 'complete';

export type WorkflowCoordinationTaxStatus =
  | 'not_applicable'
  | 'required'
  | 'incomplete'
  | 'complete';

export type WorkflowCoordinationReferralStatus =
  | 'not_applicable'
  | 'not_configured'
  | 'service_required'
  | 'ready'
  | 'active';

export type WorkflowCoordinationCompensationKind = 'fixed' | 'revenue_share' | 'commission' | null;

export type WorkflowCoordinationNextActionKind =
  | 'request_approval'
  | 'request_payout_details'
  | 'review_payout_details'
  | 'request_update'
  | 'activate_referral'
  | 'none';

export type WorkflowOperationalReferralSummary = {
  code: string | null;
  url: string | null;
  qrUrl: string | null;
  destinationLabel: string | null;
  commissionLabel: string | null;
};

export type WorkflowOperationalParticipant = {
  id: string | null;
  name: string;
  commercialRole: string | null;
  operationalRole: string | null;
  partyKind: WorkflowOperationalPartyKind;
  statusLabel: string;
  approvalStatus: string | null;
  onboardingStatus: string | null;
  needsAttention: boolean;
  attentionReason: string | null;
  manageUrl: string | null;
  agreementStatus: WorkflowCoordinationAgreementStatus | null;
  payoutSetupStatus: WorkflowCoordinationPayoutStatus;
  taxInformationStatus: WorkflowCoordinationTaxStatus;
  referralStatus: WorkflowCoordinationReferralStatus;
  compensationKind: WorkflowCoordinationCompensationKind;
  compensationLabel: string | null;
  nextActionLabel: string | null;
  nextActionKind: WorkflowCoordinationNextActionKind;
  missingPayoutFields: string[];
  referral: WorkflowOperationalReferralSummary | null;
  eligibleServiceIds: string[];
  workspaceUrl: string | null;
  email: string | null;
  payoutReview: {
    preferredMethod: string | null;
    abn: string | null;
    gst: string | null;
    submittedAt: string | null;
  } | null;
};

export type WorkflowOperationalObligation = {
  id: string;
  label: string;
  amountLabel: string;
  status: string;
  type: string;
  beneficiary: string;
  obligor: string | null;
  cadence: string | null;
  nextAction: string | null;
};

export type WorkflowNeedsAttentionItem = {
  id: string;
  label: string;
  detail: string;
  participantId?: string | null;
  href?: string | null;
  /** Canonical issue discriminator. Do not group attention by display labels. */
  kind?: string;
};

export type WorkflowActivityItem = {
  id: string;
  label: string;
  detail: string | null;
  timestamp: string;
};

export type WorkflowSettlementSummary = {
  schedule: string | null;
  approvalRequired: boolean;
  nextSettlementLabel: string | null;
};

export type WorkflowOperationalActionDisposition = 'PROPOSED' | 'REQUIRES_APPROVAL' | 'READY';

export type WorkflowOperationalAction = {
  id: string;
  label: string;
  detail: string;
  disposition: WorkflowOperationalActionDisposition;
  participantId?: string | null;
  kind?: WorkflowCoordinationNextActionKind;
  href?: string | null;
};

export type WorkflowOperationalHubSummary = {
  lifecycleStatus: OrganizationWorkflowLifecycleStatus;
  lifecycleLabel: string;
  isOperational: boolean;
  isActivationComplete: boolean;
  pilotDealId: string | null;
  agreementTitle: string | null;
  participantCount: number;
  obligationCount: number;
  contractualPartyCount: number;
  compensatedParticipantCount: number;
  participants: WorkflowOperationalParticipant[];
  obligations: WorkflowOperationalObligation[];
  needsAttention: WorkflowNeedsAttentionItem[];
  actions: WorkflowOperationalAction[];
  upcomingActions: Array<{ label: string; detail: string; participantId?: string | null }>;
  settlement: WorkflowSettlementSummary;
  /** @deprecated Prefer settlement.schedule — kept for existing clients/tests */
  settlementSchedule: string | null;
  activity: WorkflowActivityItem[];
  projectParticipantsUrl: string | null;
  workflowDeploymentStatus: 'DEPLOYED' | 'PAUSED';
  coordinationBlocked: boolean;
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
  showsOperationalHub: boolean;
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
