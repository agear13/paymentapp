import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { referralCode, landingPath } = body;

    if (!referralCode) {
      return NextResponse.json(
        { error: 'Referral code is required' },
        { status: 400 }
      );
    }

    // Find participant by referral code
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('id, program_id, status')
      .eq('referral_code', referralCode.toUpperCase())
      .single();

    if (participantError || !participant) {
      return NextResponse.json(
        { error: 'Invalid referral code' },
        { status: 404 }
      );
    }

    if (participant.status !== 'active') {
      return NextResponse.json(
        { error: 'Referral code is inactive' },
        { status: 403 }
      );
    }

    // Get user agent and IP
    const userAgent = request.headers.get('user-agent') || '';
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0] : request.ip || 'unknown';
    const ipHash = createHash('sha256').update(ip).digest('hex').substring(0, 16);

    // Create attribution record
    const { data: attribution, error: attrError } = await supabase
      .from('attributions')
      .insert({
        program_id: participant.program_id,
        participant_id: participant.id,
        referral_code: referralCode.toUpperCase(),
        landing_path: landingPath || '/',
        user_agent: userAgent,
        ip_hash: ipHash,
      })
      .select()
      .single();

    if (attrError) {
      console.error('Attribution creation failed:', attrError);
      return NextResponse.json(
        { error: 'Failed to track attribution' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      attributionId: attribution.id 
    });
  } catch (error) {
    console.error('Track attribution error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
