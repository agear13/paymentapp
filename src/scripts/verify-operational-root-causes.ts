/**
 * Read-only verification pass for operational root causes.
 * Usage: npx tsx scripts/verify-operational-root-causes.ts [--userId=<uuid>] [--baseUrl=http://127.0.0.1:3000]
 *
 * Does NOT modify business logic or persisted data.
 */
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { performance } from 'node:perf_hooks';
import { render } from '@testing-library/react';
import * as React from 'react';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
loadEnv({ path: resolve(process.cwd(), '../.env.local') });

type TimedPhase = {
  phase: string;
  durationMs: number;
  dbQueryCount: number;
};

function createQueryCounter() {
  const state = { count: 0 };
  return {
    reset() {
      state.count = 0;
    },
    snapshot() {
      return state.count;
    },
    increment() {
      state.count += 1;
    },
  };
}

function trackQueries(client: PrismaClient, counter: ReturnType<typeof createQueryCounter>): PrismaClient {
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ query, args }) {
          counter.increment();
          return query(args);
        },
      },
    },
  }) as unknown as PrismaClient;
}

async function timePhase(
  counter: ReturnType<typeof createQueryCounter>,
  phase: string,
  fn: () => Promise<void>
): Promise<TimedPhase> {
  counter.reset();
  const start = performance.now();
  await fn();
  return {
    phase,
    durationMs: Math.round(performance.now() - start),
    dbQueryCount: counter.snapshot(),
  };
}

async function simulateActivationRoute(
  prisma: PrismaClient,
  counter: ReturnType<typeof createQueryCounter>,
  userId: string
): Promise<TimedPhase[]> {
  const phases: TimedPhase[] = [];

  const {
    resolveOperationalInitializationSnapshot,
  } = await import('../lib/operations/onboarding/run-operational-initialization-convergence.server');
  const { getOrganizationForAuthenticatedUser } = await import('../lib/auth/get-org');
  const { getPilotSnapshotForUser } = await import('../lib/deal-network-demo/pilot-snapshot.server');
  const { resolveOperationalCoordinationSnapshot } = await import(
    '../lib/operations/selectors/resolve-operational-coordination.server'
  );

  phases.push(
    await timePhase(counter, 'activation:initialization', async () => {
      const org = await getOrganizationForAuthenticatedUser(userId);
      if (!org) return;
      await resolveOperationalInitializationSnapshot({
        userId,
        organizationId: org.id,
      });
    })
  );

  phases.push(
    await timePhase(counter, 'activation:pilot-snapshot+parallel-db', async () => {
      const org = await getOrganizationForAuthenticatedUser(userId);
      if (!org) return;
      await Promise.all([
        prisma.merchant_settings.findFirst({ where: { organization_id: org.id } }),
        getPilotSnapshotForUser(userId).catch(() => ({ deals: [], participants: [] })),
        prisma.payment_links.count({ where: { organization_id: org.id } }).catch(() => 0),
        prisma.payout_batches.count({ where: { organization_id: org.id } }).catch(() => 0),
      ]);
    })
  );

  phases.push(
    await timePhase(counter, 'activation:graph-build', async () => {
      const snapshot = await getPilotSnapshotForUser(userId).catch(() => ({
        deals: [],
        participants: [],
      }));
      const projectId = snapshot.deals[0]?.id ?? null;
      await resolveOperationalCoordinationSnapshot({
        userId,
        projectId,
        participants: snapshot.participants,
      });
    })
  );

  return phases;
}

