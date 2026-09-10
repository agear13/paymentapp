import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { requirePaymentConfigurationAccess } from '@/lib/auth/step-up.server';
import {
  getTreasuryOrganizationId,
  requireTreasuryOrganizationAccess,
} from '@/lib/treasury/api/require-treasury-access';
import {
  getCregisConnectionStatus,
  saveCregisConnection,
  updateCregisConnectionGates,
} from '@/lib/payouts/rails/cregis-connection.server';

export async function GET(req: NextRequest) {
  const auth = await getCurrentUserForApi(req);
  if (!auth.user) return auth.response!;

  const access = await requireTreasuryOrganizationAccess(req);
  if (!access.ok) return access.response;

  const status = await getCregisConnectionStatus(access.organizationId);
  return NextResponse.json({
    provider: 'cregis',
    ...status,
    platformEnabled: process.env.CREGIS_PAYOUTS_ENABLED === 'true',
    productionEnabled: process.env.CREGIS_PRODUCTION_PAYOUTS_ENABLED === 'true',
  });
}

const postSchema = z.object({
  apiKey: z.string().min(8).max(512),
  pid: z.coerce.number().int().positive(),
  gatewayBaseUrl: z.string().url(),
  walletId: z.coerce.number().int().positive().optional().nullable(),
  fromAddress: z.string().max(256).optional().nullable(),
  callbackUrl: z.string().url().optional().nullable(),
  executionEnabled: z.boolean().optional(),
  environment: z.enum(['sandbox', 'production']).optional(),
});

export async function POST(req: NextRequest) {
  const access = await requirePaymentConfigurationAccess(req, getTreasuryOrganizationId(req));
  if (!access.ok) return access.response;

  let body: z.infer<typeof postSchema>;
  try {
    body = postSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid Cregis connection payload' }, { status: 400 });
  }

  await saveCregisConnection({
    organizationId: access.organizationId,
    apiKey: body.apiKey,
    pid: body.pid,
    gatewayBaseUrl: body.gatewayBaseUrl,
    walletId: body.walletId,
    fromAddress: body.fromAddress,
    callbackUrl: body.callbackUrl,
    executionEnabled: body.executionEnabled === true,
    environment: body.environment ?? 'sandbox',
  });

  const status = await getCregisConnectionStatus(access.organizationId);
  return NextResponse.json({
    success: true,
    provider: 'cregis',
    ...status,
  });
}

const patchSchema = z.object({
  executionEnabled: z.boolean().optional(),
  environment: z.enum(['sandbox', 'production']).optional(),
});

export async function PATCH(req: NextRequest) {
  const access = await requirePaymentConfigurationAccess(req, getTreasuryOrganizationId(req));
  if (!access.ok) return access.response;

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid Cregis connection gate payload' }, { status: 400 });
  }

  const updated = await updateCregisConnectionGates({
    organizationId: access.organizationId,
    executionEnabled: body.executionEnabled,
    environment: body.environment,
  });
  if (!updated) {
    return NextResponse.json({ error: 'Cregis connection not found' }, { status: 404 });
  }

  const status = await getCregisConnectionStatus(access.organizationId);
  return NextResponse.json({
    success: true,
    provider: 'cregis',
    ...status,
  });
}
