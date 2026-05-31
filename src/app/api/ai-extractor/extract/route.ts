import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { AuthError } from '@/lib/auth/errors';
import { extractAgreementFromText } from '@/lib/ai-extractor/extraction-service';

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
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