/**
 * Participant identity probe — Island DJs / Coastal Promotions on pilot DB.
 * Run from src/: npx tsx scripts/query-participant-identity.ts
 * Optional: PILOT_TRACE_USER_ID, PILOT_TRACE_DEAL_ID
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { Prisma, PrismaClient } from '@prisma/client';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { normalizeParticipant } from '@/lib/operational/safe-operational-hydration';
import {
  buildParticipantIdentityReport,
  buildParticipantIdentityRow,
  DEFAULT_IDENTITY_NAME_PATTERNS,
  matchesNamePatterns,
} from '@/lib/deal-network-demo/participant-identity-report';

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
  });
}

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

async function main() {
  const prisma = new PrismaClient();
  const userId = process.env.PILOT_TRACE_USER_ID;
  const projectId = process.env.PILOT_TRACE_DEAL_ID?.trim() || null;

  try {
    const hasPilot = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'deal_network_pilot_participants'`;
    if (hasPilot[0]?.n === BigInt(0)) {
      console.error('ERROR: deal_network_pilot_participants missing on DATABASE_URL.');
      console.error(
        'Use the app DB (production/staging) or call while logged in:\n' +
          '  fetch("/api/deal-network-pilot/debug/participant-identity?projectId=<dealId>", { credentials: "include" }).then(r=>r.json()).then(console.log)'
      );
      process.exit(2);
    }

    const deals = await prisma.deal_network_pilot_deals.findMany({
      where: {
        ...(userId ? { user_id: userId } : {}),
        ...(projectId ? { id: projectId } : {}),
      },
      select: { id: true, name: true },
    });

    const dealIds = deals.map((d) => d.id);
    const dealNameById = new Map(deals.map((d) => [d.id, d.name]));

    const rows = await prisma.deal_network_pilot_participants.findMany({
      where: { deal_id: { in: dealIds } },
      orderBy: { created_at: 'asc' },
    });

    const identityRows = rows
      .map((row) =>
        buildParticipantIdentityRow({
          participant: participantRowToDemo(row),
          dealId: row.deal_id,
          dealName: dealNameById.get(row.deal_id) ?? row.deal_id,
          createdAt: row.created_at.toISOString(),
        })
      )
      .filter((r) => matchesNamePatterns(r.name, DEFAULT_IDENTITY_NAME_PATTERNS));

    const report = buildParticipantIdentityReport({
      rows: identityRows,
      projectIdFilter: projectId,
    });

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
