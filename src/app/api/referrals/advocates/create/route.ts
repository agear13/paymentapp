/**
 * POST /api/referrals/advocates/create
 * Consultant-only: Create a client advocate participant and return shareable link.
 * Auth: participant.user_id = auth.uid()
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthedParticipantForProgram } from '@/lib/referrals/participant-auth';
import { buildShareTemplates } from '@/lib/referrals/share-templates';

function generateAdvocateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'ADV-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
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

    if (participant.role !== 'CONSULTANT') {
      return NextResponse.json(
        { error: 'Only consultants can create advocate links' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { programSlug, name, email, advocatePercent, serviceLabel } = body ?? {};

    if (programSlug !== 'consultant-referral') {
      return NextResponse.json(
        { error: 'Invalid program' },
        { status: 400 }
      );
    }

    const pct = parseFloat(String(advocatePercent));
    const ownerPercent = parseFloat(String(program.owner_percent ?? 0));
    const consultantRemainder = 100 - ownerPercent - pct;

    if (isNaN(pct) || pct < 0 || pct > 50) {
      return NextResponse.json(
        { error: 'advocatePercent must be between 0 and 50' },
        { status: 400 }
      );
    }
    if (consultantRemainder <= 0) {
      return NextResponse.json(
        { error: `Consultant remainder would be ${consultantRemainder.toFixed(1)}%. Must be positive.` },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    let referralCode = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateAdvocateCode();
      const { data: existing } = await adminClient
        .from('referral_participants')
        .select('id')
        .eq('referral_code', candidate)
        .single();

      if (!existing) {
        referralCode = candidate;
        break;
      }
    }

    if (!referralCode) {
      return NextResponse.json(
        { error: 'Could not generate unique referral code' },
        { status: 500 }
      );
    }

    const { data: newParticipant, error: insertError } = await adminClient
      .from('referral_participants')
      .insert({
        program_id: program.id,
        role: 'CLIENT_ADVOCATE',
        parent_participant_id: participant.id,
        custom_commission_percent: pct,
        name: name || 'Client Advocate',
        email: email || 'unknown@example.com',
        referral_code: referralCode,
        status: 'active',
        user_id: null,
      })
      .select('id, referral_code')
      .single();

    if (insertError || !newParticipant) {
      if (insertError?.code === '23505') {
        return NextResponse.json(
          { error: 'Referral code collision, please try again' },
          { status: 409 }
        );
      }
      console.error('[REFERRAL_ADVOCATE_CREATE] Insert failed:', insertError);
      return NextResponse.json(
        { error: 'Failed to create advocate' },
        { status: 500 }
      );
    }

    const { data: partnerProgram } = await adminClient
      .from('partner_programs')
      .select('id')
      .eq('slug', program.slug)
      .single();

    if (partnerProgram) {
      let entityId: string | null = null;
      const { data: inserted, error: insertErr } = await adminClient
        .from('partner_entities')
        .insert({
          program_id: partnerProgram.id,
          entity_type: 'participant',
          entity_ref_id: newParticipant.id,
          name: name || 'Client Advocate',
        })
        .select('id')
        .single();

      if (inserted) {
        entityId = inserted.id;
      } else if (insertErr?.code === '23505') {
        const { data: existing } = await adminClient
          .from('partner_entities')
          .select('id')
          .eq('program_id', partnerProgram.id)
          .eq('entity_type', 'participant')
          .eq('entity_ref_id', newParticipant.id)
          .single();
        entityId = existing?.id ?? null;
      }

      if (entityId) {
        await adminClient
          .from('referral_partner_entity_map')
          .upsert(
            { referral_participant_id: newParticipant.id, partner_entity_id: entityId },
            { onConflict: 'referral_participant_id' }
          );
      }
    }

    console.log('[REFERRAL_ADVOCATE_CREATE] Created:', {
      advocateId: newParticipant.id,
      referralCode: newParticipant.referral_code,
      consultantId: participant.id,
      percent: pct,
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const referralUrl = `${baseUrl}/r/${newParticipant.referral_code}`;
    const shareTemplates = buildShareTemplates(referralUrl, 'advocate', {
      clientName: name || undefined,
      serviceLabel: serviceLabel || 'my services',
    });

    return NextResponse.json({
      advocateId: newParticipant.id,
      advocateReferralCode: newParticipant.referral_code,
      link: `/r/${newParticipant.referral_code}`,
      referralUrl,
      advocatePercent: pct,
      ownerPercent,
      consultantPercent: consultantRemainder,
      shareTemplates,
    });
  } catch (error) {
    console.error('[REFERRAL_ADVOCATE_CREATE] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
