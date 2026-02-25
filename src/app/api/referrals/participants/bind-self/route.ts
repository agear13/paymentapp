/**
 * POST /api/referrals/participants/bind-self
 * Admin-only: Bind current user to a participant by referral_code.
 * Body: { programSlug, referralCodeToBind }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkAdminAuth } from '@/lib/auth/admin.server';

export async function POST(request: NextRequest) {
  try {
    const { isAdmin, user, error: authError } = await checkAdminAuth();

    if (!isAdmin || !user) {
      return NextResponse.json(
        { error: authError || 'Forbidden' },
        { status: authError === 'Authentication required' ? 401 : 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { programSlug, referralCodeToBind } = body ?? {};

    if (!programSlug || !referralCodeToBind) {
      return NextResponse.json(
        { error: 'programSlug and referralCodeToBind are required' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    const { data: participant, error: partError } = await adminClient
      .from('referral_participants')
      .select('id, program_id, referral_code, name')
      .eq('referral_code', String(referralCodeToBind).toUpperCase())
      .eq('status', 'active')
      .single();

    if (partError || !participant) {
      return NextResponse.json(
        { error: `Participant not found: ${referralCodeToBind}` },
        { status: 404 }
      );
    }

    const { data: program } = await adminClient
      .from('referral_programs')
      .select('id, slug')
      .eq('id', participant.program_id)
      .eq('slug', programSlug)
      .single();

    if (!program) {
      return NextResponse.json(
        { error: 'Program slug does not match participant program' },
        { status: 400 }
      );
    }

    const { error: updateError } = await adminClient
      .from('referral_participants')
      .update({ user_id: user.id })
      .eq('id', participant.id);

    if (updateError) {
      console.error('[REFERRAL_BIND_SELF] Update failed:', updateError);
      return NextResponse.json(
        { error: 'Failed to bind user to participant' },
        { status: 500 }
      );
    }

    console.log('[REFERRAL_BIND_SELF] Bound:', {
      userId: user.id,
      email: user.email,
      participantId: participant.id,
      referralCode: participant.referral_code,
    });

    return NextResponse.json({
      success: true,
      message: `Bound to ${participant.referral_code}`,
      participant: { id: participant.id, referral_code: participant.referral_code, name: participant.name },
    });
  } catch (error) {
    console.error('[REFERRAL_BIND_SELF] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
