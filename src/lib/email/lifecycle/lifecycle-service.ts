import 'server-only';

import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/server/prisma';
import { sendEmail, type EmailResponse, type SendEmailOptions } from '@/lib/email/client';
import {
  getLifecycleSenderEmail,
  getLifecycleContactConfig,
  type LifecycleContactConfig,
} from '@/lib/email/lifecycle/contact-config';
import { hasMeaningfulAdvisorUsage } from '@/lib/email/lifecycle/server-advisor-signal';
import {
  buildWelcomeEmail,
  buildActivationEmail,
  buildExistingUserCatchupEmail,
  buildAiAdvisorEmail,
  buildConsultationEmail,
  buildCommunityInviteEmail,
} from '@/lib/email/lifecycle/templates';
import type {
  LifecycleCampaignKey,
  LifecycleEligibilityResult,
  LifecycleSendResult,
  LifecycleTriggerInput,
} from '@/lib/email/lifecycle/types';
import { log } from '@/lib/logger';

export type LifecycleServiceDeps = {
  sendEmailFn?: (options: SendEmailOptions) => Promise<EmailResponse>;
  contactConfig?: LifecycleContactConfig;
  checkAdvisorUsageFn?: (input: { userId?: string | null; organizationId?: string | null }) => Promise<boolean>;
  findSendRecordFn?: (userId: string, campaign: LifecycleCampaignKey) => Promise<boolean>;
  checkWorkspaceExistsFn?: (organizationId: string, userId: string) => Promise<{ exists: boolean; workspaceName?: string | null }>;
  isUserVerifiedFn?: (userId: string, email: string) => Promise<boolean>;
  recordSendFn?: (record: {
    userId: string;
    organizationId?: string | null;
    email: string;
    campaign: LifecycleCampaignKey;
    status: 'sent' | 'failed' | 'suppressed';
    providerMessageId?: string | null;
    errorMessage?: string | null;
    metadata?: Record<string, unknown>;
  }) => Promise<void>;
  logEmailFn?: (logEntry: {
    toEmail: string;
    fromEmail: string;
    subject: string;
    templateName: string;
    status: 'SENT' | 'FAILED';
    providerId?: string | null;
    errorMessage?: string | null;
  }) => Promise<void>;
};

async function defaultCheckWorkspaceExists(
  organizationId: string,
  userId: string
): Promise<{ exists: boolean; workspaceName?: string | null }> {
  const membership = await prisma.user_organizations.findFirst({
    where: {
      organization_id: organizationId,
      user_id: userId,
    },
    include: {
      organizations: {
        select: { id: true, name: true },
      },
    },
  });

  if (!membership?.organizations) {
    return { exists: false };
  }

  return {
    exists: true,
    workspaceName: membership.organizations.name,
  };
}

async function defaultFindSendRecord(
  userId: string,
  campaign: LifecycleCampaignKey
): Promise<boolean> {
  const existing = await prisma.lifecycle_email_sends.findFirst({
    where: {
      user_id: userId,
      campaign_key: campaign,
      status: 'sent',
    },
    select: { id: true },
  });
  return Boolean(existing);
}

