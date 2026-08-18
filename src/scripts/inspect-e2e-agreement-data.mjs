/**
 * Read-only inspection of E2E Agreement Intelligence persisted data.
 * Local only — never commit secrets.
 */
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { resolve } from 'node:path';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
loadEnv({ path: resolve(process.cwd(), '.env') });

const email = process.env.E2E_EMAIL?.trim();
if (!email || !process.env.DATABASE_URL) {
  console.error('E2E_EMAIL and DATABASE_URL required');
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const userRows = await prisma.$queryRaw`
    SELECT id::text AS id FROM auth.users WHERE lower(email) = lower(${email}) LIMIT 1
  `;
  const userId = userRows[0]?.id;
  if (!userId) throw new Error(`No user for ${email}`);

  const membership = await prisma.user_organizations.findFirst({
    where: { user_id: userId },
    orderBy: { created_at: 'asc' },
  });
  if (!membership) throw new Error('No org membership');

  const wf = await prisma.organization_workflows.findUnique({
    where: {
      ux_organization_workflows_org_template: {
        organization_id: membership.organization_id,
        template_slug: 'agreement-intelligence',
      },
    },
    include: { agreement: true },
  });

  if (!wf?.agreement) {
    console.log(JSON.stringify({ status: 'no_agreement' }, null, 2));
    process.exit(0);
  }

  const agr = wf.agreement;
  const extraction = agr.extraction_result;
  const approved = agr.approved_structure;
  const graph = agr.commercial_graph;

  const pilotDealId = agr.pilot_deal_id;
  const deals = await prisma.deal_network_pilot_deals.findMany({ where: { user_id: userId } });
  const dealIds = pilotDealId ? [pilotDealId] : deals.map((d) => d.id);
  const participants = dealIds.length
    ? await prisma.deal_network_pilot_participants.findMany({
        where: { deal_id: { in: dealIds } },
      })
    : [];
  const obligations = dealIds.length
    ? await prisma.deal_network_pilot_obligations.findMany({
        where: { deal_id: { in: dealIds } },
      })
    : [];

  const report = {
    lifecycleStatus: wf.lifecycle_status,
    bootstrapError: agr.bootstrap_error,
    pilotDealId,
    extractionParties: (extraction?.parties ?? []).map((p) => ({
      id: p.id,
      name: p.name?.value ?? null,
      role: p.role?.value ?? null,
      revenueSharePct: p.revenueSharePct?.value ?? null,
      participationModel: p.participationModel?.value ?? null,
    })),
    approvedParties: (approved?.reviewForm?.parties ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      revenueSharePct: p.revenueSharePct ?? null,
      participationModel: p.participationModel,
    })),
    commercialGraphParticipantCount: graph?.commercialStructure?.participantCount ?? null,
    pilotDeals: deals.map((d) => ({
      id: d.id,
      name: d.name,
      payoutTrigger: d.payout_trigger,
    })),
    pilotParticipants: participants.map((p) => ({
        id: p.id,
        dealId: p.deal_id,
        name: p.name,
        role: p.role,
        payloadRole: p.participant_payload?.role ?? null,
        payloadOperationalRole: p.participant_payload?.operationalRole ?? null,
      })),
    obligations: obligations.map((o) => ({
        id: o.id,
        dealId: o.deal_id,
        type: o.obligation_type,
        amount: o.amount_owed?.toString?.() ?? o.amount_owed,
        status: o.status,
      })),
  };

  console.log(JSON.stringify(report, null, 2));
} finally {
  await prisma.$disconnect();
}
