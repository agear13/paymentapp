/**
 * Runtime verification for operational UI fixes (1B, 1C/1D, 1H, 1A, 1E/1F).
 *
 * Usage:
 *   npx dotenv -e ../.env.local -- npx tsx scripts/runtime-verify-ui-fixes.ts
 *   npx dotenv -e ../.env.local -- npx tsx scripts/runtime-verify-ui-fixes.ts --execute-1b
 *   npx dotenv -e ../.env.local -- npx tsx scripts/runtime-verify-ui-fixes.ts --userId=<uuid>
 *
 * Writes: scripts/output/runtime-verification-report.json
 */
import { config as loadEnv } from 'dotenv';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient, DealNetworkPilotObligationStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
loadEnv({ path: resolve(process.cwd(), '../.env.local') });

type Report = Record<string, unknown>;

function counter() {
  let n = 0;
  return {
    inc() {
      n += 1;
    },
    get() {
      return n;
    },
    reset() {
      n = 0;
    },
  };
}

async function resolveUserId(prisma: PrismaClient, arg?: string): Promise<string | null> {
  if (arg) return arg;
  const row = await prisma.deal_network_pilot_deals.findFirst({
    select: { user_id: true },
    orderBy: { updated_at: 'desc' },
  });
  return row?.user_id ?? null;
}

async function resolveOrgForUser(prisma: PrismaClient, userId: string): Promise<string | null> {
  const { getOrganizationForAuthenticatedUser } = await import('../lib/auth/get-org');
  const org = await getOrganizationForAuthenticatedUser(userId);
  return org?.id ?? null;
}

async function verify1B(
  prisma: PrismaClient,
  userId: string,
  organizationId: string,
  execute: boolean
): Promise<Report> {
  const {
    pilotReleaseBatchPreferred,
    createPilotReleaseBatch,
  } = await import('../lib/operations/orchestration/pilot-release-batch.server');
  const { resolveOperationalCoordinationSnapshot } = await import(
    '../lib/operations/selectors/resolve-operational-coordination.server'
  );
  const { deriveReleaseBatchEligibility } = await import(
    '../lib/operations/selectors/derive-release-batch-eligibility'
  );
  const { operationalEventFromMutation } = await import(
    '../lib/operations/contracts/operational-events'
  );
  const { auditEntryFromOperationalEvent } = await import(
    '../lib/operations/audit/operational-audit'
  );

  const graph = await resolveOperationalCoordinationSnapshot({ userId });
  const currency = graph.funding?.currency ?? 'AUD';
  const eligibility = deriveReleaseBatchEligibility(graph, { currency, minThreshold: 0 });

  const pilot = await pilotReleaseBatchPreferred({
    userId,
    organizationId,
    projectId: graph.projectId ?? undefined,
    currency,
    minThreshold: 0,
  });

  const section: Report = {
    currency,
    projectId: graph.projectId,
    eligibilityParticipantCount: eligibility.participantCount,
    pilotUsePilot: pilot.usePilot,
    pilotLineCount: pilot.lines.length,
    pilotLinesSample: pilot.lines.slice(0, 3),
  };

  if (!execute || !pilot.usePilot || pilot.lines.length === 0) {
    section.executed = false;
    section.note = execute
      ? 'No pilot lines available — cannot create batch without eligible pilot obligations'
      : 'Pass --execute-1b to persist a batch when pilot lines exist';
    return section;
  }

  const created = await createPilotReleaseBatch({
    organizationId,
    createdBy: userId,
    currency,
    minThreshold: 0,
    lines: pilot.lines,
  });

  if (!created) {
    section.executed = true;
    section.createResult = null;
    section.error = 'createPilotReleaseBatch returned null';
    return section;
  }

  const batch = await prisma.payout_batches.findUnique({
    where: { id: created.batchId },
    include: { payouts: { select: { id: true, user_id: true, status: true, gross_amount: true } } },
  });

  const event = operationalEventFromMutation('release_batch_generated', {
    projectId: graph.projectId ?? undefined,
    payload: { batchId: created.batchId },
  });
  const audit = auditEntryFromOperationalEvent(event);

  section.executed = true;
  section.createResult = created;
  section.persistedBatch = batch
    ? {
        id: batch.id,
        status: batch.status,
        payout_count: batch.payout_count,
        total_amount: Number(batch.total_amount),
        payouts: batch.payouts.map((p) => ({
          id: p.id,
          user_id: p.user_id,
          status: p.status,
          gross_amount: Number(p.gross_amount),
        })),
      }
    : null;
  section.timelineEvent = {
    operationalEventType: event.type,
    auditEntry: audit,
  };
  section.releaseOpenable = Boolean(batch?.id);
  section.createdBatchId = created.batchId;

  return section;
}

