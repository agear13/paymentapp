/**
 * Trace create vs update (duplicate merge) with real DB participant + live extraction.
 *
 * Requires: pilot tables migrated, ANTHROPIC_API_KEY, DATABASE_URL (.env.local).
 * Optional: PILOT_TRACE_USER_ID, PILOT_TRACE_PARTICIPANT_ID, PILOT_TRACE_DEAL_ID
 * Optional: TRACE_PERSIST=1 to run syncPilotSnapshotForUser + reload (writes DB)
 *
 * Run from src/: npx tsx scripts/trace-duplicate-update-compensation.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  buildExtractionSystemPrompt,
  buildExtractionUserPrompt,
} from '@/lib/ai-extractor/extraction-prompt';
import { validateExtractionResult } from '@/lib/ai-extractor/extraction-service';
import { reviewFormFromExtraction } from '@/lib/ai-extractor/review-form-types';
import {
  mapSinglePartyToParticipant,
  mergeExtractedCompensationIntoExistingParticipant,
} from '@/lib/ai-extractor/extraction-mapper';
import {
  detectDuplicates,
  defaultResolutions,
} from '@/lib/ai-extractor/duplicate-detection';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { repairScalarCompensationProfile } from '@/lib/participants/repair-scalar-compensation-profile';
import { hydrateParticipant } from '@/lib/operations/hydration/hydrate-participant';
import { hasPersistedCompensationTerms } from '@/lib/operations/primitives/participant-earnings-primitives';
import { deriveCompensationState } from '@/lib/operations/derivations/derive-compensation-state';
import { normalizeParticipant } from '@/lib/operational/safe-operational-hydration';
import {
  materializeConversationImportHistoryForDeal,
  mergeConversationImportHistoryOnDeal,
} from '@/lib/operations/audit/conversation-import-audit';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const ISLAND_DJS_CONVERSATION = `Venue:
Hi Sam, can you confirm your fee for Saturday Beach Event?

Island DJs:
Sure. Our fee is AUD 2,500 for the event.`;

const MODEL = process.env.EXTRACTOR_MODEL ?? 'claude-sonnet-4-6';
const TRACE_PERSIST = process.env.TRACE_PERSIST === '1';

function dealRowToRecentDeal(row: { id: string; deal_payload: Prisma.JsonValue }): RecentDeal {
  const payload = row.deal_payload as unknown as RecentDeal;
  return { ...payload, id: row.id };
}

function participantRowToDemo(row: {
  id: string;
  deal_id: string;
  invite_token: string;
  participant_payload: Prisma.JsonValue;
  approval_status?: string;
  approved_at?: Date | null;
}): DemoParticipant {
  const payload = row.participant_payload as unknown as DemoParticipant;
  const approvalStatus: DemoParticipant['approvalStatus'] =
    row.approval_status === 'Approved' || payload.approvalStatus === 'Approved'
      ? 'Approved'
      : 'Pending approval';
  return normalizeParticipant({
    ...payload,
    id: row.id,
    dealId: row.deal_id,
    inviteToken: row.invite_token,
    approvalStatus,
    approvedAt: row.approved_at ? row.approved_at.toISOString() : payload.approvedAt,
    inviteStatus:
      approvalStatus === 'Approved'
        ? payload.inviteStatus === 'Opened'
          ? 'Opened'
          : payload.inviteStatus ?? 'Invited'
        : payload.inviteStatus ?? 'Invited',
  });
}

function compSnapshot(p: DemoParticipant | null | undefined) {
  if (!p) return null;
  const profile = p.compensationProfile;
  return {
    id: p.id,
    name: p.name,
    participationModel: p.participationModel,
    commissionKind: p.commissionKind,
    commissionValue: p.commissionValue,
    compensationProfile: profile
      ? {
          compensationType: profile.compensationType,
          percentage: profile.percentage ?? null,
          fixedAmount: profile.fixedAmount ?? null,
          configured: profile.configured ?? null,
          customerAttributionEnabled: profile.customerAttributionEnabled ?? null,
        }
      : null,
  };
}

const COMP_FIELDS = [
  'participationModel',
  'commissionKind',
  'commissionValue',
] as const;
const PROFILE_FIELDS = ['compensationType', 'percentage', 'fixedAmount', 'configured'] as const;

function diffCompensation(
  labelA: string,
  a: ReturnType<typeof compSnapshot>,
  labelB: string,
  b: ReturnType<typeof compSnapshot>
): string[] {
  const diffs: string[] = [];
  if (!a || !b) return [`${labelA} or ${labelB} missing`];
  for (const f of COMP_FIELDS) {
    if (a[f] !== b[f]) diffs.push(`${f}: ${labelA}=${a[f]} ${labelB}=${b[f]}`);
  }
  const cp = a.compensationProfile;
  const bp = b.compensationProfile;
  if (!cp && bp) diffs.push(`compensationProfile: ${labelA}=null ${labelB}=present`);
  if (cp && !bp) diffs.push(`compensationProfile: ${labelA}=present ${labelB}=null`);
  if (cp && bp) {
    for (const f of PROFILE_FIELDS) {
      if (cp[f] !== bp[f]) diffs.push(`profile.${f}: ${labelA}=${cp[f]} ${labelB}=${bp[f]}`);
    }
  }
  return diffs;
}

async function liveExtract(text: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY required');
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    temperature: 0,
    system: buildExtractionSystemPrompt(),
    messages: [{ role: 'user', content: buildExtractionUserPrompt(text) }],
  });
  const block = message.content[0];
  if (!block || block.type !== 'text') throw new Error('non-text anthropic response');
  const parsed = JSON.parse(block.text.trim()) as unknown;
  return validateExtractionResult(parsed);
}

/** Inlined from pilot-snapshot.server (avoids server-only import). */
function participantToPrismaData(p: DemoParticipant) {
  if (!p.dealId) throw new Error('Participant missing dealId');
  return {
    deal_id: p.dealId,
    invite_token: p.inviteToken,
    name: p.name,
    email: p.email?.trim() ? p.email : null,
    role: p.role,
    role_details: p.roleDetails ?? null,
    payout_condition: p.payoutCondition ?? null,
    approval_status: p.approvalStatus,
    approved_at: p.approvedAt ? new Date(p.approvedAt) : null,
    participant_payload: p as unknown as Prisma.InputJsonValue,
  };
}

