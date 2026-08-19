import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { z } from 'zod';
import {
  getTreasuryOrganizationId,
  requireTreasuryOrganizationAccess,
} from '@/lib/treasury/api/require-treasury-access';
import { requirePaymentConfigurationAccess } from '@/lib/auth/step-up.server';
import {
  disconnectDigitalSurge,
  getDigitalSurgeConnectionStatus,
  saveDigitalSurgeConnection,
} from '@/lib/treasury/integration/connection-service';
import { digitalSurgeConnector } from '@/lib/treasury/connectors/digital-surge/connector';
import { syncTreasuryForOrganization } from '@/lib/treasury/observers/sync-digital-surge';

export async function GET(req: NextRequest) {
  const auth = await getCurrentUserForApi(req);
  if (!auth.user) return auth.response!;

  const access = await requireTreasuryOrganizationAccess(req);
  if (!access.ok) {
    return access.response;
  }

  const status = await getDigitalSurgeConnectionStatus(access.organizationId);
  const health = status.connected
    ? await digitalSurgeConnector.checkConnectionHealth({
        organizationId: access.organizationId,
      })
    : null;

  return NextResponse.json({
    provider: 'digital_surge',
    ...status,
    health,
  });
}

const postSchema = z.object({
  apiKey: z.string().min(8).max(512),
});

export async function POST(req: NextRequest) {
  const access = await requirePaymentConfigurationAccess(req, getTreasuryOrganizationId(req));
  if (!access.ok) return access.response;

  let body: z.infer<typeof postSchema>;
  try {
    body = postSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 400 });
  }

  await saveDigitalSurgeConnection({
    organizationId: access.organizationId,
    apiKey: body.apiKey,
  });

  return NextResponse.json({ success: true, provider: 'digital_surge', connected: true });
}

export async function DELETE(req: NextRequest) {
  const access = await requirePaymentConfigurationAccess(req, getTreasuryOrganizationId(req));
  if (!access.ok) return access.response;

  await disconnectDigitalSurge(access.organizationId);
  return NextResponse.json({ success: true, connected: false });
}

export async function PUT(req: NextRequest) {
  const auth = await getCurrentUserForApi(req);
  if (!auth.user) return auth.response!;

  const access = await requireTreasuryOrganizationAccess(req);
  if (!access.ok) {
    return access.response;
  }

  const result = await syncTreasuryForOrganization(access.organizationId);
  return NextResponse.json({ success: !result.error, result });
}
