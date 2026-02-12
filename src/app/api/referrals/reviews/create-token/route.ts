/**
 * POST /api/referrals/reviews/create-token
 * Authenticated consultant only. Creates review token for collecting feedback.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthedParticipantForProgram } from '@/lib/referrals/participant-auth';
import { buildShareTemplates } from '@/lib/referrals/share-templates';

function generateToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = '';
  for (let i = 0; i < 16; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export async function POST(request: NextRequest) {
  try {
    const authed = await getAuthedParticipantForProgram('consultant-referral');

    if (!authed) {
      return NextResponse.json(
        { error: 'Authentication required. Bind your account first.' },
        { status: 401 }
      );
    }

    const { participant, program } = authed;

    if (participant.role !== 'CONSULTANT' && participant.role !== 'BD_PARTNER') {
      return NextResponse.json(
        { error: 'Only consultants can create review tokens' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { programSlug, clientName, clientEmail } = body ?? {};

    if (programSlug !== 'consultant-referral') {
      return NextResponse.json(
        { error: 'Invalid program' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    let token = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateToken();
      const { data: existing } = await adminClient
        .from('referral_review_tokens')
        .select('id')
        .eq('token', candidate)
        .single();

      if (!existing) {
        token = candidate;
        break;
      }
    }

    if (!token) {
      return NextResponse.json(
        { error: 'Could not generate unique token' },
        { status: 500 }
      );
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { error: insertError } = await adminClient
      .from('referral_review_tokens')
      .insert({
        program_id: program.id,
        participant_id: participant.id,
        token,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('[REFERRAL_REVIEW_CREATE_TOKEN] Insert failed:', insertError);
      return NextResponse.json(
        { error: 'Failed to create review token' },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const reviewUrl = `${baseUrl}/review/${token}`;

    const templates = buildShareTemplates(reviewUrl, 'review', { clientName });

    return NextResponse.json({
      token,
      reviewUrl,
      shareTemplates: templates,
    });
  } catch (error) {
    console.error('[REFERRAL_REVIEW_CREATE_TOKEN] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
