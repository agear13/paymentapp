export type LifecycleCampaignKey =
  | 'welcome'
  | 'activation'
  | 'activation_recovery'
  | 'existing_user_catchup'
  | 'ai_advisor'
  | 'consultation_cta'
  | 'community_invite';

export type LifecycleSendStatus =
  | 'sent'
  | 'failed'
  | 'suppressed'
  | 'dry_run'
  | 'attempted';

export type LifecycleTriggerInput = {
  campaign: LifecycleCampaignKey;
  userId: string;
  organizationId?: string | null;
  email: string;
  userName?: string | null;
  workspaceName?: string | null;
  metadata?: Record<string, unknown>;
};

export type LifecycleEligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: string };

export type LifecycleSendResult = {
  success: boolean;
  campaign: LifecycleCampaignKey;
  recipient: string;
  userId: string;
  organizationId?: string | null;
  status: LifecycleSendStatus;
  providerMessageId?: string | null;
  error?: string | null;
  suppressedReason?: string | null;
};

export type CatchupDryRunCandidate = {
  userId: string;
  email: string;
  organizationId: string | null;
  workspaceName: string | null;
  userCreatedAt: string;
  status: 'eligible' | 'excluded';
  reason?: string;
};

export type CatchupDryRunReport = {
  dryRun: true;
  totalExamined: number;
  totalEligible: number;
  totalExcluded: number;
  exclusionBreakdown: Record<string, number>;
  candidates: CatchupDryRunCandidate[];
  generatedAt: string;
};

export type CatchupSendResultRow = {
  userId: string;
  email: string;
  organizationId: string | null;
  status: 'sent' | 'failed' | 'suppressed';
  reason?: string;
};

export type CatchupSendReport = {
  dryRun: false;
  confirmed: true;
  limit: number;
  totalExamined: number;
  totalEligible: number;
  totalSelected: number;
  totalSent: number;
  totalSuppressed: number;
  totalFailed: number;
  exclusionBreakdown: Record<string, number>;
  results: CatchupSendResultRow[];
  generatedAt: string;
};

export type ActivationRecoveryDryRunCandidate = {
  userId: string;
  email: string;
  userCreatedAt: string;
  status: 'eligible' | 'excluded';
  reason?: string;
};

export type ActivationRecoveryDryRunReport = {
  dryRun: true;
  totalExamined: number;
  totalVerified: number;
  totalUnverified: number;
  totalEligible: number;
  totalExcluded: number;
  exclusionBreakdown: Record<string, number>;
  candidates: ActivationRecoveryDryRunCandidate[];
  generatedAt: string;
};

export type ActivationRecoverySendResultRow = {
  userId: string;
  email: string;
  status: 'sent' | 'failed' | 'suppressed';
  reason?: string;
};

export type ActivationRecoverySendReport = {
  dryRun: false;
  confirmed: true;
  limit: number;
  totalExamined: number;
  totalVerified: number;
  totalUnverified: number;
  totalEligible: number;
  totalSelected: number;
  totalSent: number;
  totalSuppressed: number;
  totalFailed: number;
  exclusionBreakdown: Record<string, number>;
  results: ActivationRecoverySendResultRow[];
  generatedAt: string;
};
