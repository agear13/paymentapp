/**
 * GET /api/referrals/advocates/[id]/analytics
 * Authenticated consultant only. Must own advocate (parent_participant_id).
 * Returns last 10 attributions with created_at, landing_path, user_agent.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthedParticipantForProgram } from '@/lib/referrals/participant-auth';

export async function GET(
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

    const { participant } = authed;
    const advocateId = params.id;

    if (!advocateId) {
      return NextResponse.json(
        { error: 'Advocate ID required' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    const { data: advocate } = await adminClient
      .from('referral_participants')
      .select('id, parent_participant_id, role')
      .eq('id', advocateId)
      .eq('role', 'CLIENT_ADVOCATE')
      .single();

    if (!advocate || advocate.parent_participant_id !== participant.id) {
      return NextResponse.json(
        { error: 'Advocate not found or access denied' },
        { status: 404 }
      );
    }

    const { data: attributions } = await adminClient
      .from('referral_attributions')
      .select('id, created_at, landing_path, user_agent')
      .eq('participant_id', advocateId)
      .order('created_at', { ascending: false })
      .limit(10);

    const { count: clicksCount } = await adminClient
      .from('referral_attributions')
      .select('id', { count: 'exact', head: true })
      .eq('participant_id', advocateId);

    const { count: conversionsCount } = await adminClient
      .from('referral_conversions')
      .select('id', { count: 'exact', head: true })
      .eq('participant_id', advocateId)
      .eq('conversion_type', 'payment_completed');

    return NextResponse.json({
      attributions: attributions || [],
      clicks: clicksCount ?? 0,
      conversions: conversionsCount ?? 0,
    });
  } catch (error) {
    console.error('[REFERRAL_ADVOCATE_ANALYTICS] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
