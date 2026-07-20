import 'server-only';

import { PaymentEventSourceType, PaymentEventType } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import config from '@/lib/config/env';
import { runIntegrityChecks } from '@/lib/payments/integrity-checks';
import { isXeroConfigured, getConnectionStatus } from '@/lib/xero';
import { isStripeWebhookSecretValid } from '@/lib/config/production-env-guards';
import { evaluatePilotEnvironment, derivePilotReadiness } from './evaluate-pilot-environment';
import { isWiseAutoSettlementAvailable } from './wise-auto-settlement';
import { resolvePilotOrganizationId } from './resolve-pilot-organization.server';
import type {
  PilotHealth,
  PilotLedgerStatus,
  PilotMonitoringStatus,
  PilotRailStatus,
  PilotReadinessSnapshot,
  PilotXeroStatus,
} from './types';

const STRIPE_PAYMENT_EVENT_TYPES: PaymentEventType[] = [
  PaymentEventType.PAYMENT_INITIATED,
  PaymentEventType.PAYMENT_CONFIRMED,
];

const PILOT_XERO_MAPPING_FIELDS = [
  { key: 'xero_revenue_account_id', label: 'Revenue account' },
  { key: 'xero_receivable_account_id', label: 'Receivable account' },
  { key: 'xero_stripe_clearing_account_id', label: 'Stripe clearing account' },
] as const;

function toHealth(ok: boolean, degraded = false): PilotHealth {
  if (ok) return 'healthy';
  if (degraded) return 'degraded';
  return 'unhealthy';
}

async function buildRailStatuses(organizationId: string | null): Promise<PilotRailStatus[]> {
  const wiseAuto = isWiseAutoSettlementAvailable();

  const [
    lastStripePayment,
    lastStripeWebhook,
    lastHederaPayment,
    lastWisePayment,
    lastEvmPayment,
    merchant,
  ] = await Promise.all([
    prisma.payment_events.findFirst({
      where: { payment_method: 'STRIPE', event_type: PaymentEventType.PAYMENT_CONFIRMED },
      orderBy: { created_at: 'desc' },
      select: { created_at: true },
    }),
    prisma.payment_events.findFirst({
      where: {
        source_type: PaymentEventSourceType.STRIPE,
        event_type: { in: STRIPE_PAYMENT_EVENT_TYPES },
      },
      orderBy: { created_at: 'desc' },
      select: { created_at: true },
    }),
    prisma.payment_events.findFirst({
      where: { payment_method: 'HEDERA', event_type: PaymentEventType.PAYMENT_CONFIRMED },
      orderBy: { created_at: 'desc' },
      select: { created_at: true },
    }),
    prisma.payment_events.findFirst({
      where: { payment_method: 'WISE', event_type: PaymentEventType.PAYMENT_CONFIRMED },
      orderBy: { created_at: 'desc' },
      select: { created_at: true },
    }),
    prisma.payment_events.findFirst({
      where: { payment_method: 'EVM_WALLET', event_type: PaymentEventType.PAYMENT_CONFIRMED },
      orderBy: { created_at: 'desc' },
      select: { created_at: true },
    }),
    organizationId
      ? prisma.merchant_settings.findFirst({
          where: { organization_id: organizationId },
          select: {
            stripe_account_id: true,
            hedera_account_id: true,
            evm_wallet_enabled: true,
            evm_wallet_address: true,
            wise_enabled: true,
            wise_profile_id: true,
          },
        })
      : Promise.resolve(null),
  ]);

  const stripeEnvOk =
    !!config.stripe.secretKey?.trim() &&
    !!config.stripe.publishableKey?.trim() &&
    isStripeWebhookSecretValid(config.stripe.webhookSecret);
  const stripeMerchantOk = !!merchant?.stripe_account_id;

  return [
    {
      rail: 'stripe',
      enabled: true,
      configured: stripeEnvOk && stripeMerchantOk,
      health: toHealth(stripeEnvOk && stripeMerchantOk),
      lastPaymentAt: lastStripePayment?.created_at?.toISOString() ?? null,
      lastWebhookAt: lastStripeWebhook?.created_at?.toISOString() ?? null,
      detail: stripeMerchantOk ? null : 'Merchant Stripe account not connected',
    },
    {
      rail: 'hedera',
      enabled: config.features.hederaPayments,
      configured: !!merchant?.hedera_account_id,
      health: config.features.hederaPayments
        ? toHealth(!!merchant?.hedera_account_id)
        : 'disabled',
      lastPaymentAt: lastHederaPayment?.created_at?.toISOString() ?? null,
      lastWebhookAt: null,
      detail: config.features.hederaPayments ? null : 'Week 2 rail',
    },
    {
      rail: 'metamask',
      enabled: config.features.evmWalletPayments,
      configured:
        !!merchant?.evm_wallet_enabled &&
        !!merchant?.evm_wallet_address?.trim(),
      health: config.features.evmWalletPayments
        ? toHealth(
            !!merchant?.evm_wallet_enabled && !!merchant?.evm_wallet_address?.trim()
          )
        : 'disabled',
      lastPaymentAt: lastEvmPayment?.created_at?.toISOString() ?? null,
      lastWebhookAt: null,
      detail: config.features.evmWalletPayments ? null : 'Week 2 rail',
    },
    {
      rail: 'wise',
      enabled: config.features.wisePayments && wiseAuto,
      configured:
        !!merchant?.wise_enabled &&
        !!merchant?.wise_profile_id &&
        wiseAuto,
      health:
        !config.features.wisePayments || !wiseAuto
          ? 'disabled'
          : toHealth(!!merchant?.wise_enabled && !!merchant?.wise_profile_id),
      lastPaymentAt: lastWisePayment?.created_at?.toISOString() ?? null,
      lastWebhookAt: null,
      detail: wiseAuto
        ? null
        : 'Auto-matching unavailable for pilot — use Stripe',
    },
  ];
}

