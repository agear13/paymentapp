import 'server-only';

import { prisma } from '@/lib/server/prisma';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  isVerifiedUser,
  listAuthUserCandidates,
  type UserCandidate,
} from '@/lib/email/lifecycle/catchup-dry-run';
import {
  isCatchupExcludedEmail,
  sendLifecycleEmail,
  type LifecycleServiceDeps,
} from '@/lib/email/lifecycle/lifecycle-service';
import type {
  ActivationRecoveryDryRunCandidate,
  ActivationRecoveryDryRunReport,
  ActivationRecoverySendReport,
  ActivationRecoverySendResultRow,
  LifecycleSendResult,
  LifecycleTriggerInput,
} from '@/lib/email/lifecycle/types';
import { log } from '@/lib/logger';

export type ActivationRecoveryDryRunDeps = {
  listUsersFn?: () => Promise<UserCandidate[]>;
  hasPriorSendFn?: (userId: string) => Promise<boolean>;
  isExcludedEmailFn?: (email: string) => boolean;
  lookupUserFn?: (userId: string) => Promise<UserCandidate | null>;
};

export type ActivationRecoverySendDeps = ActivationRecoveryDryRunDeps & {
  sendLifecycleEmailFn?: (
    input: LifecycleTriggerInput,
    deps?: LifecycleServiceDeps
  ) => Promise<LifecycleSendResult>;
};

export type ActivationRecoveryAudienceCandidate = {
  userId: string;
  email: string;
  userName?: string | null;
  userCreatedAt: string;
  status: 'eligible' | 'excluded';
  reason?: string;
  isVerified: boolean;
};

export type ActivationRecoveryAudienceReport = {
  totalExamined: number;
  totalVerified: number;
  totalUnverified: number;
  totalEligible: number;
  totalExcluded: number;
  exclusionBreakdown: Record<string, number>;
  candidates: ActivationRecoveryAudienceCandidate[];
};

function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length <= 2 ? `${name[0]}*` : `${name.slice(0, 2)}***${name.slice(-1)}`;
  return `${maskedName}@${domain}`;
}

function isValidEmail(email: string): boolean {
  return Boolean(email && email.includes('@'));
}

function emptyExclusionBreakdown(): Record<string, number> {
  return {
    invalid_email: 0,
    excluded_email: 0,
    verified_email: 0,
    already_sent: 0,
  };
}

async function defaultHasPriorSend(userId: string): Promise<boolean> {
  const row = await prisma.lifecycle_email_sends.findFirst({
    where: {
      user_id: userId,
      campaign_key: 'activation_recovery',
      status: 'sent',
    },
    select: { id: true },
  });
  return Boolean(row);
}

