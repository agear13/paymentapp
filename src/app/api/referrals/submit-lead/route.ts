import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createPartnerLedgerEntryForReferralConversion } from '@/lib/referrals/partners-integration';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { referralCode, name, email, phone, message, attributionId } = body;

    if (!referralCode || !name || !email) {
      return NextResponse.json(
        { error: 'Referral code, name, and email are required' },
        { status: 400 }
      );
    }

    // Find participant
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('id, program_id, role')
      .eq('referral_code', referralCode.toUpperCase())
      .single();

    if (participantError || !participant) {
      return NextResponse.json(
        { error: 'Invalid referral code' },
        { status: 404 }
      );
    }

    // Create lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        program_id: participant.program_id,
        participant_id: participant.id,
        attribution_id: attributionId || null,
        name,
        email,
        phone: phone || null,
        message: message || null,
      })
      .select()
      .single();

    if (leadError) {
      console.error('Lead creation failed:', leadError);
      return NextResponse.json(
        { error: 'Failed to submit lead' },
        { status: 500 }
      );
    }

    // Auto-create conversion for lead_submitted (auto-approved)
    const { data: conversion, error: conversionError } = await supabase
      .from('conversions')
      .insert({
        program_id: participant.program_id,
        participant_id: participant.id,
        attribution_id: attributionId || null,
        conversion_type: 'lead_submitted',
        gross_amount: null,
        currency: 'USD',
        status: 'approved', // Auto-approve lead submissions
        proof_json: { 
          type: 'lead_form', 
          lead_id: lead.id,
          name,
          email 
        },
        approved_at: new Date().toISOString(),
        approved_by: 'system_auto',
      })
      .select()
      .single();

    if (conversionError) {
      console.error('Conversion creation failed:', conversionError);
      // Lead is still created, just log the error
    } else {
      // Create partner ledger entry
      try {
        await createPartnerLedgerEntryForReferralConversion(conversion.id);
      } catch (ledgerError) {
        console.error('Failed to create ledger entry:', ledgerError);
        // Don't fail the request, just log it
      }
    }

    return NextResponse.json({ 
      success: true, 
      leadId: lead.id,
      conversionId: conversion?.id 
    });
  } catch (error) {
    console.error('Submit lead error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