async function defaultRecordSend(record: {
  userId: string;
  organizationId?: string | null;
  email: string;
  campaign: LifecycleCampaignKey;
  status: 'sent' | 'failed' | 'suppressed';
  providerMessageId?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.lifecycle_email_sends.upsert({
      where: {
        user_id_campaign_key: {
          user_id: record.userId,
          campaign_key: record.campaign,
        },
      },
      create: {
        user_id: record.userId,
        organization_id: record.organizationId || null,
        email: record.email,
        campaign_key: record.campaign,
        status: record.status,
        sent_at: record.status === 'sent' ? new Date() : null,
        provider_message_id: record.providerMessageId || null,
        error_message: record.errorMessage || null,
        metadata: (record.metadata as object) || null,
      },
      update: {
        status: record.status,
        sent_at: record.status === 'sent' ? new Date() : undefined,
        provider_message_id: record.providerMessageId || null,
        error_message: record.errorMessage || null,
        metadata: (record.metadata as object) || undefined,
      },
    });
  } catch (err) {
    log.warn('Failed to persist lifecycle send state', {
      userId: record.userId,
      campaign: record.campaign,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function defaultLogEmail(entry: {
  toEmail: string;
  fromEmail: string;
  subject: string;
  templateName: string;
  status: 'SENT' | 'FAILED';
  providerId?: string | null;
  errorMessage?: string | null;
}): Promise<void> {
  try {
    await prisma.email_logs.create({
      data: {
        id: randomUUID(),
        to_email: entry.toEmail,
        from_email: entry.fromEmail,
        subject: entry.subject,
        template_name: entry.templateName,
        status: entry.status,
        provider_id: entry.providerId || null,
        error_message: entry.errorMessage || null,
      },
    });
  } catch (err) {
    log.warn('Failed to record email log for lifecycle email', {
      toEmail: entry.toEmail,
      template: entry.templateName,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function checkLifecycleEligibility(
  input: LifecycleTriggerInput,
  deps: LifecycleServiceDeps = {}
): Promise<LifecycleEligibilityResult> {
  const { campaign, userId, organizationId, email } = input;

  if (!email || !email.includes('@')) {
    return { eligible: false, reason: 'invalid_email' };
  }

    // 1. Check verified status if verification checker provided
    if (deps.isUserVerifiedFn) {
      const isVerified = await deps.isUserVerifiedFn(userId, email);
      if (!isVerified) {
        return { eligible: false, reason: 'unverified_email' };
      }
    }
  
    // 2. Check workspace state
    const checkWorkspace =
      deps.checkWorkspaceExistsFn ?? defaultCheckWorkspaceExists;
  
    if (campaign === 'welcome' || campaign === 'existing_user_catchup') {
      if (!organizationId) {
        return { eligible: false, reason: 'no_workspace' };
      }
  
      const ws = await checkWorkspace(organizationId, userId);
  
      if (!ws.exists) {
        return { eligible: false, reason: 'no_workspace' };
      }
    }
  
    if (campaign === 'activation') {
      const workspaceMembership = await prisma.user_organizations.findFirst({
        where: {
          user_id: userId,
        },
        select: {
          organization_id: true,
        },
      });
  
      if (workspaceMembership) {
        return { eligible: false, reason: 'workspace_already_exists' };
      }
    }



  // 3. Check idempotency: already sent
  const findSend = deps.findSendRecordFn ?? defaultFindSendRecord;
  const alreadySent = await findSend(userId, campaign);
  if (alreadySent) {
    return { eligible: false, reason: 'already_sent' };
  }

  // Special cross-suppression:
  // - If user already received welcome, suppress catchup
  if (campaign === 'existing_user_catchup') {
    const receivedWelcome = await findSend(userId, 'welcome');
    if (receivedWelcome) {
      return { eligible: false, reason: 'welcome_already_sent' };
    }
  }

  // - If user already received catchup, suppress welcome
  if (campaign === 'welcome') {
    const receivedCatchup = await findSend(userId, 'existing_user_catchup');
    if (receivedCatchup) {
      return { eligible: false, reason: 'catchup_already_sent' };
    }
  }

  // 4. Advisor campaign suppression: check server-side advisor usage
  if (campaign === 'ai_advisor') {
    const checkAdvisor = deps.checkAdvisorUsageFn ?? hasMeaningfulAdvisorUsage;
    const advisorUsed = await checkAdvisor({ userId, organizationId });
    if (advisorUsed) {
      return { eligible: false, reason: 'advisor_already_used' };
    }
  }

  // 5. Community campaign: check discord invite configuration
  if (campaign === 'community_invite') {
    const config = deps.contactConfig ?? getLifecycleContactConfig();
    if (!config.discordInviteUrl) {
      return { eligible: false, reason: 'discord_not_configured' };
    }
  }

  return { eligible: true };
}

export function renderLifecycleTemplate(
  input: LifecycleTriggerInput,
  contactConfig: LifecycleContactConfig = getLifecycleContactConfig()
): { subject: string; html: string; text: string } {
  const { campaign, userName, workspaceName } = input;

  switch (campaign) {
    case 'welcome':
      return buildWelcomeEmail({ userName, workspaceName, contactConfig });
    case 'activation':
      return buildActivationEmail({userName, contactConfig });
    case 'existing_user_catchup':
      return buildExistingUserCatchupEmail({ userName, workspaceName, contactConfig });
    case 'ai_advisor':
      return buildAiAdvisorEmail({ userName, contactConfig });
    case 'consultation_cta':
      return buildConsultationEmail({ userName, contactConfig });
    case 'community_invite':
      return buildCommunityInviteEmail({ userName, contactConfig });
    default:
      throw new Error(`Unsupported lifecycle campaign: ${String(campaign)}`);
  }
}

export async function sendLifecycleEmail(
  input: LifecycleTriggerInput,
  deps: LifecycleServiceDeps = {}
): Promise<LifecycleSendResult> {
  const contactConfig = deps.contactConfig ?? getLifecycleContactConfig();

  // 1. Check eligibility
  const eligibility = await checkLifecycleEligibility(input, deps);
  if (!eligibility.eligible) {
    return {
      success: false,
      campaign: input.campaign,
      recipient: input.email,
      userId: input.userId,
      organizationId: input.organizationId,
      status: 'suppressed',
      suppressedReason: eligibility.reason,
    };
  }

  // 2. Render template
  const template = renderLifecycleTemplate(input, contactConfig);
  const senderEmail = getLifecycleSenderEmail();
  const sendFn = deps.sendEmailFn ?? sendEmail;

  // 3. Dispatch email via Resend
  const emailResult = await sendFn({
    to: input.email,
    from: senderEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
    tags: [{ name: 'category', value: 'lifecycle' }, { name: 'campaign', value: input.campaign }],
  });

  const recordSend = deps.recordSendFn ?? defaultRecordSend;
  const logEmail = deps.logEmailFn ?? defaultLogEmail;

  // 4. Record delivery log in email_logs
  await logEmail({
    toEmail: input.email,
    fromEmail: senderEmail,
    subject: template.subject,
    templateName: `LIFECYCLE_${input.campaign.toUpperCase()}`,
    status: emailResult.success ? 'SENT' : 'FAILED',
    providerId: emailResult.id || null,
    errorMessage: emailResult.error || null,
  });

  // 5. Record lifecycle send state
  await recordSend({
    userId: input.userId,
    organizationId: input.organizationId,
    email: input.email,
    campaign: input.campaign,
    status: emailResult.success ? 'sent' : 'failed',
    providerMessageId: emailResult.id || null,
    errorMessage: emailResult.error || null,
    metadata: input.metadata,
  });

  return {
    success: emailResult.success,
    campaign: input.campaign,
    recipient: input.email,
    userId: input.userId,
    organizationId: input.organizationId,
    status: emailResult.success ? 'sent' : 'failed',
    providerMessageId: emailResult.id || null,
    error: emailResult.error || null,
  };
}

/**
 * Hook to trigger the Welcome lifecycle email upon successful workspace creation.
 * Fails open so an email delivery issue never breaks workspace onboarding.
 */
export async function triggerWelcomeOnBootstrap(input: {
  userId: string;
  organizationId: string;
  email: string;
  workspaceName?: string | null;
  userName?: string | null;
}): Promise<LifecycleSendResult | null> {
  try {
    return await sendLifecycleEmail({
      campaign: 'welcome',
      userId: input.userId,
      organizationId: input.organizationId,
      email: input.email,
      workspaceName: input.workspaceName,
      userName: input.userName,
    });
  } catch (err) {
    log.error('triggerWelcomeOnBootstrap failed open', {
      userId: input.userId,
      organizationId: input.organizationId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
