export type LifecycleCampaignKey =
  | 'welcome'
  |  'activation'
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
