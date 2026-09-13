import 'server-only';

import { prisma } from '@/lib/server/prisma';
import { createAdminClient } from '@/lib/supabase/admin';
import type {
  CatchupDryRunCandidate,
  CatchupDryRunReport,
  CatchupSendReport,
  CatchupSendResultRow,
  LifecycleSendResult,
  LifecycleTriggerInput,
} from '@/lib/email/lifecycle/types';
import { sendLifecycleEmail, type LifecycleServiceDeps } from '@/lib/email/lifecycle/lifecycle-service';
import { log } from '@/lib/logger';

export type UserCandidate = {
  id: string;
  email: string;
  emailConfirmedAt: string | null;
  createdAt: string;
  appMetadata?: Record<string, unknown>;
  userName?: string | null;
};

export type CatchupDryRunDeps = {
  listUsersFn?: () => Promise<UserCandidate[]>;
  getUserWorkspacesFn?: (userId: string) => Promise<{ organizationId: string; workspaceName: string }[]>;
  hasPriorSendFn?: (userId: string, campaign: 'welcome' | 'existing_user_catchup') => Promise<boolean>;
  isExcludedEmailFn?: (email: string) => boolean;
};

export type CatchupSendDeps = CatchupDryRunDeps & {
  sendLifecycleEmailFn?: (
    input: LifecycleTriggerInput,
    deps?: LifecycleServiceDeps
  ) => Promise<LifecycleSendResult>;
};

export type CatchupAudienceCandidate = {
  userId: string;
  email: string;
  organizationId: string | null;
  workspaceName: string | null;
  userName?: string | null;
  userCreatedAt: string;
  status: 'eligible' | 'excluded';
  reason?: string;
  isVerified: boolean;
};

export type CatchupAudienceReport = {
  totalExamined: number;
  totalEligible: number;
  totalExcluded: number;
  exclusionBreakdown: Record<string, number>;
  candidates: CatchupAudienceCandidate[];
};

function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length <= 2 ? `${name[0]}*` : `${name.slice(0, 2)}***${name.slice(-1)}`;
  return `${maskedName}@${domain}`;
}

export function parseCatchupExcludedEmails(
  raw: string | undefined = process.env.LIFECYCLE_CATCHUP_EXCLUDED_EMAILS
): { emails: Set<string>; domains: Set<string> } {
  const emails = new Set<string>();
  const domains = new Set<string>();
  if (!raw?.trim()) return { emails, domains };

  for (const part of raw.split(',')) {
    const value = part.trim().toLowerCase();
    if (!value) continue;
    if (value.startsWith('@')) {
      domains.add(value.slice(1));
      continue;
    }
    if (value.includes('@')) {
      emails.add(value);
    }
  }
  return { emails, domains };
}

export function isCatchupExcludedEmail(
  email: string,
  lists: { emails: Set<string>; domains: Set<string> } = parseCatchupExcludedEmails()
): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  if (lists.emails.has(normalized)) return true;
  const domain = normalized.split('@')[1];
  return Boolean(domain && lists.domains.has(domain));
}

function isValidEmail(email: string): boolean {
  return Boolean(email && email.includes('@'));
}

function isVerifiedUser(user: UserCandidate): boolean {
  return Boolean(
    user.emailConfirmedAt ||
      (user.appMetadata?.provider && user.appMetadata.provider !== 'email')
  );
}

function emptyExclusionBreakdown(): Record<string, number> {
  return {
    invalid_email: 0,
    excluded_email: 0,
    unverified_email: 0,
    no_workspace: 0,
    welcome_already_sent: 0,
    catchup_already_sent: 0,
  };
}

async function defaultListUsers(): Promise<UserCandidate[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (error || !data?.users) {
      log.warn('Could not list users from Supabase admin, falling back to user_organizations', {
        error: error?.message,
      });
      return fallbackListUsersFromDb();
    }

    return data.users.map((u) => ({
      id: u.id,
      email: u.email || '',
      emailConfirmedAt: u.email_confirmed_at || null,
      createdAt: u.created_at,
      appMetadata: u.app_metadata as Record<string, unknown> | undefined,
      userName:
        (typeof u.user_metadata?.full_name === 'string' ? u.user_metadata.full_name : null) ||
        (typeof u.user_metadata?.name === 'string' ? u.user_metadata.name : null),
    }));
  } catch (err) {
    log.warn('createAdminClient failed, falling back to database memberships', {
      error: err instanceof Error ? err.message : String(err),
    });
    return fallbackListUsersFromDb();
  }
}