async function buildXeroStatus(organizationId: string | null): Promise<{
  status: PilotXeroStatus;
  healthy: boolean;
  reasons: string[];
}> {
  const reasons: string[] = [];
  if (!isXeroConfigured()) {
    return {
      status: {
        connected: false,
        health: 'unhealthy',
        lastInvoiceSyncAt: null,
        lastPaymentSyncAt: null,
        failedSyncCount: 0,
        pendingSyncCount: 0,
        mappingComplete: false,
        mappingMissing: PILOT_XERO_MAPPING_FIELDS.map((f) => f.label),
      },
      healthy: false,
      reasons: ['Xero OAuth credentials not configured on server'],
    };
  }

  if (!organizationId) {
    reasons.push('Workspace not selected — choose an organization to inspect');
    return {
      status: {
        connected: false,
        health: 'unknown',
        lastInvoiceSyncAt: null,
        lastPaymentSyncAt: null,
        failedSyncCount: 0,
        pendingSyncCount: 0,
        mappingComplete: false,
        mappingMissing: PILOT_XERO_MAPPING_FIELDS.map((f) => f.label),
      },
      healthy: false,
      reasons,
    };
  }

  const connection = await getConnectionStatus(organizationId);
  const merchant = await prisma.merchant_settings.findFirst({
    where: { organization_id: organizationId },
    select: {
      xero_revenue_account_id: true,
      xero_receivable_account_id: true,
      xero_stripe_clearing_account_id: true,
    },
  });

  const mappingMissing = PILOT_XERO_MAPPING_FIELDS.filter(
    (field) => !merchant?.[field.key as keyof typeof merchant]?.toString().trim()
  ).map((f) => f.label);

  const orgLinkIds = await prisma.payment_links.findMany({
    where: { organization_id: organizationId },
    select: { id: true },
    take: 500,
  });
  const linkIds = orgLinkIds.map((l) => l.id);

  const [lastInvoice, lastPayment, failedCount, pendingCount] = await Promise.all([
    linkIds.length
      ? prisma.xero_syncs.findFirst({
          where: { payment_link_id: { in: linkIds }, sync_type: 'INVOICE', status: 'SUCCESS' },
          orderBy: { updated_at: 'desc' },
          select: { updated_at: true },
        })
      : Promise.resolve(null),
    linkIds.length
      ? prisma.xero_syncs.findFirst({
          where: { payment_link_id: { in: linkIds }, sync_type: 'PAYMENT', status: 'SUCCESS' },
          orderBy: { updated_at: 'desc' },
          select: { updated_at: true },
        })
      : Promise.resolve(null),
    linkIds.length
      ? prisma.xero_syncs.count({
          where: { payment_link_id: { in: linkIds }, status: 'FAILED' },
        })
      : Promise.resolve(0),
    linkIds.length
      ? prisma.xero_syncs.count({
          where: {
            payment_link_id: { in: linkIds },
            status: { in: ['PENDING', 'RETRYING'] },
          },
        })
      : Promise.resolve(0),
  ]);

  if (!connection.connected) reasons.push('Xero not connected for pilot organization');
  if (mappingMissing.length > 0) {
    reasons.push(`Xero account mappings missing: ${mappingMissing.join(', ')}`);
  }

  const healthy = connection.connected && mappingMissing.length === 0;

  return {
    status: {
      connected: connection.connected,
      health: toHealth(healthy, connection.connected && mappingMissing.length > 0),
      lastInvoiceSyncAt: lastInvoice?.updated_at?.toISOString() ?? null,
      lastPaymentSyncAt: lastPayment?.updated_at?.toISOString() ?? null,
      failedSyncCount: failedCount,
      pendingSyncCount: pendingCount,
      mappingComplete: mappingMissing.length === 0,
      mappingMissing,
    },
    healthy,
    reasons,
  };
}

