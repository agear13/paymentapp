/**
 * Organization-scoped (and admin global) Xero sync backfill.
 * Queues PAYMENT syncs for PAID payment links missing xero_syncs rows.
 */
import 'server-only';

import { randomUUID } from 'crypto';
import { prisma } from '@/lib/server/prisma';
import { checkAdminAuth } from '@/lib/auth/admin.server';
import { hasOrganizationPermission } from '@/lib/auth/organization-access';
import { queueXeroSync } from '@/lib/xero/queue-service';
import { xeroBackfillTrace } from '@/lib/xero/xero-backfill-trace';

export type XeroBackfillScope = 'organization' | 'global';

export type XeroBackfillAuthResult =
  | {
      ok: true;
      userId: string;
      scope: XeroBackfillScope;
      organizationId: string | null;
    }
  | { ok: false; status: 401 | 403 | 400; error: string; code?: string };

export type XeroBackfillPreviewResult = {
  scope: XeroBackfillScope;
  organizationId: string | null;
  totalPaidLinks: number;
  linksWithSyncs: number;
  linksWithoutSyncs: number;
  previewLinks: Array<{
    paymentLinkId: string;
    shortCode: string;
    amount: unknown;
    currency: string;
    paidAt: Date;
  }>;
};

export type XeroBackfillExecuteResult = {
  scope: XeroBackfillScope;
  organizationId: string | null;
  queued: number;
  failed: number;
  details: Array<{
    paymentLinkId: string;
    shortCode: string;
    success: boolean;
    syncId?: string;
    error?: string;
  }>;
};

function paidLinksMissingSyncWhere(organizationId: string | null) {
  return {
    status: 'PAID' as const,
    ...(organizationId ? { organization_id: organizationId } : {}),
    xero_syncs: { none: {} },
  };
}

export async function authorizeXeroBackfill(params: {
  userId: string;
  organizationId: string | null | undefined;
  scope: XeroBackfillScope | undefined;
}): Promise<XeroBackfillAuthResult> {
  const requestedScope = params.scope ?? 'organization';

  if (requestedScope === 'global') {
    const admin = await checkAdminAuth();
    if (!admin.isAdmin) {
      xeroBackfillTrace('backfill_denied', {
        userId: params.userId,
        scope: 'global',
        reason: admin.error ?? 'admin_required',
      });
      return {
        ok: false,
        status: 403,
        error: 'Forbidden: global backfill requires platform admin',
        code: 'BACKFILL_GLOBAL_ADMIN_REQUIRED',
      };
    }
    return {
      ok: true,
      userId: params.userId,
      scope: 'global',
      organizationId: null,
    };
  }

  const organizationId = params.organizationId?.trim();
  if (!organizationId) {
    return {
      ok: false,
      status: 400,
      error: 'organization_id is required for organization-scoped backfill',
      code: 'BACKFILL_ORGANIZATION_REQUIRED',
    };
  }

  const canManage = await hasOrganizationPermission(
    params.userId,
    organizationId,
    'manage_settings'
  );
  if (!canManage) {
    xeroBackfillTrace('backfill_denied', {
      userId: params.userId,
      organizationId,
      scope: 'organization',
      reason: 'manage_settings_required',
    });
    return {
      ok: false,
      status: 403,
      error: 'Forbidden - insufficient organization permissions',
      code: 'BACKFILL_FORBIDDEN',
    };
  }

  return {
    ok: true,
    userId: params.userId,
    scope: 'organization',
    organizationId,
  };
}

export async function previewXeroBackfill(auth: {
  scope: XeroBackfillScope;
  organizationId: string | null;
}): Promise<XeroBackfillPreviewResult> {
  const where = paidLinksMissingSyncWhere(auth.organizationId);

  const paidWhere = {
    status: 'PAID' as const,
    ...(auth.organizationId ? { organization_id: auth.organizationId } : {}),
  };

  const [missingLinks, totalPaid, missingCount] = await Promise.all([
    prisma.payment_links.findMany({
      where,
      select: {
        id: true,
        short_code: true,
        amount: true,
        currency: true,
        updated_at: true,
      },
      orderBy: { updated_at: 'desc' },
      take: 100,
    }),
    prisma.payment_links.count({ where: paidWhere }),
    prisma.payment_links.count({ where }),
  ]);

  return {
    scope: auth.scope,
    organizationId: auth.organizationId,
    totalPaidLinks: totalPaid,
    linksWithSyncs: Math.max(0, totalPaid - missingCount),
    linksWithoutSyncs: missingCount,
    previewLinks: missingLinks.map((link) => ({
      paymentLinkId: link.id,
      shortCode: link.short_code,
      amount: link.amount,
      currency: link.currency,
      paidAt: link.updated_at,
    })),
  };
}

export async function executeXeroBackfill(auth: {
  userId: string;
  scope: XeroBackfillScope;
  organizationId: string | null;
}): Promise<XeroBackfillExecuteResult> {
  const runId = randomUUID();

  xeroBackfillTrace('backfill_requested', {
    userId: auth.userId,
    organizationId: auth.organizationId,
    scope: auth.scope,
    runId,
  });

  const links = await prisma.payment_links.findMany({
    where: paidLinksMissingSyncWhere(auth.organizationId),
    select: {
      id: true,
      short_code: true,
      organization_id: true,
    },
  });

  const details: XeroBackfillExecuteResult['details'] = [];

  for (const link of links) {
    try {
      const syncId = await queueXeroSync({
        paymentLinkId: link.id,
        organizationId: link.organization_id,
        priority: 0,
      });
      details.push({
        paymentLinkId: link.id,
        shortCode: link.short_code,
        success: true,
        syncId,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      details.push({
        paymentLinkId: link.id,
        shortCode: link.short_code,
        success: false,
        error: message,
      });
    }
  }

  const queued = details.filter((d) => d.success).length;
  const failed = details.filter((d) => !d.success).length;

  try {
    await prisma.audit_logs.create({
      data: {
        organization_id: auth.organizationId,
        user_id: auth.userId,
        entity_type: 'XeroSyncBackfill',
        entity_id: runId,
        action: 'XERO_BACKFILL_EXECUTED',
        new_values: {
          scope: auth.scope,
          organizationId: auth.organizationId,
          queued,
          failed,
          recordsProcessed: links.length,
          runId,
        },
      },
    });
  } catch {
    // Non-blocking
  }

  xeroBackfillTrace('backfill_completed', {
    userId: auth.userId,
    organizationId: auth.organizationId,
    scope: auth.scope,
    runId,
    recordsProcessed: links.length,
    queued,
    failed,
  });

  return {
    scope: auth.scope,
    organizationId: auth.organizationId,
    queued,
    failed,
    details,
  };
}
