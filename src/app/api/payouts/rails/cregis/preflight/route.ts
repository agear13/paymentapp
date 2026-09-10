import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { requireTreasuryOrganizationAccess } from '@/lib/treasury/api/require-treasury-access';
import { preflightCregisPayout } from '@/lib/payouts/rails/cregis-preflight.server';

const postSchema = z.object({
  payoutId: z.string().uuid().optional(),
  methodType: z.string().optional().nullable(),
  destinationHandle: z.string().optional().nullable(),
  destinationDetails: z.record(z.string(), z.unknown()).optional().nullable(),
  payoutAmount: z.string().optional().nullable(),
  payoutCurrency: z.string().optional().nullable(),
  queryProjectCoins: z.boolean().optional(),
});

function publicReadiness(readiness: Awaited<ReturnType<typeof preflightCregisPayout>>) {
  return {
    eligible: readiness.eligible,
    executable: readiness.executable,
    rail: readiness.rail,
    reasons: readiness.reasons,
    destination: readiness.destination,
    settlement: readiness.settlement,
    provider: readiness.provider,
    endpointsCalled: readiness.endpointsCalled,
    projectCoins: readiness.projectCoins,
  };
}

export async function GET(req: NextRequest) {
  const auth = await getCurrentUserForApi(req);
  if (!auth.user) return auth.response!;

  const access = await requireTreasuryOrganizationAccess(req);
  if (!access.ok) return access.response;

  const payoutId = req.nextUrl.searchParams.get('payoutId') ?? undefined;
  const payoutAmount = req.nextUrl.searchParams.get('amount') ?? undefined;
  const payoutCurrency = req.nextUrl.searchParams.get('currency') ?? undefined;
  const queryProjectCoins = req.nextUrl.searchParams.get('queryProjectCoins') !== 'false';

  const readiness = await preflightCregisPayout({
    organizationId: access.organizationId,
    payoutId,
    payoutAmount,
    payoutCurrency,
    queryProjectCoins,
  });

  return NextResponse.json(publicReadiness(readiness));
}

export async function POST(req: NextRequest) {
  const auth = await getCurrentUserForApi(req);
  if (!auth.user) return auth.response!;

  const access = await requireTreasuryOrganizationAccess(req);
  if (!access.ok) return access.response;

  let body: z.infer<typeof postSchema> = {};
  try {
    const json = await req.json().catch(() => ({}));
    body = postSchema.parse(json ?? {});
  } catch {
    return NextResponse.json({ error: 'Invalid Cregis preflight payload' }, { status: 400 });
  }

  const readiness = await preflightCregisPayout({
    organizationId: access.organizationId,
    payoutId: body.payoutId,
    methodType: body.methodType,
    destinationHandle: body.destinationHandle,
    destinationDetails: body.destinationDetails ?? null,
    payoutAmount: body.payoutAmount,
    payoutCurrency: body.payoutCurrency,
    queryProjectCoins: body.queryProjectCoins,
  });

  return NextResponse.json(publicReadiness(readiness));
}