function dealToPrismaData(deal: RecentDeal, userId: string) {
  return {
    user_id: userId,
    name: deal.dealName,
    partner: deal.partner,
    contact: deal.rhContactLine ?? null,
    deal_value: new Prisma.Decimal(deal.value),
    payment_link: deal.paymentLink ?? null,
    payment_status: deal.paymentStatus,
    paid_amount:
      deal.paidAmount != null && Number.isFinite(deal.paidAmount)
        ? new Prisma.Decimal(deal.paidAmount)
        : null,
    paid_at: deal.paidAt ? new Date(deal.paidAt) : null,
    deal_payload: deal as unknown as Prisma.InputJsonValue,
  };
}

async function syncPilotSnapshotForUser(
  prisma: PrismaClient,
  userId: string,
  deals: RecentDeal[],
  participants: DemoParticipant[]
): Promise<void> {
  const incomingDealIds = new Set(deals.map((d) => d.id));
  await prisma.$transaction(async (tx) => {
    const existingDeals = await tx.deal_network_pilot_deals.findMany({
      where: { user_id: userId },
      select: { id: true },
    });
    for (const e of existingDeals) {
      if (!incomingDealIds.has(e.id)) {
        await tx.deal_network_pilot_deals.delete({ where: { id: e.id } });
      }
    }
    for (const deal of deals) {
      const existingRow = await tx.deal_network_pilot_deals.findUnique({
        where: { id: deal.id },
        select: { deal_payload: true },
      });
      const existingDeal = existingRow
        ? materializeConversationImportHistoryForDeal(
            dealRowToRecentDeal({ id: deal.id, deal_payload: existingRow.deal_payload })
          )
        : null;
      const mergedDeal = mergeConversationImportHistoryOnDeal(existingDeal, deal);
      const data = dealToPrismaData(mergedDeal, userId);
      await tx.deal_network_pilot_deals.upsert({
        where: { id: deal.id },
        create: { id: deal.id, ...data },
        update: data,
      });
    }
    const ownedDealIds = new Set(deals.map((d) => d.id));
    const relevantParticipants = participants.filter(
      (p) => p.dealId && ownedDealIds.has(p.dealId)
    );
    const incomingPartIds = new Set(relevantParticipants.map((p) => p.id));
    const existingParts = await tx.deal_network_pilot_participants.findMany({
      where: { deal: { user_id: userId } },
      select: { id: true },
    });
    for (const ep of existingParts) {
      if (!incomingPartIds.has(ep.id)) {
        await tx.deal_network_pilot_participants.delete({ where: { id: ep.id } });
      }
    }
    for (const p of relevantParticipants) {
      const data = participantToPrismaData(p);
      await tx.deal_network_pilot_participants.upsert({
        where: { id: p.id },
        create: { id: p.id, ...data },
        update: data,
      });
    }
  });
}

