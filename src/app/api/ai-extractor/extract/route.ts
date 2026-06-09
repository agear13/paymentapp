import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { AuthError } from '@/lib/auth/errors';
import { extractAgreementFromText } from '@/lib/ai-extractor/extraction-service';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { requireEntitlement } from '@/lib/entitlements/gate-api.server';

export async function POST(req: NextRequest) {
  let userId: string;
  let userEmail: string | undefined;
  try {
    const user = await requireAuth(req);
    userId = user.id;
    userEmail = user.email ?? undefined;
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }

  const org = await getOrganizationForAuthenticatedUser(userId);
  if (org) {
    const entitlementBlock = await requireEntitlement({
      organizationId: org.id,
      userId,
      userEmail,
      feature: 'ai_import',
    });
    if (entitlementBlock) return entitlementBlock;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'Extraction service not configured' },
      { status: 503 }
    );
  }

  let rawText: string;
  try {
    const body = await req.json();
    rawText = typeof body?.rawText === 'string' ? body.rawText.trim() : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!rawText) {
    return NextResponse.json({ error: 'rawText is required' }, { status: 400 });
  }

  if (rawText.length > 50_000) {
    return NextResponse.json({ error: 'Conversation text is too long (max 50,000 characters)' }, { status: 400 });
  }

  const result = await extractAgreementFromText(rawText);
  return NextResponse.json(result);
}