async function simulateCoordinationSnapshotRoute(
  prisma: PrismaClient,
  counter: ReturnType<typeof createQueryCounter>,
  userId: string,
  includeInitialization: boolean
): Promise<TimedPhase[]> {
  const phases: TimedPhase[] = [];
  const label = includeInitialization ? 'with-init' : 'without-init';

  const { getOrganizationForAuthenticatedUser } = await import('../lib/auth/get-org');
  const { getPilotSnapshotForUser } = await import('../lib/deal-network-demo/pilot-snapshot.server');
  const { resolveOperationalCoordinationSnapshot } = await import(
    '../lib/operations/selectors/resolve-operational-coordination.server'
  );
  const { resolveOperationalInitializationSnapshot } = await import(
    '../lib/operations/onboarding/run-operational-initialization-convergence.server'
  );
  const { listOperationalTransitions } = await import(
    '../lib/operations/onboarding/persist-operational-transition.server'
  );

  phases.push(
    await timePhase(counter, `coordination-snapshot(${label}):pilot-snapshot`, async () => {
      await getPilotSnapshotForUser(userId).catch(() => ({ deals: [], participants: [] }));
    })
  );

  if (includeInitialization) {
    phases.push(
      await timePhase(counter, `coordination-snapshot(${label}):initialization`, async () => {
        const org = await getOrganizationForAuthenticatedUser(userId);
        if (!org) return;
        await resolveOperationalInitializationSnapshot({
          userId,
          organizationId: org.id,
        });
      })
    );
  }

  phases.push(
    await timePhase(counter, `coordination-snapshot(${label}):graph-build`, async () => {
      const snapshot = await getPilotSnapshotForUser(userId).catch(() => ({
        deals: [],
        participants: [],
      }));
      const projectId = snapshot.deals[0]?.id ?? undefined;
      await resolveOperationalCoordinationSnapshot({ userId, projectId });
    })
  );

  phases.push(
    await timePhase(counter, `coordination-snapshot(${label}):transitions`, async () => {
      const org = await getOrganizationForAuthenticatedUser(userId);
      if (!org) return;
      await listOperationalTransitions({ organizationId: org.id });
    })
  );

  return phases;
}

async function simulateObligationsRoute(
  prisma: PrismaClient,
  counter: ReturnType<typeof createQueryCounter>,
  userId: string
): Promise<TimedPhase[]> {
  return [
    await timePhase(counter, 'obligations:list-query', async () => {
      await prisma.deal_network_pilot_obligations.findMany({
        where: { user_id: userId },
        orderBy: [{ deal_id: 'asc' }, { created_at: 'asc' }],
        include: {
          deal: { select: { id: true, name: true, partner: true } },
          participant: {
            select: {
              id: true,
              name: true,
              role: true,
              email: true,
              participant_payload: true,
            },
          },
          payment_event: {
            select: {
              id: true,
              source_type: true,
              payment_link_id: true,
              event_type: true,
              gross_amount: true,
              amount_received: true,
              currency_received: true,
              received_at: true,
            },
          },
        },
      });
    }),
  ];
}

