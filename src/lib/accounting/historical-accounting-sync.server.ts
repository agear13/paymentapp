/**
 * Historical accounting sync — organization-scoped preview and queue execution.
 */
import 'server-only';

import { randomUUID } from 'crypto';
import { prisma } from '@/lib/server/prisma';
import { hasOrganizationPermission } from '@/lib/auth/organization-access';
import { queueXeroSync } from '@/lib/xero/queue-service';
import { getConnectionStatus } from '@/lib/xero';
import {
  buildHistoricalSyncPreview,
  selectHistoricalSyncItems,
  syncTypesToQueueForItem,
  type HistoricalSyncExecuteResult,
  type HistoricalSyncPreview,
} from '@/lib/accounting/historical-accounting-sync';

export type HistoricalSyncAuthResult =
  | { ok: true; userId: string; organizationId: string }
  | { ok: false; status: 401 | 403 | 400 | 409; error: string; code?: string };

function formatAmount(amount: unknown, currency: string): string {
  const numeric = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(numeric)) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.trim() || 'USD',
    }).format(numeric);
  } catch {
    return `${numeric.toFixed(2)} ${currency}`;
  }
}

export async function authorizeHistoricalAccountingSync(params: {
  userId: string;
  organizationId: string | null | undefined;
}): Promise<HistoricalSyncAuthResult> {
  const organizationId = params.organizationId?.trim();
  if (!organizationId) {
    return {
      ok: false,
      status: 400,
      error: 'organization_id is required',
      code: 'HISTORICAL_SYNC_ORGANIZATION_REQUIRED',
    };
  }

  const canManage = await hasOrganizationPermission(
    params.userId,
    organizationId,
    'manage_settings'
  );
  if (!canManage) {
    return {
      ok: false,
      status: 403,
      error: 'Forbidden - insufficient organization permissions',
      code: 'HISTORICAL_SYNC_FORBIDDEN',
    };
  }

  const connection = await getConnectionStatus(organizationId);
  if (!connection.connected) {
    return {
      ok: false,
      status: 409,
      error: 'Accounting is not connected',
      code: 'HISTORICAL_SYNC_NOT_CONNECTED',
    };
  }

  return { ok: true, userId: params.userId, organizationId };
}

async function fetchHistoricalPaymentLinks(organizationId: string) {
  return prisma.payment_links.findMany({
    where: {
      organization_id: organizationId,
      status: { notIn: ['DRAFT', 'CANCELED'] },
    },
    select: {
      id: true,
      status: true,
      invoice_reference: true,
      short_code: true,
      customer_name: true,
      customer_email: true,
      invoice_date: true,
      created_at: true,
      amount: true,
      invoice_currency: true,
      currency: true,
      settlement_amount: true,
      xero_syncs: {
        select: {
          sync_type: true,
          status: true,
          xero_invoice_id: true,
          xero_payment_id: true,
          error_message: true,
        },
      },
    },
    orderBy: { created_at: 'desc' },
  });
}

export async function previewHistoricalAccountingSync(
  organizationId: string
): Promise<HistoricalSyncPreview> {
  const links = await fetchHistoricalPaymentLinks(organizationId);
  return buildHistoricalSyncPreview(links, formatAmount);
}

export async function executeHistoricalAccountingSync(params: {
  userId: string;
  organizationId: string;
  paymentLinkIds?: string[];
  syncAll?: boolean;
}): Promise<HistoricalSyncExecuteResult> {
  const runId = randomUUID();
  const preview = await previewHistoricalAccountingSync(params.organizationId);
  const selected = selectHistoricalSyncItems(preview, {
    paymentLinkIds: params.paymentLinkIds,
    syncAll: params.syncAll,
  });

  const details: HistoricalSyncExecuteResult['details'] = [];
  let queued = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of selected) {
    const syncTypes = syncTypesToQueueForItem(item);
    if (syncTypes.length === 0) {
      skipped += 1;
      continue;
    }

    for (const syncType of syncTypes) {
      try {
        const syncId = await queueXeroSync({
          paymentLinkId: item.paymentLinkId,
          organizationId: params.organizationId,
          syncType,
        });
        details.push({
          paymentLinkId: item.paymentLinkId,
          syncType,
          success: true,
          syncId,
        });
        queued += 1;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        details.push({
          paymentLinkId: item.paymentLinkId,
          syncType,
          success: false,
          error: message,
        });
        failed += 1;
      }
    }
  }

  try {
    await prisma.audit_logs.create({
      data: {
        organization_id: params.organizationId,
        user_id: params.userId,
        entity_type: 'HistoricalAccountingSync',
        entity_id: runId,
        action: 'HISTORICAL_ACCOUNTING_SYNC_EXECUTED',
        new_values: {
          organizationId: params.organizationId,
          selectedCount: selected.length,
          queued,
          skipped,
          failed,
          syncAll: Boolean(params.syncAll),
          runId,
        },
      },
    });
  } catch {
    // Non-blocking
  }

  return { queued, skipped, failed, details };
}