async function reloadParticipant(
  prisma: PrismaClient,
  participantId: string
): Promise<DemoParticipant | null> {
  const row = await prisma.deal_network_pilot_participants.findUnique({
    where: { id: participantId },
  });
  if (!row) return null;
  const payload = row.participant_payload as unknown as DemoParticipant;
  const { participant: repaired } = repairScalarCompensationProfile({
    ...payload,
    id: row.id,
    dealId: row.deal_id,
    inviteToken: row.invite_token,
  });
  return participantRowToDemo({
    ...row,
    participant_payload: repaired as unknown as Prisma.JsonValue,
  });
}

async function assertPilotTables(prisma: PrismaClient): Promise<void> {
  const tables = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'deal_network_pilot_deals'`;
  if (tables.length === 0) {
    throw new Error(
      'deal_network_pilot_deals does not exist. Deploy migrations (npm run db:migrate:deploy with reachable DIRECT_DATABASE_URL) then re-run.'
    );
  }
}

type OfflineSnapshot = { deal: RecentDeal; participant: DemoParticipant; userId?: string };

function loadOfflineSnapshot(): OfflineSnapshot | null {
  const path = process.env.PILOT_TRACE_SNAPSHOT_FILE;
  if (!path || !existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as OfflineSnapshot;
}

async function main() {
  const prisma = new PrismaClient();
  const offline = loadOfflineSnapshot();
  try {
    try {
      await assertPilotTables(prisma);
    } catch (tableErr) {
      if (!offline) throw tableErr;
      console.warn(String(tableErr));
      console.warn('Continuing with PILOT_TRACE_SNAPSHOT_FILE (real exported snapshot).\n');
    }

    const userId = process.env.PILOT_TRACE_USER_ID;
    const dealFilter = userId ? { user_id: userId } : {};
    const participantIdFilter = process.env.PILOT_TRACE_PARTICIPANT_ID;
    const dealIdFilter = process.env.PILOT_TRACE_DEAL_ID;

    let targetDealRow: {
      id: string;
      user_id: string;
      deal_payload: Prisma.JsonValue;
      name?: string;
    };
    let existingBefore: DemoParticipant | undefined;

    if (offline) {
      targetDealRow = {
        id: offline.deal.id,
        user_id: offline.userId ?? userId ?? 'offline-user',
        deal_payload: offline.deal as unknown as Prisma.JsonValue,
        name: offline.deal.dealName,
      };
      existingBefore = normalizeParticipant(offline.participant);
    } else if (participantIdFilter) {
      const row = await prisma.deal_network_pilot_participants.findUnique({
        where: { id: participantIdFilter },
        include: { deal: true },
      });
      if (!row) throw new Error(`Participant not found: ${participantIdFilter}`);
      targetDealRow = row.deal;
      existingBefore = participantRowToDemo(row);
    } else {
      const deals = await prisma.deal_network_pilot_deals.findMany({
        where: dealIdFilter ? { id: dealIdFilter, ...dealFilter } : dealFilter,
        orderBy: { created_at: 'desc' },
        take: 20,
        include: { participants: true },
      });
      if (deals.length === 0) {
        throw new Error('No pilot deals found. Set PILOT_TRACE_USER_ID or create a project first.');
      }
      const targetDeal = deals.find((d) =>
        d.participants.some((p) => {
          const payload = p.participant_payload as DemoParticipant;
          return (
            payload?.name?.trim().toLowerCase() === 'island djs' ||
            payload?.name?.trim().length > 0
          );
        })
      ) ?? deals[0]!;
      targetDealRow = targetDeal;
      existingBefore =
        targetDeal.participants
          .map((row) =>
            participantRowToDemo({
              id: row.id,
              deal_id: row.deal_id,
              invite_token: row.invite_token,
              approval_status: row.approval_status,
              approved_at: row.approved_at,
              participant_payload: row.participant_payload,
            })
          )
          .find((p) => p.name.trim().toLowerCase() === 'island djs') ??
        participantRowToDemo({
          id: targetDeal.participants[0]!.id,
          deal_id: targetDeal.participants[0]!.deal_id,
          invite_token: targetDeal.participants[0]!.invite_token,
          approval_status: targetDeal.participants[0]!.approval_status,
          approved_at: targetDeal.participants[0]!.approved_at,
          participant_payload: targetDeal.participants[0]!.participant_payload,
        });
    }

    if (!existingBefore) throw new Error('No participant row to trace');
    const deal = dealRowToRecentDeal(targetDealRow);
    const userIdForSync = targetDealRow.user_id;

    console.log('\n=== TARGET ===');
    console.log('dealId:', deal.id, 'dealName:', deal.dealName, 'userId:', userIdForSync);
    console.log('participantId:', existingBefore.id, 'name:', existingBefore.name);

    console.log('\n--- 1. Existing participant BEFORE import ---');
    console.log(JSON.stringify(compSnapshot(existingBefore), null, 2));

    console.log('\n--- 2. ExtractionResult (live Anthropic) ---');
    const extractionResult = await liveExtract(ISLAND_DJS_CONVERSATION);
    const extractedParty = extractionResult.parties[0]!;
    console.log(
      JSON.stringify(
        {
          participationModel: extractedParty.participationModel.value,
          fixedAmount: extractedParty.fixedAmount.value,
          revenueSharePct: extractedParty.revenueSharePct.value,
          currency: extractionResult.currency.value,
        },
        null,
        2
      )
    );

    const form = reviewFormFromExtraction(extractionResult, 'participant_add', 'whatsapp', deal.id, {
      project: deal,
      workspaceCurrency: 'AUD',
    });
    const matchesOnInit = detectDuplicates(form.parties, [existingBefore]);
    form.duplicateResolutions = defaultResolutions(matchesOnInit);

    const reviewedParty = { ...form.parties[0]! };
    if (reviewedParty.name.trim().toLowerCase() !== existingBefore.name.trim().toLowerCase()) {
      console.log(
        `Aligning reviewed name "${reviewedParty.name}" → existing "${existingBefore.name}" for name duplicate match.`
      );
      reviewedParty.name = existingBefore.name;
    }

    const reviewedParties = [reviewedParty];
    const originalsById = new Map([[extractedParty.id, extractedParty]]);
    const provenanceTag = '[AI Import: trace]';

    console.log('\n--- 3. Duplicate detection ---');
    const duplicateMatches = detectDuplicates(reviewedParties, [existingBefore]);
    console.log(JSON.stringify(duplicateMatches, null, 2));
    console.log('defaultResolutions (UI init):', defaultResolutions(duplicateMatches));

    const built = mapSinglePartyToParticipant(
      reviewedParty,
      deal,
      provenanceTag,
      extractedParty
    );
    const match = duplicateMatches.find((m) => m.extractedPartyId === reviewedParty.id);

    console.log('\n--- 4. Existing passed into merge ---');
    console.log(JSON.stringify(compSnapshot(match?.existingParticipant ?? existingBefore), null, 2));
    console.log('\n--- 4b. Built passed into merge ---');
    console.log(JSON.stringify(compSnapshot(built), null, 2));

    const merged =
      match != null
        ? mergeExtractedCompensationIntoExistingParticipant(match.existingParticipant, built)
        : null;

    console.log('\n--- 5. Merged participant (update path) ---');
    console.log(JSON.stringify(compSnapshot(merged), null, 2));

    const resolutionInit = form.duplicateResolutions[reviewedParty.id];
    const resolutionSaveFallback = form.duplicateResolutions[reviewedParty.id] ?? 'create';
    const resolutionSaveWithMatch = resolutionSaveFallback === 'update' && match != null;

    let existingParticipants: DemoParticipant[] = [existingBefore];
    let existingDeals: RecentDeal[] = [deal];
    if (!offline) {
      const snapshot = await prisma.deal_network_pilot_deals.findMany({
        where: { user_id: userIdForSync },
      });
      const allPartRows = await prisma.deal_network_pilot_participants.findMany({
        where: { deal_id: { in: snapshot.map((d) => d.id) } },
      });
      existingParticipants = allPartRows.map((row) => participantRowToDemo(row));
      existingDeals = snapshot.map((r) => dealRowToRecentDeal(r));
    }

    const participantsAfterCreate = [...existingParticipants, built];
    const participantsAfterUpdate = existingParticipants.map((ep) =>
      ep.id === existingBefore!.id && merged ? merged : ep
    );

    const beforePersistCreate = built;
    const beforePersistUpdate = participantsAfterUpdate.find((p) => p.id === existingBefore.id)!;

    console.log('\n--- 6. Before persistPilotSnapshot ---');
    console.log('CREATE path (new row pushed):', JSON.stringify(compSnapshot(beforePersistCreate), null, 2));
    console.log('UPDATE path (row replaced):', JSON.stringify(compSnapshot(beforePersistUpdate), null, 2));
    console.log('\nModal resolutions:');
    console.log('  duplicateResolutions[party.id] after init:', resolutionInit);
    console.log('  save uses ?? "create":', resolutionSaveFallback);
    console.log('  save would run update branch:', resolutionSaveWithMatch);

    let payloadAfterSave = beforePersistUpdate;
    if (TRACE_PERSIST && merged && !offline) {
      console.log('\n--- 7–8. persist + participant_payload (TRACE_PERSIST=1) ---');
      await syncPilotSnapshotForUser(userIdForSync, existingDeals, participantsAfterUpdate);
      const row = await prisma.deal_network_pilot_participants.findUnique({
        where: { id: existingBefore.id },
      });
      payloadAfterSave = row?.participant_payload as unknown as DemoParticipant;
      console.log(JSON.stringify(compSnapshot(payloadAfterSave), null, 2));
    } else {
      console.log('\n--- 7–8. participant_payload (JSON round-trip, no DB write) ---');
      payloadAfterSave = JSON.parse(JSON.stringify(beforePersistUpdate)) as DemoParticipant;
      console.log(JSON.stringify(compSnapshot(payloadAfterSave), null, 2));
    }

    const reloaded = TRACE_PERSIST
      ? await reloadParticipant(prisma, existingBefore.id)
      : simulateReload(payloadAfterSave);

    console.log('\n--- 9–10. After reload + hydrate ---');
    const { participant: repaired } = repairScalarCompensationProfile(reloaded!);
    const hydrated = hydrateParticipant(repaired)._entity;
    const comp = deriveCompensationState(hydrated);
    console.log(
      JSON.stringify(
        {
          afterRepair: compSnapshot(repaired),
          hasPersistedCompensationTerms: hasPersistedCompensationTerms(hydrated),
          deriveCompensationState: {
            configured: comp.configured,
            type: comp.type,
            earningsPrimaryCompact: comp.earningsPrimaryCompact,
            settlementBasis: comp.settlementBasis,
          },
        },
        null,
        2
      )
    );

    console.log('\n=== CREATE vs UPDATE (compensation fields only) ===');
    const stages: Array<{ name: string; create: ReturnType<typeof compSnapshot>; update: ReturnType<typeof compSnapshot> }> = [
      { name: '2-built', create: compSnapshot(built), update: compSnapshot(built) },
      { name: '5-merged', create: compSnapshot(built), update: compSnapshot(merged) },
      { name: '6-beforePersist', create: compSnapshot(beforePersistCreate), update: compSnapshot(beforePersistUpdate) },
      { name: '8-payload', create: compSnapshot(JSON.parse(JSON.stringify(built))), update: compSnapshot(payloadAfterSave) },
      { name: '10-hydrated', create: compSnapshot(hydrateParticipant(JSON.parse(JSON.stringify(built)))._entity), update: compSnapshot(hydrated) },
    ];
    for (const s of stages) {
      const d = diffCompensation('create', s.create, 'update', s.update);
      if (d.length > 0) {
        console.log(`First compensation divergence at stage: ${s.name}`);
        for (const line of d) console.log('  ', line);
        break;
      }
    }
    const builtVsMerged = diffCompensation('built', compSnapshot(built), 'merged', compSnapshot(merged));
    if (builtVsMerged.length === 0) {
      console.log('built vs merged: no compensation field differences (merge applies built profile).');
    } else {
      console.log('built vs merged:', builtVsMerged.join('; '));
    }

    const identityDiffs: string[] = [];
    if (built.id !== merged?.id) identityDiffs.push(`id: create=${built.id} update=${merged?.id}`);
    if (built.inviteToken !== merged?.inviteToken) {
      identityDiffs.push(`inviteToken differs (expected on update path)`);
    }
    if (identityDiffs.length) {
      console.log('\nFirst non-compensation divergence (lifecycle identity):', identityDiffs.join('; '));
    }

    if (resolutionSaveFallback === 'create' && match) {
      console.log(
        '\nWARNING: Duplicate matched but save fallback resolution is "create" — UI init had',
        resolutionInit,
        '— if operator saves without touching duplicate UI, old row is unchanged and a second row is added.'
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

function simulateReload(participant: DemoParticipant): DemoParticipant {
  const payload = JSON.parse(JSON.stringify(participant)) as DemoParticipant;
  const { participant: repaired } = repairScalarCompensationProfile({
    ...payload,
    id: payload.id ?? 'row-id',
    dealId: payload.dealId ?? 'deal-id',
    inviteToken: payload.inviteToken ?? 'token',
  });
  return repaired;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