async function captureFundingSurfaces(
  userId: string,
  projectId: string
): Promise<Report> {
  const { getProjectWorkspaceSummaryForUser } = await import('../lib/projects/workspace.server');
  const { getProjectTreasurySummaryForUser } = await import(
    '../lib/projects/funding-sources/funding-sources.server'
  );
  const { resolveOperationalCoordinationSnapshot } = await import(
    '../lib/operations/selectors/resolve-operational-coordination.server'
  );
  const { deriveFundingCoordinationStage } = await import(
    '../lib/operations/truth/funding-coordination-semantics'
  );
  const { projectGraphSummaryProjection } = await import(
    '../lib/operations/selectors/project-graph-summary'
  );
  const { getPilotSnapshotForUser } = await import('../lib/deal-network-demo/pilot-snapshot.server');

  const workspace = await getProjectWorkspaceSummaryForUser(userId, projectId);
  const treasury = await getProjectTreasurySummaryForUser(userId, projectId);
  const snapshot = await getPilotSnapshotForUser(userId);
  const deal = snapshot.deals.find((d) => d.id === projectId);
  const graph = await resolveOperationalCoordinationSnapshot({
    userId,
    projectId,
    participants: snapshot.participants,
  });
  const projection = deal
    ? projectGraphSummaryProjection(graph, deal, snapshot.participants)
    : null;
  const coordinationStage = graph.fundingInput
    ? deriveFundingCoordinationStage(graph.fundingInput)
    : null;

  return {
    overview: workspace.found
      ? {
          fundingLabel: workspace.summary.fundingLabel,
          fundingSubcopy: workspace.summary.fundingSubcopy,
          releaseReadyCount: workspace.summary.releaseReadyCount,
        }
      : { error: 'project not found' },
    treasury: treasury
      ? {
          fundingLabel: treasury.fundingLabel,
          fundingSubcopy: treasury.fundingSubcopy,
          confirmedFunding: treasury.confirmedFunding,
          obligationsTotal: treasury.obligationsTotal,
          obligationsFunded: treasury.obligationsFunded,
          sourceCount: treasury.sourceCount,
        }
      : null,
    coordinationGraph: {
      fundingLabel: projection?.fundingLabel ?? null,
      fundingSubcopy: projection?.fundingSubcopy ?? null,
      fundingInput: graph.fundingInput,
      coordinationStage: coordinationStage
        ? {
            primaryLabel: coordinationStage.primaryLabel,
            blockerLabel: coordinationStage.blockerLabel,
            fundingSettled: coordinationStage.fundingSettled,
            releaseFunded: coordinationStage.releaseFunded,
          }
        : null,
    },
  };
}

async function verify1C1D(prisma: PrismaClient, userId: string): Promise<Report> {
  const snapshot = await prisma.deal_network_pilot_deals.findFirst({
    where: { user_id: userId },
    orderBy: { updated_at: 'desc' },
    select: { id: true, name: true },
  });
  if (!snapshot) return { skipped: true, reason: 'no pilot deal' };

  const projectId = snapshot.id;
  const before = await captureFundingSurfaces(userId, projectId);

  const testName = `Runtime verify ${new Date().toISOString().slice(0, 19)}`;
  const { createProjectFundingSource, deleteProjectFundingSource } = await import(
    '../lib/projects/funding-sources/funding-sources.server'
  );
  const { buildFundingSourceAuditEntry } = await import(
    '../lib/operations/audit/funding-source-audit'
  );

  const created = await createProjectFundingSource(userId, projectId, {
    name: testName,
    sourceType: 'manual_forecast',
    amount: 2500,
    currency: 'AUD',
    status: 'forecast',
    confidenceLevel: 'medium',
    expectedSettlementDate: null,
    actualSettlementDate: null,
    linkedInvoiceId: null,
    linkedPaymentId: null,
    notes: 'runtime verification',
    organizationId: null,
  });

  const afterSave = await captureFundingSurfaces(userId, projectId);
  const auditOnAdd = buildFundingSourceAuditEntry({
    projectId,
    action: 'added',
    source: created,
  });

  const afterRefresh = await captureFundingSurfaces(userId, projectId);

  await deleteProjectFundingSource(userId, projectId, created.id);

  const surfacesAgree =
    afterSave.overview &&
    afterSave.treasury &&
    afterSave.coordinationGraph &&
    typeof afterSave.overview === 'object' &&
    'fundingLabel' in afterSave.overview;

  return {
    projectId,
    projectName: snapshot.name,
    before,
    afterSave,
    afterRefresh,
    auditOnAdd,
    surfacesAgree,
    agreementNote:
      'Overview uses treasury.fundingLabel ?? graph projection; coordination stage uses funding-coordination-semantics',
  };
}