async function defaultLookupUser(userId: string): Promise<UserCandidate | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data.user) {
      return null;
    }

    const u = data.user;
    return {
      id: u.id,
      email: u.email || '',
      emailConfirmedAt: u.email_confirmed_at || null,
      createdAt: u.created_at,
      appMetadata: u.app_metadata as Record<string, unknown> | undefined,
      userName:
        (typeof u.user_metadata?.full_name === 'string' ? u.user_metadata.full_name : null) ||
        (typeof u.user_metadata?.name === 'string' ? u.user_metadata.name : null),
    };
  } catch (err) {
    log.warn('activation_recovery lookupUser failed', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Shared audience evaluation for activation recovery dry-run and controlled send.
 */
export async function evaluateActivationRecoveryAudience(
  deps: ActivationRecoveryDryRunDeps = {}
): Promise<ActivationRecoveryAudienceReport> {
  const listUsers = deps.listUsersFn ?? listAuthUserCandidates;
  const hasPriorSend = deps.hasPriorSendFn ?? defaultHasPriorSend;
  const isExcluded = deps.isExcludedEmailFn ?? isCatchupExcludedEmail;

  const users = await listUsers();
  const candidates: ActivationRecoveryAudienceCandidate[] = [];
  const exclusionBreakdown = emptyExclusionBreakdown();

  let totalVerified = 0;
  let totalUnverified = 0;
  let totalEligible = 0;
  let totalExcluded = 0;

  for (const user of users) {
    const isVerified = isVerifiedUser(user);
    if (isVerified) {
      totalVerified++;
    } else {
      totalUnverified++;
    }

    const pushExcluded = (reason: string) => {
      totalExcluded++;
      exclusionBreakdown[reason] = (exclusionBreakdown[reason] ?? 0) + 1;
      candidates.push({
        userId: user.id,
        email: user.email,
        userName: user.userName ?? null,
        userCreatedAt: user.createdAt,
        status: 'excluded',
        reason,
        isVerified,
      });
    };

    if (!isValidEmail(user.email)) {
      pushExcluded('invalid_email');
      continue;
    }

    if (isExcluded(user.email)) {
      pushExcluded('excluded_email');
      continue;
    }

    if (isVerified) {
      pushExcluded('verified_email');
      continue;
    }

    const recoverySent = await hasPriorSend(user.id);
    if (recoverySent) {
      pushExcluded('already_sent');
      continue;
    }

    totalEligible++;
    candidates.push({
      userId: user.id,
      email: user.email,
      userName: user.userName ?? null,
      userCreatedAt: user.createdAt,
      status: 'eligible',
      isVerified: false,
    });
  }

  return {
    totalExamined: users.length,
    totalVerified,
    totalUnverified,
    totalEligible,
    totalExcluded,
    exclusionBreakdown,
    candidates,
  };
}

function toDryRunCandidate(
  candidate: ActivationRecoveryAudienceCandidate
): ActivationRecoveryDryRunCandidate {
  return {
    userId: candidate.userId,
    email: maskEmail(candidate.email),
    userCreatedAt: candidate.userCreatedAt,
    status: candidate.status,
    reason: candidate.reason,
  };
}

/**
 * Read-only dry run for activation recovery. Zero emails dispatched.
 */
export async function runActivationRecoveryDryRun(
  deps: ActivationRecoveryDryRunDeps = {}
): Promise<ActivationRecoveryDryRunReport> {
  const audience = await evaluateActivationRecoveryAudience(deps);
  return {
    dryRun: true,
    totalExamined: audience.totalExamined,
    totalVerified: audience.totalVerified,
    totalUnverified: audience.totalUnverified,
    totalEligible: audience.totalEligible,
    totalExcluded: audience.totalExcluded,
    exclusionBreakdown: audience.exclusionBreakdown,
    candidates: audience.candidates.map(toDryRunCandidate),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Controlled send for activation recovery.
 * Requires explicit positive limit. Fresh Supabase verification check per recipient.
 */
export async function runActivationRecoverySend(
  options: { limit: number },
  deps: ActivationRecoverySendDeps = {}
): Promise<ActivationRecoverySendReport> {
  const limit = Math.floor(options.limit);
  if (!Number.isFinite(limit) || limit < 1) {
    throw new Error('Activation recovery send requires a positive --limit');
  }

  const audience = await evaluateActivationRecoveryAudience(deps);
  const eligible = audience.candidates.filter((candidate) => candidate.status === 'eligible');
  const selected = eligible.slice(0, limit);
  const sendFn = deps.sendLifecycleEmailFn ?? sendLifecycleEmail;
  const lookupUser = deps.lookupUserFn ?? defaultLookupUser;
  const results: ActivationRecoverySendResultRow[] = [];

  let totalSent = 0;
  let totalSuppressed = 0;
  let totalFailed = 0;

  for (const user of selected) {
    try {
      const result = await sendFn(
        {
          campaign: 'activation_recovery',
          userId: user.userId,
          email: user.email,
          userName: user.userName,
        },
        {
          isUserVerifiedFn: async () => {
            const fresh = await lookupUser(user.userId);
            if (!fresh) {
              return true;
            }
            return isVerifiedUser(fresh);
          },
        }
      );

      if (result.status === 'sent') {
        totalSent++;
        results.push({
          userId: user.userId,
          email: maskEmail(user.email),
          status: 'sent',
        });
        continue;
      }

      if (result.status === 'suppressed') {
        totalSuppressed++;
        results.push({
          userId: user.userId,
          email: maskEmail(user.email),
          status: 'suppressed',
          reason: result.suppressedReason || 'suppressed',
        });
        continue;
      }

      totalFailed++;
      results.push({
        userId: user.userId,
        email: maskEmail(user.email),
        status: 'failed',
        reason: result.error || 'send_failed',
      });
    } catch (err) {
      totalFailed++;
      log.warn('Activation recovery send failed for user; continuing', {
        userId: user.userId,
        error: err instanceof Error ? err.message : String(err),
      });
      results.push({
        userId: user.userId,
        email: maskEmail(user.email),
        status: 'failed',
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    dryRun: false,
    confirmed: true,
    limit,
    totalExamined: audience.totalExamined,
    totalVerified: audience.totalVerified,
    totalUnverified: audience.totalUnverified,
    totalEligible: audience.totalEligible,
    totalSelected: selected.length,
    totalSent,
    totalSuppressed,
    totalFailed,
    exclusionBreakdown: audience.exclusionBreakdown,
    results,
    generatedAt: new Date().toISOString(),
  };
}