async function fallbackListUsersFromDb(): Promise<UserCandidate[]> {
  const memberships = await prisma.user_organizations.findMany({
    select: {
      user_id: true,
      created_at: true,
    },
    distinct: ['user_id'],
  });

  return memberships.map((m) => ({
    id: m.user_id,
    email: '',
    emailConfirmedAt: null,
    createdAt: m.created_at.toISOString(),
  }));
}

async function defaultGetUserWorkspaces(
  userId: string
): Promise<{ organizationId: string; workspaceName: string }[]> {
  const records = await prisma.user_organizations.findMany({
    where: { user_id: userId },
    include: {
      organizations: {
        select: { id: true, name: true },
      },
    },
  });

  return records
    .filter((r) => r.organizations !== null)
    .map((r) => ({
      organizationId: r.organizations.id,
      workspaceName: r.organizations.name,
    }));
}

async function defaultHasPriorSend(
  userId: string,
  campaign: 'welcome' | 'existing_user_catchup'
): Promise<boolean> {
  const row = await prisma.lifecycle_email_sends.findFirst({
    where: {
      user_id: userId,
      campaign_key: campaign,
      status: 'sent',
    },
    select: { id: true },
  });
  return Boolean(row);
}

/**
 * Shared audience evaluation for dry-run and controlled send.
 * Emails are unmasked here; callers that persist/print reports should mask.
 */
