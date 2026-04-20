import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/supabase/middleware';
import { applyRateLimit } from '@/lib/rate-limit';
import { getDealIssues } from '@/lib/copilot/tools/get-deal-issues';
import { isBetaAdminEmail } from '@/lib/auth/admin-shared';
import { isRabbitHolePilotUser } from '@/lib/auth/dashboard-product.server';

const ParticipantSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  approvalStatus: z.string().optional(),
  payoutSettlementStatus: z.string().optional(),
});

const DealSchema = z.object({
  id: z.string(),
  dealName: z.string(),
  status: z.string(),
  paymentStatus: z.string().optional(),
  archived: z.boolean().optional(),
  paymentLink: z.string().optional(),
  paidAmount: z.number().optional(),
  paidAt: z.string().optional(),
  currentStage: z.string().optional(),
});

const GetDealIssuesBodySchema = z.object({
  tool: z.literal('getDealIssues'),
  input: z.object({
    diagnosticType: z
      .enum(['blockers', 'payout_readiness', 'funding', 'state_consistency', 'needs_action'])
      .optional(),
    deal: DealSchema.nullable(),
    participants: z.array(ParticipantSchema),
  }),
});

/**
 * POST /api/copilot/tools
 * Invokes safe copilot tools (Deal Network). Restricted to admin + Rabbit Hole pilot.
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const auth = await requireAuth(request);
    if (!auth.user) return auth.response!;
    const email = auth.user.email ?? null;

    const allowed = isBetaAdminEmail(email) || isRabbitHolePilotUser(email);
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const json = await request.json();
    const parsed = GetDealIssuesBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    if (parsed.data.tool === 'getDealIssues') {
      const result = getDealIssues(parsed.data.input);
      return NextResponse.json({ ok: true, result });
    }

    return NextResponse.json({ error: 'Unknown tool' }, { status: 400 });
  } catch (e) {
    console.error('[copilot/tools]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