async function buildLedgerStatus(organizationId: string | null): Promise<{
  status: PilotLedgerStatus;
  healthy: boolean;
  reasons: string[];
}> {
  const integrity = await runIntegrityChecks();
  const criticalCount =
    integrity.settlementIssues.filter((i) => i.severity === 'critical').length +
    integrity.ledgerIssues.filter((i) => i.severity === 'critical').length +
    integrity.xeroIssues.filter((i) => i.severity === 'critical').length +
    integrity.duplicateRisks.filter((i) => i.severity === 'critical').length;

  const settlementFailures = integrity.settlementIssues.length;
  const duplicateSettlements = integrity.duplicateRisks.length;

  const outstandingWhere = organizationId
    ? { organization_id: organizationId, status: 'OPEN' as const }
    : { status: 'OPEN' as const };

  const outstandingInvoices = await prisma.payment_links.count({ where: outstandingWhere });

  const reasons: string[] = [];
  if (criticalCount > 0) {
    reasons.push(`${criticalCount} critical ledger/settlement integrity issue(s)`);
  }
  if (duplicateSettlements > 0) {
    reasons.push(`${duplicateSettlements} duplicate settlement risk(s)`);
  }

  const healthy = criticalCount === 0;

  return {
    status: {
      health: toHealth(healthy, criticalCount === 0 && settlementFailures > 0),
      outstandingInvoices,
      settlementFailures,
      duplicateSettlements,
      balanceStatus: healthy ? 'balanced' : 'imbalanced',
      criticalIssues: criticalCount,
    },
    healthy,
    reasons,
  };
}

async function buildMonitoringStatus(): Promise<PilotMonitoringStatus> {
  const [failedWebhooks, retryQueueDepth, recentErrors] = await Promise.all([
    prisma.webhook_events.count({
      where: { provider: 'STRIPE', status: 'ERROR' },
    }),
    prisma.xero_syncs.count({
      where: { status: { in: ['RETRYING', 'PENDING'] } },
    }),
    prisma.webhook_events.findMany({
      where: { status: 'ERROR' },
      orderBy: { received_at: 'desc' },
      take: 5,
      select: { event_type: true, last_error: true, received_at: true },
    }),
  ]);

  const env = evaluatePilotEnvironment();
  const cronStatus: PilotHealth = env.cronConfigured ? 'healthy' : 'unhealthy';

  return {
    latestErrors: recentErrors.map((row) => ({
      message: row.last_error || row.event_type,
      at: row.received_at.toISOString(),
    })),
    latestWarnings: [],
    cronStatus,
    webhookFailures: failedWebhooks,
    retryQueueDepth,
  };
}

export async function collectPilotReadinessSnapshot(input?: {
  organizationId?: string | null;
  userId?: string | null;
}): Promise<PilotReadinessSnapshot> {
  const environment = evaluatePilotEnvironment();
  const { organizationId: resolvedOrgId } = await resolvePilotOrganizationId({
    explicitOrgId: input?.organizationId,
    userId: input?.userId,
  });

  const [rails, xeroResult, ledgerResult, monitoring, merchant, org] = await Promise.all([
    buildRailStatuses(resolvedOrgId),
    buildXeroStatus(resolvedOrgId),
    buildLedgerStatus(resolvedOrgId),
    buildMonitoringStatus(),
    resolvedOrgId
      ? prisma.merchant_settings.findFirst({
          where: { organization_id: resolvedOrgId },
          select: { stripe_account_id: true, display_name: true },
        })
      : Promise.resolve(null),
    resolvedOrgId
      ? prisma.organizations.findUnique({
          where: { id: resolvedOrgId },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
  ]);

  const stripeRail = rails.find((r) => r.rail === 'stripe');
  const stripeHealthy = stripeRail?.health === 'healthy';
  const stripeReasons = stripeHealthy
    ? []
    : [stripeRail?.detail ?? 'Stripe rail unhealthy'].filter(Boolean) as string[];

  const workspaceReasons: string[] = [];
  if (!resolvedOrgId) {
    workspaceReasons.push(
      'No workspace selected — join an organization, pick one from the dropdown, or complete onboarding'
    );
  }
  if (!merchant?.stripe_account_id) {
    workspaceReasons.push('Merchant Stripe account not connected');
  }

  const workspaceReady = !!resolvedOrgId && !!merchant?.stripe_account_id;

  const readiness = derivePilotReadiness({
    environment,
    stripeHealthy,
    stripeReasons,
    xeroHealthy: xeroResult.healthy,
    xeroReasons: xeroResult.reasons,
    ledgerHealthy: ledgerResult.healthy,
    ledgerReasons: ledgerResult.reasons,
    failedSyncCount: xeroResult.status.failedSyncCount,
    workspaceReady,
    workspaceReasons,
  });

  return {
    checkedAt: new Date().toISOString(),
    environment,
    rails,
    xero: xeroResult.status,
    ledger: ledgerResult.status,
    monitoring,
    workspace: {
      organizationFound: !!resolvedOrgId,
      organizationId: resolvedOrgId,
      organizationName: org?.name ?? null,
      merchantConfigured: !!merchant,
      stripeConnected: !!merchant?.stripe_account_id,
    },
    pilotStatus: readiness.pilotStatus,
    blockingReasons: readiness.blockingReasons,
  };
}