export async function evaluateCatchupAudience(
  deps: CatchupDryRunDeps = {}
): Promise<CatchupAudienceReport> {
  const listUsers = deps.listUsersFn ?? defaultListUsers;
  const getUserWorkspaces = deps.getUserWorkspacesFn ?? defaultGetUserWorkspaces;
  const hasPriorSend = deps.hasPriorSendFn ?? defaultHasPriorSend;
  const isExcluded = deps.isExcludedEmailFn ?? isCatchupExcludedEmail;

  const users = await listUsers();
  const candidates: CatchupAudienceCandidate[] = [];
  const exclusionBreakdown = emptyExclusionBreakdown();

  let totalEligible = 0;
  let totalExcluded = 0;

  for (const user of users) {
    const pushExcluded = (reason: string) => {
      totalExcluded++;
      exclusionBreakdown[reason] = (exclusionBreakdown[reason] ?? 0) + 1;
      candidates.push({
        userId: user.id,
        email: user.email,
        organizationId: null,
        workspaceName: null,
        userName: user.userName ?? null,
        userCreatedAt: user.createdAt,
        status: 'excluded',
        reason,
        isVerified: isVerifiedUser(user),
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

    const isVerified = isVerifiedUser(user);
    if (!isVerified) {
      pushExcluded('unverified_email');
      continue;
    }

    const workspaces = await getUserWorkspaces(user.id);
    if (workspaces.length === 0) {
      pushExcluded('no_workspace');
      continue;
    }

    const primaryWorkspace = workspaces[0];

    const welcomeSent = await hasPriorSend(user.id, 'welcome');
    if (welcomeSent) {
      totalExcluded++;
      exclusionBreakdown.welcome_already_sent++;
      candidates.push({
        userId: user.id,
        email: user.email,
        organizationId: primaryWorkspace.organizationId,
        workspaceName: primaryWorkspace.workspaceName,
        userName: user.userName ?? null,
        userCreatedAt: user.createdAt,
        status: 'excluded',
        reason: 'welcome_already_sent',
        isVerified: true,
      });
      continue;
    }

    const catchupSent = await hasPriorSend(user.id, 'existing_user_catchup');
    if (catchupSent) {
      totalExcluded++;
      exclusionBreakdown.catchup_already_sent++;
      candidates.push({
        userId: user.id,
        email: user.email,
        organizationId: primaryWorkspace.organizationId,
        workspaceName: primaryWorkspace.workspaceName,
        userName: user.userName ?? null,
        userCreatedAt: user.createdAt,
        status: 'excluded',
        reason: 'catchup_already_sent',
        isVerified: true,
      });
      continue;
    }

    totalEligible++;
    candidates.push({
      userId: user.id,
      email: user.email,
      organizationId: primaryWorkspace.organizationId,
      workspaceName: primaryWorkspace.workspaceName,
      userName: user.userName ?? null,
      userCreatedAt: user.createdAt,
      status: 'eligible',
      isVerified: true,
    });
  }

  return {
    totalExamined: users.length,
    totalEligible,
    totalExcluded,
    exclusionBreakdown,
    candidates,
  };
}

function toDryRunCandidate(candidate: CatchupAudienceCandidate): CatchupDryRunCandidate {
  return {
    userId: candidate.userId,
    email: maskEmail(candidate.email),
    organizationId: candidate.organizationId,
    workspaceName: candidate.workspaceName,
    userCreatedAt: candidate.userCreatedAt,
    status: candidate.status,
    reason: candidate.reason,
  };
}

/**
 * Executes a strictly read-only dry run of the existing-user catch-up campaign.
 * Zero emails are dispatched.
 */
export async function runExistingUserCatchupDryRun(
  deps: CatchupDryRunDeps = {}
): Promise<CatchupDryRunReport> {
  const audience = await evaluateCatchupAudience(deps);
  return {
    dryRun: true,
    totalExamined: audience.totalExamined,
    totalEligible: audience.totalEligible,
    totalExcluded: audience.totalExcluded,
    exclusionBreakdown: audience.exclusionBreakdown,
    candidates: audience.candidates.map(toDryRunCandidate),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Controlled send for existing-user catch-up.
 * Never auto-runs: callers must pass an explicit positive limit.
 * Each send still goes through sendLifecycleEmail() eligibility + idempotency.
 */
export async function runExistingUserCatchupSend(
  options: { limit: number },
  deps: CatchupSendDeps = {}
): Promise<CatchupSendReport> {
  const limit = Math.floor(options.limit);
  if (!Number.isFinite(limit) || limit < 1) {
    throw new Error('Catch-up send requires a positive --limit');
  }

  const audience = await evaluateCatchupAudience(deps);
  const eligible = audience.candidates.filter((candidate) => candidate.status === 'eligible');
  const selected = eligible.slice(0, limit);
  const sendFn = deps.sendLifecycleEmailFn ?? sendLifecycleEmail;
  const results: CatchupSendResultRow[] = [];

  let totalSent = 0;
  let totalSuppressed = 0;
  let totalFailed = 0;

  for (const user of selected) {
    try {
      const result = await sendFn(
        {
          campaign: 'existing_user_catchup',
          userId: user.userId,
          organizationId: user.organizationId,
          email: user.email,
          workspaceName: user.workspaceName,
          userName: user.userName,
        },
        {
          isUserVerifiedFn: async () => user.isVerified,
        }
      );

      if (result.status === 'sent') {
        totalSent++;
        results.push({
          userId: user.userId,
          email: maskEmail(user.email),
          organizationId: user.organizationId,
          status: 'sent',
        });
        continue;
      }

      if (result.status === 'suppressed') {
        totalSuppressed++;
        results.push({
          userId: user.userId,
          email: maskEmail(user.email),
          organizationId: user.organizationId,
          status: 'suppressed',
          reason: result.suppressedReason || 'suppressed',
        });
        continue;
      }

      totalFailed++;
      results.push({
        userId: user.userId,
        email: maskEmail(user.email),
        organizationId: user.organizationId,
        status: 'failed',
        reason: result.error || 'send_failed',
      });
    } catch (err) {
      totalFailed++;
      log.warn('Catch-up send failed for user; continuing', {
        userId: user.userId,
        error: err instanceof Error ? err.message : String(err),
      });
      results.push({
        userId: user.userId,
        email: maskEmail(user.email),
        organizationId: user.organizationId,
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