async function verifyParticipantPersistence(prisma: PrismaClient) {
  const { participantRowToDemo } = await import('../lib/deal-network-demo/pilot-snapshot.server');
  const { buildParticipantEarningsPersistenceDiagnostic } = await import(
    '../lib/operations/dev/participant-earnings-persistence-diagnostic'
  );
  const { hasPersistedCompensationTerms } = await import(
    '../lib/operations/primitives/participant-earnings-primitives'
  );

  const rows = await prisma.deal_network_pilot_participants.findMany({
    where: {
      OR: [
        { name: { contains: 'DJ Alex', mode: 'insensitive' } },
        { name: { contains: 'Coastal Media', mode: 'insensitive' } },
        { name: { contains: 'Beach Club Bali', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      approval_status: true,
      participant_payload: true,
      deal_id: true,
    },
    orderBy: { name: 'asc' },
    take: 20,
  });

  return rows.map((row) => {
    const participant = participantRowToDemo(row);
    const payload = row.participant_payload as Record<string, unknown> | null;
    const profile = payload?.compensationProfile as Record<string, unknown> | undefined;
    const diagnostic = buildParticipantEarningsPersistenceDiagnostic(participant);
    const configured = hasPersistedCompensationTerms(participant);

    let persistenceVerdict: 'a_save_never_occurred' | 'b_save_failed' | 'c_persisted_selector_false' | 'configured';
    if (configured) {
      persistenceVerdict = 'configured';
    } else if (!profile) {
      persistenceVerdict = 'a_save_never_occurred';
    } else if (profile.configured === true || profile.configuredAt) {
      persistenceVerdict = 'c_persisted_selector_false';
    } else {
      persistenceVerdict = 'a_save_never_occurred';
    }

    return {
      participantId: row.id,
      name: row.name,
      dealId: row.deal_id,
      approvalStatus: row.approval_status,
      compensationProfileExists: profile != null,
      configuredAt: (profile?.configuredAt as string | undefined) ?? null,
      configuredFlag: (profile?.configured as boolean | undefined) ?? null,
      compensationType: (profile?.compensationType as string | undefined) ?? null,
      fixedAmount: (profile?.fixedAmount as number | undefined) ?? null,
      percentage: (profile?.percentage as number | undefined) ?? null,
      commissionValue: participant.commissionValue ?? null,
      earningsStructure: diagnostic.earningsStructure,
      hasPersistedCompensationTerms: configured,
      selectorResult: diagnostic.selectorResult,
      persistenceVerdict,
    };
  });
}

async function verifyAgreementPreviewRender() {
  const { ParticipantAttributionAgreementSummary } = await import(
    '../components/projects/participant-attribution-agreement-summary'
  );
  type DemoParticipant = import('../components/deal-network-demo/invite-participant-modal').DemoParticipant;

  const participant: DemoParticipant = {
    id: 'verify-p1',
    name: 'Verify Alex',
    email: 'alex@example.com',
    role: 'Contributor',
    commissionKind: 'pct_deal_value',
    commissionValue: 10,
    status: 'Pending',
    approvalStatus: 'Pending approval',
    inviteToken: 'tok-verify',
    compensationProfile: {
      compensationType: 'COMMISSION',
      configured: true,
      percentage: 10,
      customerAttributionEnabled: true,
      commissionSourceMode: 'selected',
      commissionServiceIds: ['svc-1'],
    },
    referralCommerce: {
      commissionMode: 'referral_commerce',
      commerceCommissionPct: 10,
      enabledServiceIds: ['svc-1'],
    },
  };

  const serviceRows = [
    {
      id: 'svc-1',
      name: 'Early Bird Tickets',
      customerPrice: 100,
      currency: 'AUD',
      revenueSharePct: 10,
      estimatedEarnings: 10,
      earningsLabel: 'A$10.00',
    },
  ];

  const before = render(
    React.createElement(ParticipantAttributionAgreementSummary, {
      participant,
      commerce: participant.referralCommerce,
      approved: false,
      catalogItems: [{ id: 'svc-1', name: 'Early Bird Tickets', price: 100, currency: 'AUD' }],
      serviceRows,
    })
  );

  const after = render(
    React.createElement(ParticipantAttributionAgreementSummary, {
      participant: { ...participant, approvalStatus: 'Approved' },
      commerce: participant.referralCommerce,
      approved: true,
      catalogItems: [{ id: 'svc-1', name: 'Early Bird Tickets', price: 100, currency: 'AUD' }],
      serviceRows,
    })
  );

  const assertVisible = (text: string, label: string) => ({
    label,
    serviceName: text.includes('Early Bird Tickets'),
    price: text.includes('100') || text.includes('A$100'),
    commissionPct: text.includes('10%'),
    estimatedEarnings: text.includes('A$10') || text.includes('10.00'),
  });

  const beforeText = before.container.textContent ?? '';
  const afterText = after.container.textContent ?? '';

  return {
    beforeApproval: {
      ...assertVisible(beforeText, 'before'),
      attributionGatedCopy: beforeText.includes('activate after you approve'),
      activeTrackingCopy: beforeText.includes('Active tracking is enabled'),
      renderExcerpt: beforeText.replace(/\s+/g, ' ').trim().slice(0, 500),
    },
    afterApproval: {
      ...assertVisible(afterText, 'after'),
      attributionGatedCopy: afterText.includes('activate after you approve'),
      activeTrackingCopy: afterText.includes('Active tracking is enabled'),
      renderExcerpt: afterText.replace(/\s+/g, ' ').trim().slice(0, 500),
    },
  };
}

async function fetchLiveTimings(baseUrl: string, cookie?: string) {
  const routes = [
    '/api/workspace/activation',
    '/api/operations/coordination-snapshot',
    '/api/deal-network-pilot/obligations',
  ];
  const results: Array<{ route: string; status: number; durationMs: number; contentType: string | null; isJson: boolean }> = [];

  for (const route of routes) {
    const start = performance.now();
    try {
      const res = await fetch(`${baseUrl}${route}`, {
        cache: 'no-store',
        headers: cookie ? { cookie } : undefined,
      });
      const text = await res.text();
      results.push({
        route,
        status: res.status,
        durationMs: Math.round(performance.now() - start),
        contentType: res.headers.get('content-type'),
        isJson: text.trimStart().startsWith('{') || text.trimStart().startsWith('['),
      });
    } catch (error) {
      results.push({
        route,
        status: 0,
        durationMs: Math.round(performance.now() - start),
        contentType: null,
        isJson: false,
      });
    }
  }

  return results;
}

async function resolveUserId(prisma: PrismaClient, argUserId?: string): Promise<string | null> {
  if (argUserId) return argUserId;
  const row = await prisma.deal_network_pilot_participants.findFirst({
    select: { user_id: true },
    orderBy: { updated_at: 'desc' },
  });
  return row?.user_id ?? null;
}

async function main() {
  const args = process.argv.slice(2);
  const userIdArg = args.find((a) => a.startsWith('--userId='))?.split('=')[1];
  const baseUrl = args.find((a) => a.startsWith('--baseUrl='))?.split('=')[1];
  const skipDb = args.includes('--skip-db');

  const report: Record<string, unknown> = {
    verifiedAt: new Date().toISOString(),
    environment: {
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
      nodeEnv: process.env.NODE_ENV ?? 'development',
    },
  };

  report.agreementPreview = {
    note: 'Run: npm run verify:operational-root-causes:test for jsdom render traces',
  };

  if (skipDb || !process.env.DATABASE_URL) {
    report.participantPersistence = {
      skipped: true,
      reason: skipDb ? '--skip-db' : 'DATABASE_URL not set',
    };
    report.apiSimulation = { skipped: true, reason: 'Database unavailable' };
  } else {
    const baseClient = new PrismaClient({ log: ['error'] });
    const counter = createQueryCounter();
    const prisma = trackQueries(baseClient, counter);

    try {
      const tableExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'deal_network_pilot_participants'
        ) AS exists
      `;
      report.pilotParticipantsTableExists = tableExists[0]?.exists === true;
      report.databaseConnected = true;

      if (!report.pilotParticipantsTableExists) {
        report.participantPersistence = {
          error: 'deal_network_pilot_participants table not present in connected database',
        };
      } else {
        report.participantPersistence = await verifyParticipantPersistence(prisma);
      }

      const userId = report.pilotParticipantsTableExists
        ? await resolveUserId(prisma, userIdArg)
        : userIdArg ?? null;

      if (userId) {
        report.apiSimulation = {
          userId,
          activation: await simulateActivationRoute(prisma, counter, userId),
          coordinationSnapshotDefault: await simulateCoordinationSnapshotRoute(
            prisma,
            counter,
            userId,
            false
          ),
          coordinationSnapshotWithInit: await simulateCoordinationSnapshotRoute(
            prisma,
            counter,
            userId,
            true
          ),
          obligations: await simulateObligationsRoute(prisma, counter, userId),
        };

        const activationTotal = (report.apiSimulation as { activation: TimedPhase[] }).activation.reduce(
          (sum, p) => sum + p.durationMs,
          0
        );
        const coordDefaultTotal = (
          report.apiSimulation as { coordinationSnapshotDefault: TimedPhase[] }
        ).coordinationSnapshotDefault.reduce((sum, p) => sum + p.durationMs, 0);
        const coordWithInitTotal = (
          report.apiSimulation as { coordinationSnapshotWithInit: TimedPhase[] }
        ).coordinationSnapshotWithInit.reduce((sum, p) => sum + p.durationMs, 0);

        report.apiSimulationSummary = {
          activationTotalMs: activationTotal,
          coordinationSnapshotDefaultTotalMs: coordDefaultTotal,
          coordinationSnapshotWithInitTotalMs: coordWithInitTotal,
          initDuplicationDeltaMs: coordWithInitTotal - coordDefaultTotal,
          pageLoadEstimateMs: activationTotal + coordDefaultTotal,
          pageLoadEstimateWithDuplicateInitMs: activationTotal + coordWithInitTotal,
        };
      } else {
        report.apiSimulation = { skipped: 'No userId found' };
      }
    } catch (error) {
      report.databaseConnected = false;
      report.databaseError = error instanceof Error ? error.message : String(error);
      report.participantPersistence = { skipped: true, reason: 'Database connection failed' };
      report.apiSimulation = { skipped: true, reason: 'Database connection failed' };
    } finally {
      await baseClient.$disconnect();
    }
  }

  if (baseUrl) {
    report.liveHttpTimings = await fetchLiveTimings(baseUrl);
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error('Verification failed:', error);
  process.exit(1);
});
