/**
 * PUT /api/referrals/advocates/[id]
 * Update advocate custom_commission_percent. Consultant must own advocate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthedParticipantForProgram } from '@/lib/referrals/participant-auth';
import { validateAdvocatePercent } from '@/lib/referrals/share-templates';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authed = await getAuthedParticipantForProgram('consultant-referral');

    if (!authed) {
      return NextResponse.json(
        { error: 'Authentication required. Bind your account first.' },
        { status: 401 }
      );
    }

    const { participant, program } = authed;
    const advocateId = params.id;

    if (participant.role !== 'CONSULTANT') {
      return NextResponse.json(
        { error: 'Only consultants can update advocates' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { advocatePercent } = body ?? {};

    const pct = parseFloat(String(advocatePercent));
    const ownerPercent = parseFloat(String(program.owner_percent ?? 0));
    const { valid, error } = validateAdvocatePercent(pct, ownerPercent);

    if (!valid) {
      return NextResponse.json(
        { error: error || 'Invalid advocate percent' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    const { data: advocate } = await adminClient
      .from('referral_participants')
      .select('id, parent_participant_id')
      .eq('id', advocateId)
      .eq('role', 'CLIENT_ADVOCATE')
      .single();

    if (!advocate || advocate.parent_participant_id !== participant.id) {
      return NextResponse.json(
        { error: 'Advocate not found or access denied' },
        { status: 404 }
      );
    }

    const { error: updateError } = await adminClient
      .from('referral_participants')
      .update({ custom_commission_percent: pct })
      .eq('id', advocateId);

    if (updateError) {
      console.error('[REFERRAL_ADVOCATE_UPDATE] Failed:', updateError);
      return NextResponse.json(
        { error: 'Failed to update advocate' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      custom_commission_percent: pct,
      message: 'Affects future referrals only.',
    });
  } catch (error) {
    console.error('[REFERRAL_ADVOCATE_UPDATE] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