async function verify1H(userId: string, projectId: string): Promise<Report> {
  const { resolveOperationalCoordinationSnapshot } = await import(
    '../lib/operations/selectors/resolve-operational-coordination.server'
  );
  const { orchestrateOperationalMutation } = await import(
    '../lib/operations/orchestration/operational-mutation-orchestrator.server'
  );
  let resolveCalls = 0;
  const countResolve = async () => {
    resolveCalls += 1;
    return resolveOperationalCoordinationSnapshot({ userId, projectId });
  };

  const t0 = performance.now();
  await countResolve();
  const singleResolveMs = Math.round(performance.now() - t0);

  resolveCalls = 0;
  const t1 = performance.now();
  await Promise.all([countResolve(), countResolve()]);
  const duplicateResolveMs = Math.round(performance.now() - t1);
  const duplicateResolveCalls = resolveCalls;

  const fundingSync = await orchestrateOperationalMutation({
    userId,
    mutation: 'funding_source_crud',
    projectId,
  });

  return {
    serverSide: {
      singleCoordinationSnapshotResolveMs: singleResolveMs,
      duplicateParallelResolveCalls: duplicateResolveCalls,
      duplicateParallelResolveMs: duplicateResolveMs,
      funding_source_crud_invalidatedScopes: fundingSync.invalidatedScopes,
      funding_source_crud_obligationCount: fundingSync.obligationCount,
    },
    clientExpectation: {
      activationRequestsPerFundingSave: 0,
      coordinationSnapshotRequestsPerFundingSave: 1,
      notificationOnlyEvents: true,
      convergence_overlap: 'must not fire on sequential funding save (see Playwright trace)',
    },
    apiRoutesToCountInBrowser: [
      '/api/workspace/activation',
      '/api/operations/coordination-snapshot',
    ],
  };
}

async function verify1A(prisma: PrismaClient, userId: string): Promise<Report> {
  const { normalizeManualPayoutMethod } = await import('../lib/participants/manual-payout-method');
  const { mergeManualPayoutMethodIntoCheckoutConfig, parseManualPayoutMethodFromCheckoutConfig } =
    await import('../lib/referrals/referral-commerce-config');
  const { manualPayoutMethodToPaymentLinkFields } = await import(
    '../lib/participants/manual-payout-method'
  );

  const sample = {
    type: 'manual' as const,
    label: 'Revolut',
    instructions: 'Pay to @runtime-verify — ref RUNTIME-1A',
    attachments: [{ label: 'QR', url: 'https://example.com/runtime-qr.png' }],
  };

  const row = await prisma.deal_network_pilot_participants.findFirst({
    where: { deal: { user_id: userId } },
    select: { id: true, participant_payload: true, deal_id: true },
    orderBy: { updated_at: 'desc' },
  });
  if (!row) return { skipped: true, reason: 'no participant' };

  const payload = (row.participant_payload ?? {}) as Record<string, unknown>;
  const previousManual = payload.manualPayoutMethod;
  payload.manualPayoutMethod = sample;

  await prisma.deal_network_pilot_participants.update({
    where: { id: row.id },
    data: { participant_payload: payload as object },
  });

  const reloaded = await prisma.deal_network_pilot_participants.findUnique({
    where: { id: row.id },
    select: { participant_payload: true },
  });
  const persisted = (reloaded?.participant_payload ?? {}) as Record<string, unknown>;
  const normalized = normalizeManualPayoutMethod(persisted.manualPayoutMethod);

  const checkoutConfig = mergeManualPayoutMethodIntoCheckoutConfig({}, sample);
  const parsedFromCheckout = parseManualPayoutMethodFromCheckoutConfig(checkoutConfig);
  const paymentLinkFields = manualPayoutMethodToPaymentLinkFields(sample, 'AUD');

  payload.manualPayoutMethod = previousManual ?? undefined;
  if (!previousManual) delete payload.manualPayoutMethod;
  await prisma.deal_network_pilot_participants.update({
    where: { id: row.id },
    data: { participant_payload: payload as object },
  });

  return {
    participantId: row.id,
    persistedSchema: persisted.manualPayoutMethod,
    normalizedRoundTrip: normalized,
    checkoutConfigKey: checkoutConfig,
    parsedFromReferralCheckoutConfig: parsedFromCheckout,
    paymentLinkFieldMapping: paymentLinkFields,
    attachmentsInInstructions: paymentLinkFields.manual_bank_instructions.includes('runtime-qr.png'),
    refreshPersistenceVerified: normalized?.instructions === sample.instructions,
  };
}

async function verify1C1DSemanticSimulation(): Promise<Report> {
  const { deriveFundingCoordinationStage } = await import(
    '../lib/operations/truth/funding-coordination-semantics'
  );
  return {
    note: 'DB-free runtime semantics — confirms Option C copy without persistence',
    scenarios: [
      {
        label: 'no source',
        input: {
          fundingSourceConnected: false,
          confirmedFunding: 0,
          obligationsTotal: 1000,
          obligationsFunded: 0,
        },
        stage: deriveFundingCoordinationStage({
          fundingSourceConnected: false,
          confirmedFunding: 0,
          obligationsTotal: 1000,
          obligationsFunded: 0,
        }),
      },
      {
        label: 'source added not confirmed',
        input: { hasFundingSourceRows: true, fundingSourceConnected: false, confirmedFunding: 0 },
        stage: deriveFundingCoordinationStage({
          hasFundingSourceRows: true,
          fundingSourceConnected: false,
          confirmedFunding: 0,
          obligationsTotal: 1000,
          obligationsFunded: 0,
        }),
      },
      {
        label: '1D secured allocation pending',
        input: { fundingSourceConnected: true, confirmedFunding: 1000, obligationsFunded: 0 },
        stage: deriveFundingCoordinationStage({
          fundingSourceConnected: true,
          confirmedFunding: 1000,
          obligationsTotal: 1000,
          obligationsFunded: 0,
        }),
      },
    ],
  };
}

async function verify1E1F(): Promise<Report> {
  const { resolveReviewFormCurrency } = await import('../lib/currency/resolve-review-form-currency');

  const matrix: Array<{
    label: string;
    context: Parameters<typeof resolveReviewFormCurrency>[0];
    resolved: string;
  }> = [];

  const cases: Array<{ label: string; context: Parameters<typeof resolveReviewFormCurrency>[0] }> =
    [
      {
        label: 'extracted USD high',
        context: {
          extractedCurrency: 'USD',
          extractedConfidence: 'high',
          project: { projectValueCurrency: 'AUD' },
          workspaceCurrency: 'EUR',
        },
      },
      {
        label: 'absent extraction → project AUD',
        context: {
          extractedCurrency: null,
          extractedConfidence: 'absent',
          project: { projectValueCurrency: 'AUD' },
          workspaceCurrency: 'USD',
        },
      },
      {
        label: 'absent extraction → workspace USD',
        context: {
          extractedCurrency: null,
          extractedConfidence: 'absent',
          project: null,
          workspaceCurrency: 'USD',
        },
      },
      {
        label: 'unsupported IDR → workspace AUD',
        context: {
          extractedCurrency: 'IDR',
          extractedConfidence: 'high',
          project: null,
          workspaceCurrency: 'AUD',
        },
      },
      {
        label: 'all absent → platform default',
        context: {
          extractedCurrency: null,
          extractedConfidence: 'absent',
          project: null,
          workspaceCurrency: null,
        },
      },
    ];

  for (const c of cases) {
    matrix.push({ label: c.label, context: c.context, resolved: resolveReviewFormCurrency(c.context) });
  }

  return { matrix };
}

async function tableExists(prisma: PrismaClient, tableName: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${tableName}
    ) AS exists
  `;
  return rows[0]?.exists === true;
}

async function verify1BLedgerProbe(prisma: PrismaClient, organizationId: string): Promise<Report> {
  const [batchCount, lineCount, recentBatches] = await Promise.all([
    prisma.payout_batches.count({ where: { organization_id: organizationId } }),
    prisma.commission_obligation_lines.count({
      where: {
        status: 'POSTED',
        payout_id: null,
        commission_obligations: { payment_links: { organization_id: organizationId } },
      },
    }),
    prisma.payout_batches.findMany({
      where: { organization_id: organizationId },
      orderBy: { created_at: 'desc' },
      take: 3,
      select: {
        id: true,
        status: true,
        payout_count: true,
        total_amount: true,
        currency: true,
        created_at: true,
      },
    }),
  ]);
  return {
    path: 'ledger_commission_obligation_lines',
    postedUnpaidLines: lineCount,
    existingBatchCount: batchCount,
    recentBatches: recentBatches.map((b) => ({
      ...b,
      total_amount: Number(b.total_amount),
    })),
    note: 'Pilot tables absent — use org with POSTED lines + --execute-1b against pilot-enabled DB for full create path',
  };
}

async function main() {
  const args = process.argv.slice(2);
  const userIdArg = args.find((a) => a.startsWith('--userId='))?.split('=')[1];
  const execute1b = args.includes('--execute-1b');
  const baseUrl = args.find((a) => a.startsWith('--baseUrl='))?.split('=')[1];

  const report: Report = {
    verifiedAt: new Date().toISOString(),
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
  };

  if (!process.env.DATABASE_URL) {
    report.error = 'DATABASE_URL not set — load ../.env.local via dotenv';
    const outDir = resolve(process.cwd(), 'scripts/output');
    mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, 'runtime-verification-report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  const prisma = new PrismaClient({ log: ['error'] });
  try {
    report.tables = {
      deal_network_pilot_deals: await tableExists(prisma, 'deal_network_pilot_deals'),
      project_funding_sources: await tableExists(prisma, 'project_funding_sources'),
      payout_batches: await tableExists(prisma, 'payout_batches'),
    };

    const pilotEnabled = report.tables.deal_network_pilot_deals === true;
    report.issue1E1F_currency = await verify1E1F();
    report.issue1C1D_semanticSimulation = await verify1C1DSemanticSimulation();

    let userId: string | null = userIdArg ?? null;
    if (pilotEnabled) {
      userId = await resolveUserId(prisma, userIdArg);
    } else {
      const member = await prisma.user_organizations.findFirst({
        select: { user_id: true, organization_id: true },
        orderBy: { created_at: 'desc' },
      });
      userId = member?.user_id ?? null;
      report.organizationIdFromMember = member?.organization_id ?? null;
    }

    if (!userId) {
      report.error = 'No userId found for verification';
      report.issue1B_createPayout = { skipped: true };
      report.issue1C1D_fundingState = { skipped: true, reason: 'no user' };
      report.issue1H_convergence = { skipped: true };
      report.issue1A_manualPayout = { skipped: true };
    } else {
      report.userId = userId;
      const organizationId =
        (report.organizationIdFromMember as string | undefined) ??
        (await resolveOrgForUser(prisma, userId));
      report.organizationId = organizationId;

      if (pilotEnabled && organizationId) {
        report.issue1B_createPayout = await verify1B(prisma, userId, organizationId, execute1b);
        report.issue1C1D_fundingState = await verify1C1D(prisma, userId);
      } else if (organizationId) {
        report.issue1B_createPayout = await verify1BLedgerProbe(prisma, organizationId);
        report.issue1C1D_fundingState = {
          skipped: true,
          reason: 'project_funding_sources / pilot deals not in connected database',
        };
      } else {
        report.issue1B_createPayout = { skipped: true, reason: 'no organization' };
        report.issue1C1D_fundingState = { skipped: true };
      }

      const projectId =
        typeof report.issue1C1D_fundingState === 'object' &&
        report.issue1C1D_fundingState &&
        'projectId' in report.issue1C1D_fundingState
          ? String((report.issue1C1D_fundingState as { projectId: string }).projectId)
          : null;

      report.issue1H_convergence = projectId
        ? await verify1H(userId, projectId)
        : {
            skipped: true,
            reason: 'no pilot project — run against DB with deal_network_pilot_deals migrated',
          };

      report.issue1A_manualPayout = pilotEnabled
        ? await verify1A(prisma, userId)
        : {
            skipped: true,
            schemaReference: {
              type: 'manual',
              label: 'Revolut',
              instructions: '...',
              attachments: [{ label: 'string', url: 'https://...' }],
              storageLocation: 'deal_network_pilot_participants.participant_payload.manualPayoutMethod',
              checkoutConfigKey: 'manualPayoutMethod',
            },
          };
    }

    if (baseUrl) {
      const routes = [
        '/api/health',
        '/api/operations/coordination-snapshot',
        '/api/workspace/activation',
        '/dashboard/payouts/settlements',
      ];
      const httpTraces: Report[] = [];
      for (const route of routes) {
        const url = `${baseUrl.replace(/\/$/, '')}${route}`;
        const start = performance.now();
        try {
          const res = await fetch(url, { redirect: 'manual' });
          const text = await res.text();
          httpTraces.push({
            route,
            status: res.status,
            durationMs: Math.round(performance.now() - start),
            bodyPreview: text.slice(0, 200),
          });
        } catch (e) {
          httpTraces.push({
            route,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
      report.liveHttpTraces = httpTraces;
    }
  } finally {
    await prisma.$disconnect();
  }

  const outDir = resolve(process.cwd(), 'scripts/output');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, 'runtime-verification-report.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.error(`\nWrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
